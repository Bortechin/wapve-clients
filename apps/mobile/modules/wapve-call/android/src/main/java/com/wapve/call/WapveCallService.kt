package com.wapve.call

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.IBinder

class WapveCallService : Service() {
  private lateinit var bubble: WapveCallBubble

  override fun onCreate() {
    super.onCreate()
    bubble = WapveCallBubble(this)
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_CONTROL) return handleControl(intent)
    if (intent?.action == ACTION_HIDE_BUBBLE) {
      bubble.hide()
      return START_STICKY
    }
    val preferences = getSharedPreferences(PREFERENCES, MODE_PRIVATE)
    val callId = intent?.getStringExtra(EXTRA_CALL_ID) ?: preferences.getString(EXTRA_CALL_ID, null) ?: return START_NOT_STICKY
    val title = intent?.getStringExtra(EXTRA_TITLE) ?: preferences.getString(EXTRA_TITLE, null) ?: getString(R.string.wapve_call_default_title)
    val deepLink = intent?.getStringExtra(EXTRA_DEEP_LINK) ?: preferences.getString(EXTRA_DEEP_LINK, null) ?: "wapve://"
    if (intent?.action == ACTION_SHOW_BUBBLE) {
      bubble.show(callId, title)
      return START_STICKY
    }
    if (intent?.action != null && intent.action != ACTION_START) return START_STICKY
    preferences.edit().putString(EXTRA_CALL_ID, callId).putString(EXTRA_TITLE, title).putString(EXTRA_DEEP_LINK, deepLink).apply()
    val notification = WapveCallNotifications.active(this, callId, title, deepLink)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(WapveCallNotifications.notificationId(callId), notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA)
    } else startForeground(WapveCallNotifications.notificationId(callId), notification)
    return START_STICKY
  }

  private fun handleControl(intent: Intent): Int {
    val action = intent.getStringExtra(WapveCallModule.EXTRA_BUBBLE_ACTION) ?: return START_STICKY
    val callId = intent.getStringExtra(WapveCallModule.EXTRA_BUBBLE_CALL_ID)
      ?: getSharedPreferences(PREFERENCES, MODE_PRIVATE).getString(EXTRA_CALL_ID, null)
      ?: return START_NOT_STICKY
    val nativeApplied = action == "speaker" && toggleSpeaker()
    sendBroadcast(Intent(WapveCallModule.ACTION_BUBBLE_CONTROL).apply {
      setPackage(packageName)
      putExtra(WapveCallModule.EXTRA_BUBBLE_ACTION, action)
      putExtra(WapveCallModule.EXTRA_BUBBLE_CALL_ID, callId)
      putExtra(WapveCallModule.EXTRA_BUBBLE_NATIVE_APPLIED, nativeApplied)
    })
    if (action == "hangup") {
      bubble.hide()
      getSharedPreferences(PREFERENCES, MODE_PRIVATE).edit().clear().apply()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE)
      else @Suppress("DEPRECATION") stopForeground(true)
      stopSelf()
      return START_NOT_STICKY
    }
    return START_STICKY
  }

  private fun toggleSpeaker(): Boolean {
    val audio = getSystemService(AUDIO_SERVICE) as AudioManager
    audio.mode = AudioManager.MODE_IN_COMMUNICATION
    return try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val enable = audio.communicationDevice?.type != AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
        val type = if (enable) AudioDeviceInfo.TYPE_BUILTIN_SPEAKER else AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
        audio.availableCommunicationDevices.firstOrNull { it.type == type }?.let(audio::setCommunicationDevice) == true
      } else {
        @Suppress("DEPRECATION")
        run { audio.isSpeakerphoneOn = !audio.isSpeakerphoneOn }
        true
      }
    } catch (_: SecurityException) {
      false
    }
  }

  override fun onDestroy() {
    bubble.hide()
    getSharedPreferences(PREFERENCES, MODE_PRIVATE).edit().clear().apply()
    super.onDestroy()
  }

  companion object {
    const val ACTION_START = "com.wapve.call.START"
    const val ACTION_SHOW_BUBBLE = "com.wapve.call.SHOW_BUBBLE"
    const val ACTION_HIDE_BUBBLE = "com.wapve.call.HIDE_BUBBLE"
    const val ACTION_CONTROL = "com.wapve.call.CONTROL"
    const val EXTRA_CALL_ID = "callId"
    const val EXTRA_TITLE = "title"
    const val EXTRA_DEEP_LINK = "deepLink"
    private const val PREFERENCES = "wapve_active_call"
  }
}
