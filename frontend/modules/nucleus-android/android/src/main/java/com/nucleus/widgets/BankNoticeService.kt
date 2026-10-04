package com.nucleus.widgets

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONArray
import org.json.JSONObject

internal const val BANK_ACTION = "com.nucleus.widgets.BANK_NOTICE"
private const val BANK_NOTICES = "bank_notices"

internal fun bankListenerEnabled(context: Context): Boolean {
  val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
  return flat.split(":").any { component ->
    component.contains(context.packageName) && component.contains("BankNoticeService")
  }
}

internal object BankNotices {
  private val gate = Any()

  fun add(context: Context, sender: String, body: String, at: Long) {
    val cleanBody = body.trim().take(500)
    if (cleanBody.isEmpty()) return
    synchronized(gate) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val arr = try {
        JSONArray(prefs.getString(BANK_NOTICES, "[]"))
      } catch (_: Exception) {
        JSONArray()
      }
      val item = JSONObject()
      item.put("sender", sender.trim().take(80).ifBlank { "bank" })
      item.put("body", cleanBody)
      item.put("at", at.toString())
      arr.put(item)
      val start = maxOf(0, arr.length() - 40)
      val trimmed = JSONArray()
      for (i in start until arr.length()) trimmed.put(arr.get(i))
      prefs.edit().putString(BANK_NOTICES, trimmed.toString()).commit()
    }
  }

  fun drain(context: Context): String {
    synchronized(gate) {
      val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val raw = prefs.getString(BANK_NOTICES, "[]") ?: "[]"
      prefs.edit().remove(BANK_NOTICES).commit()
      return raw
    }
  }
}

/** Bank app notifications stay on this phone. Codes are filtered later, before anything is saved. */
class BankNoticeService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    val notice = sbn ?: return
    if (notice.packageName == packageName) return
    val extras = notice.notification.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
    val big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
    val body = listOf(title, text, big).map { it.trim() }.filter { it.isNotEmpty() }.distinct().joinToString(" ")
    if (body.isBlank()) return
    BankNotices.add(this, title.ifBlank { notice.packageName }, body, notice.postTime)
    sendBroadcast(Intent(BANK_ACTION).setPackage(packageName))
  }
}
