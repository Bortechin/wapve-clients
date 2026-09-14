package com.wapve.call

import android.app.Service
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import kotlin.math.abs

internal class WapveCallBubble(private val service: Service) {
  private val windowManager = service.getSystemService(Service.WINDOW_SERVICE) as WindowManager
  private var root: LinearLayout? = null
  private var controls: LinearLayout? = null
  private var params: WindowManager.LayoutParams? = null
  private var callId: String = ""
  private var muted = false
  private var deafened = false
  private var speaker = false
  private var muteButton: TextView? = null
  private var deafenButton: TextView? = null
  private var speakerButton: TextView? = null

  fun show(nextCallId: String, title: String) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(service)) return
    callId = nextCallId
    if (root != null) return

    val bubble = LinearLayout(service).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      contentDescription = title
    }
    val logo = ImageView(service).apply {
      setImageDrawable(service.applicationInfo.loadIcon(service.packageManager))
      scaleType = ImageView.ScaleType.CENTER_CROP
      setPadding(dp(4), dp(4), dp(4), dp(4))
      background = circle(Color.rgb(11, 22, 44), Color.rgb(67, 207, 255))
      elevation = dp(12).toFloat()
      contentDescription = service.getString(R.string.wapve_call_bubble_open)
    }
    bubble.addView(logo, LinearLayout.LayoutParams(dp(58), dp(58)))

    val actionRow = LinearLayout(service).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER
      visibility = View.GONE
      setPadding(dp(6), dp(5), dp(6), dp(5))
      background = rounded(Color.argb(245, 11, 22, 44), dp(22).toFloat())
      elevation = dp(12).toFloat()
    }
    muteButton = actionButton("🎙", R.string.wapve_call_bubble_mute, "mute")
    deafenButton = actionButton("🎧", R.string.wapve_call_bubble_deafen, "deafen")
    speakerButton = actionButton("🔊", R.string.wapve_call_bubble_speaker, "speaker")
    val hangup = actionButton("✕", R.string.wapve_call_bubble_leave, "hangup", danger = true)
    listOf(muteButton, deafenButton, speakerButton, hangup).forEach { actionRow.addView(it) }
    bubble.addView(actionRow, LinearLayout.LayoutParams(LinearLayout.LayoutParams.WRAP_CONTENT, dp(50)).apply { topMargin = dp(5) })
    controls = actionRow

    val layoutParams = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = dp(18)
      y = dp(180)
    }
    params = layoutParams
    attachDragAndToggle(logo, bubble, layoutParams)
    windowManager.addView(bubble, layoutParams)
    root = bubble
  }

  fun hide() {
    root?.let {
      try { windowManager.removeView(it) } catch (_: IllegalArgumentException) { }
    }
    root = null
    controls = null
    params = null
  }

  private fun attachDragAndToggle(handle: View, bubble: View, layoutParams: WindowManager.LayoutParams) {
    var downRawX = 0f
    var downRawY = 0f
    var originX = 0
    var originY = 0
    var moved = false
    handle.setOnTouchListener { _, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          downRawX = event.rawX
          downRawY = event.rawY
          originX = layoutParams.x
          originY = layoutParams.y
          moved = false
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - downRawX
          val dy = event.rawY - downRawY
          moved = moved || abs(dx) > dp(5) || abs(dy) > dp(5)
          layoutParams.x = (originX + dx.toInt()).coerceAtLeast(0)
          layoutParams.y = (originY + dy.toInt()).coerceAtLeast(0)
          windowManager.updateViewLayout(bubble, layoutParams)
          true
        }
        MotionEvent.ACTION_UP -> {
          if (!moved) controls?.visibility = if (controls?.visibility == View.VISIBLE) View.GONE else View.VISIBLE
          true
        }
        else -> false
      }
    }
  }

  private fun actionButton(symbol: String, label: Int, action: String, danger: Boolean = false) = TextView(service).apply {
    text = symbol
    textSize = 18f
    gravity = Gravity.CENTER
    contentDescription = service.getString(label)
    background = circle(if (danger) Color.rgb(210, 48, 64) else Color.rgb(24, 43, 72), Color.TRANSPARENT)
    setOnClickListener {
      when (action) {
        "mute" -> { muted = !muted; alpha = if (muted) 0.55f else 1f }
        "deafen" -> { deafened = !deafened; alpha = if (deafened) 0.55f else 1f }
        "speaker" -> { speaker = !speaker; setSpeaker(speaker); alpha = if (speaker) 1f else 0.55f }
        "hangup" -> hide()
      }
      service.sendBroadcast(Intent(WapveCallModule.ACTION_BUBBLE_CONTROL).apply {
        setPackage(service.packageName)
        putExtra(WapveCallModule.EXTRA_BUBBLE_ACTION, action)
        putExtra(WapveCallModule.EXTRA_BUBBLE_CALL_ID, callId)
        putExtra(WapveCallModule.EXTRA_BUBBLE_NATIVE_APPLIED, action == "speaker")
      })
      if (action == "hangup") service.stopSelf()
    }
    layoutParams = LinearLayout.LayoutParams(dp(40), dp(40)).apply { marginStart = dp(3); marginEnd = dp(3) }
  }

  private fun setSpeaker(enabled: Boolean) {
    val audio = service.getSystemService(Service.AUDIO_SERVICE) as AudioManager
    audio.mode = AudioManager.MODE_IN_COMMUNICATION
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val type = if (enabled) AudioDeviceInfo.TYPE_BUILTIN_SPEAKER else AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
      try { audio.availableCommunicationDevices.firstOrNull { it.type == type }?.let(audio::setCommunicationDevice) } catch (_: SecurityException) { }
    } else {
      @Suppress("DEPRECATION")
      run { audio.isSpeakerphoneOn = enabled }
    }
  }

  private fun circle(fill: Int, stroke: Int) = GradientDrawable().apply {
    shape = GradientDrawable.OVAL
    setColor(fill)
    if (stroke != Color.TRANSPARENT) setStroke(dp(2), stroke)
  }

  private fun rounded(fill: Int, radius: Float) = GradientDrawable().apply {
    shape = GradientDrawable.RECTANGLE
    setColor(fill)
    cornerRadius = radius
  }

  private fun dp(value: Int) = (value * service.resources.displayMetrics.density).toInt()
}
