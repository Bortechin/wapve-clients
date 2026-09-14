package com.wapve.call

import android.app.Notification
import android.app.PendingIntent
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.time.Instant

/**
 * Handles call data before React Native is started. Ordinary messages are
 * displayed here as data notifications so foreground, background and terminated
 * delivery use the same secure deep-link path.
 */
class WapveFirebaseMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    when (message.data["type"]) {
      "incoming_call" -> showIncoming(message.data)
      "call_ended" -> cancelCall(message.data["callId"])
      "notification" -> showNotification(message.data)
    }
  }

  private fun showIncoming(data: Map<String, String>) {
    val callId = data["callId"] ?: return
    val conversationId = data["conversationId"] ?: return
    val kind = data["kind"]?.takeIf { it == "direct" || it == "group" } ?: return
    val expiresAt = runCatching { Instant.parse(data["expiresAt"]) }.getOrNull() ?: return
    if (!expiresAt.isAfter(Instant.now())) return
    val title = data["title"]?.takeIf(String::isNotBlank)
      ?: data["callerDisplayName"]?.takeIf(String::isNotBlank)
      ?: getString(R.string.wapve_call_default_title)
    val deepLink = Uri.Builder()
      .scheme("wapve")
      .authority("call")
      .appendPath(kind)
      .appendPath(conversationId)
      .appendQueryParameter("callId", callId)
      .appendQueryParameter("mode", data["mode"] ?: "audio")
      .appendQueryParameter("title", title)
      .build()
      .toString()
    WapveCallNotifications.ensureChannels(this)
    WapveCallNotifications.showIncoming(this, callId, title, deepLink)
  }

  private fun cancelCall(callId: String?) {
    if (callId == null) return
    val notifications = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    notifications.cancel(WapveCallNotifications.notificationId(callId))
  }

  private fun showNotification(data: Map<String, String>) {
    val title = data["title"] ?: "Wapve"
    val body = data["body"] ?: return
    val route = data["route"]?.takeIf { it.startsWith("/") } ?: "/notifications"
    val deepLink = Uri.parse("wapve://$route")
    val requestCode = 21_000 + ("$route:$body".hashCode() and 0x0fff)
    val openIntent = Intent(Intent.ACTION_VIEW, deepLink).apply {
      setPackage(packageName)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      requestCode,
      openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    WapveCallNotifications.ensureChannels(this)
    val notification = Notification.Builder(this, "wapve_messages")
      .setSmallIcon(android.R.drawable.sym_action_chat)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setCategory(Notification.CATEGORY_MESSAGE)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .build()
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    manager.notify(requestCode, notification)
  }
}
