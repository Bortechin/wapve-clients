package com.wapve.call

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Person
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Rect
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.AudioDeviceInfo
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WapveCallModule : Module() {
  private var bubbleReceiver: BroadcastReceiver? = null

  override fun definition() = ModuleDefinition {
    Name("WapveCall")
    Events(EVENT_CALL_BUBBLE_ACTION)

    OnCreate {
      val context = appContext.reactContext ?: return@OnCreate
      bubbleReceiver = object : BroadcastReceiver() {
        override fun onReceive(receiveContext: Context?, intent: Intent?) {
          val action = intent?.getStringExtra(EXTRA_BUBBLE_ACTION) ?: return
          sendEvent(EVENT_CALL_BUBBLE_ACTION, mapOf(
            "action" to action,
            "callId" to intent.getStringExtra(EXTRA_BUBBLE_CALL_ID),
            "nativeApplied" to intent.getBooleanExtra(EXTRA_BUBBLE_NATIVE_APPLIED, false),
          ))
        }
      }
      val filter = IntentFilter(ACTION_BUBBLE_CONTROL)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) context.registerReceiver(bubbleReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
      else @Suppress("DEPRECATION") context.registerReceiver(bubbleReceiver, filter)
    }

    OnDestroy {
      val context = appContext.reactContext
      bubbleReceiver?.let { receiver -> try { context?.unregisterReceiver(receiver) } catch (_: IllegalArgumentException) { } }
      bubbleReceiver = null
    }

    AsyncFunction("showIncomingCall") { callId: String, title: String, deepLink: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      WapveCallNotifications.ensureChannels(context)
      WapveCallNotifications.showIncoming(context, callId, title, deepLink)
    }

    AsyncFunction("startCallService") { callId: String, title: String, deepLink: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      WapveCallNotifications.ensureChannels(context)
      val intent = Intent(context, WapveCallService::class.java).apply {
        action = WapveCallService.ACTION_START
        putExtra(WapveCallService.EXTRA_CALL_ID, callId)
        putExtra(WapveCallService.EXTRA_TITLE, title)
        putExtra(WapveCallService.EXTRA_DEEP_LINK, deepLink)
      }
      context.startForegroundService(intent)
      requestAudioFocus(context)
    }

    AsyncFunction("stopCall") { callId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      context.stopService(Intent(context, WapveCallService::class.java))
      val notifications = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notifications.cancel(WapveCallNotifications.notificationId(callId))
      abandonAudioFocus(context)
    }

    AsyncFunction("canDrawCallBubble") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
    }

    AsyncFunction("requestCallBubblePermission") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return@AsyncFunction true
      val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}")).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      context.startActivity(intent)
      true
    }

    AsyncFunction("setCallBubbleVisible") { callId: String, title: String, visible: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      if (visible && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) return@AsyncFunction false
      context.startService(Intent(context, WapveCallService::class.java).apply {
        action = if (visible) WapveCallService.ACTION_SHOW_BUBBLE else WapveCallService.ACTION_HIDE_BUBBLE
        putExtra(WapveCallService.EXTRA_CALL_ID, callId)
        putExtra(WapveCallService.EXTRA_TITLE, title)
      })
      true
    }

    AsyncFunction("setSpeakerEnabled") { enabled: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audio.mode = AudioManager.MODE_IN_COMMUNICATION
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        try {
          val type = if (enabled) AudioDeviceInfo.TYPE_BUILTIN_SPEAKER else AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
          audio.availableCommunicationDevices.firstOrNull { it.type == type }?.let(audio::setCommunicationDevice)
        } catch (_: SecurityException) {
          // The route picker requests BLUETOOTH_CONNECT before enumerating external devices.
        }
      } else {
        @Suppress("DEPRECATION")
        run { audio.isSpeakerphoneOn = enabled }
      }
    }

    AsyncFunction("getCallVolume") {
      val context = appContext.reactContext ?: return@AsyncFunction 0.75
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val maximum = audio.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL).coerceAtLeast(1)
      audio.getStreamVolume(AudioManager.STREAM_VOICE_CALL).toDouble() / maximum.toDouble()
    }

    AsyncFunction("setCallVolume") { value: Double ->
      val context = appContext.reactContext ?: return@AsyncFunction
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val maximum = audio.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL).coerceAtLeast(1)
      val target = (value.coerceIn(0.0, 1.0) * maximum).toInt().coerceIn(0, maximum)
      audio.setStreamVolume(AudioManager.STREAM_VOICE_CALL, target, 0)
    }

    AsyncFunction("getAudioRoutes") {
      val context = appContext.reactContext ?: return@AsyncFunction emptyList<Map<String, Any>>()
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val selectedId = audio.communicationDevice?.id
          return@AsyncFunction audio.availableCommunicationDevices.map { device ->
            mapOf(
              "id" to device.id.toString(),
              "label" to device.productName.toString().ifBlank { audioRouteLabel(device.type) },
              "type" to audioRouteType(device.type),
              "selected" to (device.id == selectedId),
            )
          }
        }
      } catch (_: SecurityException) {
        return@AsyncFunction emptyList<Map<String, Any>>()
      }
      @Suppress("DEPRECATION")
      return@AsyncFunction listOf(
        mapOf("id" to "earpiece", "label" to "Telefon", "type" to "earpiece", "selected" to !audio.isSpeakerphoneOn),
        mapOf("id" to "speaker", "label" to "Hoparlör", "type" to "speaker", "selected" to audio.isSpeakerphoneOn),
      )
    }

    AsyncFunction("setAudioRoute") { routeId: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      audio.mode = AudioManager.MODE_IN_COMMUNICATION
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val target = audio.availableCommunicationDevices.firstOrNull { it.id.toString() == routeId }
            ?: return@AsyncFunction false
          return@AsyncFunction audio.setCommunicationDevice(target)
        }
      } catch (_: SecurityException) {
        return@AsyncFunction false
      }
      @Suppress("DEPRECATION")
      run { audio.isSpeakerphoneOn = routeId == "speaker" }
      true
    }

    AsyncFunction("setLeftEdgeGestureExclusion") { enabled: Boolean, widthDp: Double ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return@AsyncFunction
      val activity = appContext.currentActivity ?: return@AsyncFunction
      activity.runOnUiThread {
        val decor = activity.window.decorView
        if (!enabled) {
          decor.systemGestureExclusionRects = emptyList()
          return@runOnUiThread
        }
        val density = decor.resources.displayMetrics.density
        val width = (widthDp.coerceIn(24.0, 72.0) * density).toInt()
        val exclusionHeight = (200 * density).toInt()
        val applyExclusion = {
          val top = ((decor.height - exclusionHeight) / 2).coerceAtLeast(0)
          val bottom = (top + exclusionHeight).coerceAtMost(decor.height)
          decor.systemGestureExclusionRects = listOf(Rect(0, top, width, bottom))
        }
        if (decor.height > 0) applyExclusion() else decor.post(applyExclusion)
      }
    }
  }

  private var focusRequest: AudioFocusRequest? = null

  private fun audioRouteType(type: Int) = when (type) {
    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "speaker"
    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "earpiece"
    AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "wired"
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO, AudioDeviceInfo.TYPE_BLE_HEADSET -> "bluetooth"
    AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_USB_DEVICE -> "usb"
    else -> "other"
  }

  private fun audioRouteLabel(type: Int) = when (audioRouteType(type)) {
    "speaker" -> "Hoparlör"
    "earpiece" -> "Telefon"
    "wired" -> "Kablolu kulaklık"
    "bluetooth" -> "Bluetooth"
    "usb" -> "USB ses cihazı"
    else -> "Ses cihazı"
  }

  private fun requestAudioFocus(context: Context) {
    val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    audio.mode = AudioManager.MODE_IN_COMMUNICATION
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
        .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
        .build()
      audio.requestAudioFocus(focusRequest!!)
    }
  }

  private fun abandonAudioFocus(context: Context) {
    val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) focusRequest?.let(audio::abandonAudioFocusRequest)
    audio.mode = AudioManager.MODE_NORMAL
    focusRequest = null
  }

  companion object {
    const val ACTION_BUBBLE_CONTROL = "com.wapve.call.BUBBLE_CONTROL"
    const val EXTRA_BUBBLE_ACTION = "bubbleAction"
    const val EXTRA_BUBBLE_CALL_ID = "bubbleCallId"
    const val EXTRA_BUBBLE_NATIVE_APPLIED = "bubbleNativeApplied"
    private const val EVENT_CALL_BUBBLE_ACTION = "onCallBubbleAction"
  }
}

