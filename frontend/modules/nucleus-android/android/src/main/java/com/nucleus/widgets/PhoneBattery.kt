package com.nucleus.widgets

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.PowerManager
import org.json.JSONObject

/** Sticky battery facts expo-battery does not expose. Missing facts are omitted. */
object PhoneBattery {
  fun read(ctx: Context): String {
    val intent = sticky(ctx) ?: return ""
    val level = intent.getIntExtra(BatteryManager.EXTRA_LEVEL, -1)
    val scale = intent.getIntExtra(BatteryManager.EXTRA_SCALE, -1)
    val status = intent.getIntExtra(BatteryManager.EXTRA_STATUS, BatteryManager.BATTERY_STATUS_UNKNOWN)
    val json = JSONObject()
    if (level >= 0 && scale > 0) json.put("level", level.toDouble() / scale.toDouble())
    json.put("state", chargeState(status))
    json.put("saver", ctx.getSystemService(PowerManager::class.java)?.isPowerSaveMode == true)
    cycleCount(intent)?.let { json.put("cycleCount", it) }
    healthLabel(intent.getIntExtra(BatteryManager.EXTRA_HEALTH, BatteryManager.BATTERY_HEALTH_UNKNOWN))?.let { json.put("health", it) }
    if (intent.hasExtra(BatteryManager.EXTRA_TEMPERATURE)) {
      json.put("temperatureC", intent.getIntExtra(BatteryManager.EXTRA_TEMPERATURE, 0) / 10.0)
    }
    if (intent.hasExtra(BatteryManager.EXTRA_VOLTAGE)) {
      val millivolts = intent.getIntExtra(BatteryManager.EXTRA_VOLTAGE, 0)
      if (millivolts > 0) json.put("voltageV", millivolts / 1000.0)
    }
    intent.getStringExtra(BatteryManager.EXTRA_TECHNOLOGY)?.takeIf { it.isNotBlank() }?.let { json.put("technology", it) }
    return json.toString()
  }

  @Suppress("DEPRECATION")
  private fun sticky(ctx: Context): Intent? {
    return ctx.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
  }

  private fun chargeState(status: Int): String = when (status) {
    BatteryManager.BATTERY_STATUS_CHARGING -> "charging"
    BatteryManager.BATTERY_STATUS_FULL -> "full"
    BatteryManager.BATTERY_STATUS_NOT_CHARGING -> "not charging"
    BatteryManager.BATTERY_STATUS_DISCHARGING -> "unplugged"
    else -> "unknown"
  }

  private fun healthLabel(code: Int): String? = when (code) {
    BatteryManager.BATTERY_HEALTH_GOOD -> "Good"
    BatteryManager.BATTERY_HEALTH_OVERHEAT -> "Overheat"
    BatteryManager.BATTERY_HEALTH_DEAD -> "Dead"
    BatteryManager.BATTERY_HEALTH_OVER_VOLTAGE -> "Over voltage"
    BatteryManager.BATTERY_HEALTH_UNSPECIFIED_FAILURE -> "Unspecified failure"
    BatteryManager.BATTERY_HEALTH_COLD -> "Cold"
    else -> null
  }

  private fun cycleCount(intent: Intent): Int? {
    if (!intent.hasExtra(BatteryManager.EXTRA_CYCLE_COUNT)) return null
    val extra = intent.getIntExtra(BatteryManager.EXTRA_CYCLE_COUNT, -1)
    return if (extra >= 0) extra else null
  }
}
