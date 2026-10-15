package com.nucleus.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.BatteryManager
import android.widget.RemoteViews
import org.json.JSONObject

internal const val PREFS = "nucleus_widgets"
internal const val SNAPSHOT = "snapshot"
internal const val CYCLE = "cycle_window"

internal fun readSnapshot(context: Context): JSONObject? {
  val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(SNAPSHOT, null) ?: return null
  return try {
    JSONObject(raw)
  } catch (_: Exception) {
    null
  }
}

internal object WidgetRender {
  fun bind(context: Context, kind: String): RemoteViews {
    val views = RemoteViews(context.packageName, R.layout.widget_card)
    val snap = readSnapshot(context)
    val card = cardFor(context, kind, snap)
    views.setTextViewText(R.id.kicker, card.kicker)
    views.setTextViewText(R.id.value, card.value)
    views.setTextViewText(R.id.subtitle, card.subtitle)
    val action = if (card.action == null) "" else "&action=${card.action}"
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("nucleus://open?path=${card.path}$action")).setPackage(context.packageName)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    views.setOnClickPendingIntent(R.id.root, PendingIntent.getActivity(context, kind.hashCode(), intent, flags))
    return views
  }

  fun refresh(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    listOf(
      CountdownWidget::class.java to "countdown",
      BudgetWidget::class.java to "budget",
      TripWidget::class.java to "trip",
      MaintenanceWidget::class.java to "maintenance",
      BatteryWidget::class.java to "battery",
      CycleWidget::class.java to "cycle",
      FuelWidget::class.java to "fuel",
      ExpenseWidget::class.java to "expense",
      ServiceWidget::class.java to "service",
    ).forEach { (cls, kind) ->
      val ids = manager.getAppWidgetIds(ComponentName(context, cls))
      for (id in ids) manager.updateAppWidget(id, bind(context, kind))
    }
  }

  private data class Card(val kicker: String, val value: String, val subtitle: String, val path: String, val action: String? = null)

  private fun cardFor(context: Context, kind: String, snap: JSONObject?): Card {
    if (kind == "battery") return battery(context)
    if (kind == "cycle") return cycle(context)
    if (kind == "fuel") return Card("Log fuel", "Tap to log", "Opens the fuel form", "/vehicles", "fuel")
    if (kind == "expense") return Card("Add expense", "Tap to add", "Opens the money form", "/money", "expense")
    if (kind == "service") return Card("Log service", "Tap to log", "Opens the service form", "/vehicles", "service")
    if (snap == null) return Card(label(kind), "Open Nucleus", "Open the app once to fill this", path(kind))
    return when (kind) {
      "budget" -> {
        val o = snap.optJSONObject("budget")
        Card("Budget", o?.optString("value").orEmpty().ifBlank { "—" }, o?.optString("label").orEmpty(), "/money")
      }
      "trip" -> {
        val o = snap.optJSONObject("trip")
        if (o == null) Card("Trip", "No trip", "Add one in Travel", "/travel")
        else Card("Trip", o.optString("title").ifBlank { "Trip" }, o.optString("when"), "/travel")
      }
      "maintenance" -> {
        val o = snap.optJSONObject("maintenance")
        if (o == null) Card("Maintenance", "Nothing due", "Home plans show up here", "/home")
        else Card("Maintenance", o.optString("title").ifBlank { "Maintenance" }, o.optString("subtitle"), "/home")
      }
      else -> {
        val o = snap.optJSONObject("countdown")
        if (o == null) Card("Countdown", "Nothing dated", "Dates you already keep", "/calendar")
        else {
          val days = o.optInt("days", 0)
          val value = if (days == 0) "Today" else "$days days"
          Card("Countdown", value, o.optString("title"), "/calendar")
        }
      }
    }
  }

  private fun cycle(context: Context): Card {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(CYCLE, null)
    val o = raw?.let {
      try {
        JSONObject(it)
      } catch (_: Exception) {
        null
      }
    }
    val window = o?.optString("window").orEmpty().ifBlank { "No window yet" }
    val shade = o?.optString("shade").orEmpty().ifBlank { "Next window" }
    return Card("Cycle", window, shade, "/cycle")
  }

  private fun battery(context: Context): Card {
    val intent = context.registerReceiver(null, android.content.IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val pct = if (level >= 0 && scale > 0) level * 100 / scale else -1
    val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
    val charging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
    return Card("Battery", if (pct >= 0) "$pct%" else "—", if (charging) "Charging" else "On battery", "/lab")
  }

  private fun label(kind: String) = kind.replaceFirstChar { it.uppercase() }

  private fun path(kind: String) = when (kind) {
    "budget" -> "/money"
    "trip" -> "/travel"
    "maintenance" -> "/home"
    "battery" -> "/lab"
    else -> "/calendar"
  }
}

abstract class NucleusWidget : android.appwidget.AppWidgetProvider() {
  abstract val kind: String

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    for (id in appWidgetIds) appWidgetManager.updateAppWidget(id, WidgetRender.bind(context, kind))
  }
}

class CountdownWidget : NucleusWidget() {
  override val kind = "countdown"
}

class BudgetWidget : NucleusWidget() {
  override val kind = "budget"
}

class TripWidget : NucleusWidget() {
  override val kind = "trip"
}

class MaintenanceWidget : NucleusWidget() {
  override val kind = "maintenance"
}

class BatteryWidget : NucleusWidget() {
  override val kind = "battery"
}

class CycleWidget : NucleusWidget() {
  override val kind = "cycle"
}

class FuelWidget : NucleusWidget() {
  override val kind = "fuel"
}

class ExpenseWidget : NucleusWidget() {
  override val kind = "expense"
}

class ServiceWidget : NucleusWidget() {
  override val kind = "service"
}