internal object WapveCallNotifications {
  const val INCOMING_CHANNEL = "wapve_calls_incoming"
  const val ACTIVE_CHANNEL = "wapve_calls_active"

  fun ensureChannels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.createNotificationChannel(NotificationChannel(INCOMING_CHANNEL, context.getString(R.string.wapve_incoming_calls_channel), NotificationManager.IMPORTANCE_HIGH).apply { description = context.getString(R.string.wapve_incoming_calls_description); lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC })
    manager.createNotificationChannel(NotificationChannel(ACTIVE_CHANNEL, context.getString(R.string.wapve_active_calls_channel), NotificationManager.IMPORTANCE_LOW).apply { description = context.getString(R.string.wapve_active_calls_description) })
    manager.createNotificationChannel(NotificationChannel("wapve_messages", context.getString(R.string.wapve_messages_channel), NotificationManager.IMPORTANCE_HIGH).apply { description = context.getString(R.string.wapve_messages_description) })
  }

  fun notificationId(callId: String) = 11_000 + (callId.hashCode() and 0x0fff)

  fun showIncoming(context: Context, callId: String, title: String, deepLink: String) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val answer = activityIntent(context, "$deepLink&action=answer", notificationId(callId))
    val decline = activityIntent(context, "$deepLink&action=decline", notificationId(callId) + 1)
    val builder = android.app.Notification.Builder(context, INCOMING_CHANNEL)
      .setSmallIcon(android.R.drawable.sym_call_incoming)
      .setContentTitle(title)
      .setContentText(context.getString(R.string.wapve_call_incoming))
      .setCategory(android.app.Notification.CATEGORY_CALL)
      .setVisibility(android.app.Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setTimeoutAfter(120_000)
      .setContentIntent(answer)
      .setFullScreenIntent(answer, true)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setStyle(android.app.Notification.CallStyle.forIncomingCall(Person.Builder().setName(title).setImportant(true).build(), decline, answer))
    } else {
      builder.addAction(android.app.Notification.Action.Builder(null, context.getString(R.string.wapve_call_decline), decline).build())
      builder.addAction(android.app.Notification.Action.Builder(null, context.getString(R.string.wapve_call_answer), answer).build())
    }
    manager.notify(notificationId(callId), builder.build())
  }

  fun active(context: Context, callId: String, title: String, deepLink: String): android.app.Notification {
    val open = activityIntent(context, deepLink, notificationId(callId))
    return android.app.Notification.Builder(context, ACTIVE_CHANNEL)
      .setSmallIcon(android.R.drawable.sym_call_outgoing)
      .setContentTitle(title)
      .setContentText(context.getString(R.string.wapve_call_active))
      .setCategory(android.app.Notification.CATEGORY_CALL)
      .setOngoing(true)
      .setContentIntent(open)
      .addAction(android.app.Notification.Action.Builder(null, context.getString(R.string.wapve_call_bubble_mute), bubbleActionIntent(context, callId, "mute", notificationId(callId) + 21)).build())
      .addAction(android.app.Notification.Action.Builder(null, context.getString(R.string.wapve_call_bubble_speaker), bubbleActionIntent(context, callId, "speaker", notificationId(callId) + 22)).build())
      .addAction(android.app.Notification.Action.Builder(null, context.getString(R.string.wapve_call_bubble_leave), bubbleActionIntent(context, callId, "hangup", notificationId(callId) + 23)).build())
      .build()
  }

  private fun bubbleActionIntent(context: Context, callId: String, action: String, requestCode: Int): PendingIntent {
    val intent = Intent(context, WapveCallService::class.java).apply {
      this.action = WapveCallService.ACTION_CONTROL
      putExtra(WapveCallModule.EXTRA_BUBBLE_ACTION, action)
      putExtra(WapveCallModule.EXTRA_BUBBLE_CALL_ID, callId)
    }
    return PendingIntent.getService(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun activityIntent(context: Context, deepLink: String, requestCode: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(deepLink)).apply { setPackage(context.packageName); flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP }
    return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }
}
