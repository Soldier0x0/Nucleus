package com.nucleus.widgets

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Socket
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

/**
 * Home-screen widgets, icon shortcuts, and checks against a name the user typed
 * or this phone's own private subnet. Nothing here is stored.
 */
class NucleusAndroidModule : Module() {
  private val scanning = AtomicBoolean(false)
  private val main = android.os.Handler(android.os.Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("NucleusAndroid")
    Events("onLan")

    Function("publishSnapshot") { json: String ->
      val ctx = appContext.reactContext ?: return@Function
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(SNAPSHOT, json).apply()
      WidgetRender.refresh(ctx)
    }

    Function("setShortcuts") { json: String ->
      val ctx = appContext.reactContext ?: return@Function
      if (Build.VERSION.SDK_INT < 25) return@Function
      val manager = ctx.getSystemService(ShortcutManager::class.java) ?: return@Function
      val arr = try {
        JSONArray(json)
      } catch (_: Exception) {
        JSONArray()
      }
      val list = ArrayList<ShortcutInfo>()
      val count = minOf(arr.length(), 4)
      for (i in 0 until count) {
        val item = arr.optJSONObject(i) ?: continue
        val url = item.optString("url")
        if (!url.startsWith("nucleus://open?")) continue
        val id = item.optString("id").take(40).ifBlank { "shortcut-$i" }
        val label = item.optString("label").take(24).ifBlank { "Nucleus" }
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).setPackage(ctx.packageName)
        list.add(
          ShortcutInfo.Builder(ctx, id)
            .setShortLabel(label)
            .setLongLabel(label)
            .setIcon(Icon.createWithResource(ctx, R.drawable.shortcut_mark))
            .setIntent(intent)
            .build()
        )
      }
      try {
        manager.dynamicShortcuts = list
      } catch (_: Exception) {
      }
    }

    AsyncFunction("ping") { host: String ->
      val clean = cleanHost(host)
      val start = System.nanoTime()
      try {
        val reachable = InetAddress.getByName(clean).isReachable(1200)
        if (!reachable) Socket().use { it.connect(InetSocketAddress(clean, 443), 1200) }
        mapOf("ok" to true, "ms" to elapsed(start), "detail" to if (reachable) "The name answered" else "Port 443 answered")
      } catch (_: Exception) {
        mapOf("ok" to false, "ms" to elapsed(start), "detail" to "No reply")
      }
    }

    AsyncFunction("dns") { host: String ->
      val clean = cleanHost(host)
      val addresses = InetAddress.getAllByName(clean).mapNotNull { it.hostAddress }.distinct()
      mapOf("addresses" to addresses)
    }

    Function("startScan") {
      if (!scanning.compareAndSet(false, true)) return@Function false
      Thread {
        try {
          scan()
        } finally {
          scanning.set(false)
        }
      }.start()
      true
    }

    Function("stopScan") {
      scanning.set(false)
    }

    Function("setLauncherIcon") { name: String ->
      val ctx = appContext.reactContext ?: return@Function
      if (name !in LAUNCHER_ALIASES) return@Function
      val pm = ctx.packageManager
      val pkg = ctx.packageName
      // Enable the new picture first so the home screen never loses every icon.
      pm.setComponentEnabledSetting(ComponentName(pkg, "$pkg.$name"), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
      for (alias in LAUNCHER_ALIASES) {
        if (alias == name) continue
        pm.setComponentEnabledSetting(ComponentName(pkg, "$pkg.$alias"), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
      }
    }
  }

  private fun emit(body: Map<String, Any?>) {
    main.post {
      try {
        sendEvent("onLan", body)
      } catch (_: Throwable) {
      }
    }
  }

  private fun scan() {
    val mine = localPrivate()
    if (mine == null) {
      emit(mapOf("type" to "error", "message" to "This phone has no private network address. Join Wi-Fi and try again."))
      return
    }
    val prefix = mine.substringBeforeLast(".")
    val own = mine.substringAfterLast(".").toIntOrNull()
    val pool = Executors.newFixedThreadPool(24)
    val latch = CountDownLatch(254)
    val found = AtomicInteger(0)
    val checked = AtomicInteger(0)
    for (i in 1..254) {
      if (!scanning.get()) {
        latch.countDown()
        continue
      }
      if (i == own) {
        latch.countDown()
        continue
      }
      val ip = "$prefix.$i"
      pool.submit {
        try {
          if (scanning.get() && answers(ip)) {
            found.incrementAndGet()
            emit(mapOf("type" to "host", "ip" to ip))
          }
        } catch (_: Exception) {
        } finally {
          val n = checked.incrementAndGet()
          if (n % 16 == 0) emit(mapOf("type" to "progress", "checked" to n))
          latch.countDown()
        }
      }
    }
    latch.await(45, TimeUnit.SECONDS)
    pool.shutdownNow()
    emit(mapOf("type" to "done", "found" to found.get()))
  }

  private fun answers(ip: String): Boolean {
    val ports = intArrayOf(443, 80, 8080, 62078, 8008)
    for (port in ports) {
      if (!scanning.get()) return false
      try {
        Socket().use { socket ->
          socket.connect(InetSocketAddress(ip, port), 150)
          return true
        }
      } catch (_: Exception) {
      }
    }
    return false
  }
}

private val LAUNCHER_ALIASES = listOf(
  "IconPaperPaper",
  "IconPaperMidnight",
  "IconPaperDune",
  "IconPaperAmoled",
  "IconMetalPaper",
  "IconMetalMidnight",
  "IconMetalDune",
  "IconMetalAmoled",
  "IconGlassPaper",
  "IconGlassMidnight",
  "IconGlassDune",
  "IconGlassAmoled",
  "IconTilesPaper",
  "IconTilesMidnight",
  "IconTilesDune",
  "IconTilesAmoled",
)

private fun elapsed(start: Long) = ((System.nanoTime() - start) / 1_000_000).toInt()

private fun cleanHost(raw: String): String {
  val host = raw.trim().lowercase()
  if (host.length !in 1..253 || !host.matches(Regex("^[a-z0-9.-]+$")) || host.startsWith("-") || host.startsWith(".") || host.endsWith(".") || host.contains("..")) {
    throw IllegalArgumentException("Use a hostname or an IPv4 address.")
  }
  return host
}

private fun localPrivate(): String? {
  val interfaces = NetworkInterface.getNetworkInterfaces() ?: return null
  for (nif in interfaces) {
    if (!nif.isUp || nif.isLoopback) continue
    for (addr in nif.inetAddresses) {
      if (addr.isLoopbackAddress || addr !is Inet4Address) continue
      val host = addr.hostAddress ?: continue
      if (isPrivateLan(host)) return host
    }
  }
  return null
}

private fun isPrivateLan(ip: String): Boolean {
  val parts = ip.split(".").mapNotNull { it.toIntOrNull() }
  if (parts.size != 4) return false
  if (parts[0] == 10) return true
  if (parts[0] == 192 && parts[1] == 168) return true
  if (parts[0] == 172 && parts[1] in 16..31) return true
  return false
}
