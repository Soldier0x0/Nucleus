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

  fun add(context: Context, sender: String, body: String, at: Long, app: String = "") {
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
      item.put("app", app.take(120))
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

/** Only money-looking notices are queued, so chats and codes never fill the 40-slot queue. */
private val OTP_WORDS = Regex("""\b(otp|one[ -]?time(?: password)?|verification code|do not share)\b""", RegexOption.IGNORE_CASE)
private val MONEY = Regex("""(?:inr|rs\.?|₹)\s*[0-9]""", RegexOption.IGNORE_CASE)
private val MONEY_WORDS = Regex("""\b(debited|debit|paid|sent|spent|withdrawn|purchase|credited|credit|received|added|balance|bal)\b""", RegexOption.IGNORE_CASE)

/** SMS apps whose notifications carry bank texts (Harsha's Q10 list). Bank and UPI apps pass the same money filter. */
internal val SMS_APPS = setOf(
  "com.google.android.apps.messaging",
  "com.samsung.android.messaging",
  "com.android.mms",
  "com.miui.mms",
  "com.coloros.mms",
  "com.oneplus.mms",
  "com.vivo.message",
  "com.truecaller",
  "com.jio.messages",
)

internal fun looksLikeMoney(body: String): Boolean = !OTP_WORDS.containsMatchIn(body) && MONEY.containsMatchIn(body) && MONEY_WORDS.containsMatchIn(body)

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
    if (body.isBlank() || !looksLikeMoney(body)) return
    BankNotices.add(this, title.ifBlank { notice.packageName }, body, notice.postTime, notice.packageName)
    sendBroadcast(Intent(BANK_ACTION).setPackage(packageName))
  }
}
