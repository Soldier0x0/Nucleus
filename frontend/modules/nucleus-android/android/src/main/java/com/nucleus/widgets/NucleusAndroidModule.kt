package com.nucleus.widgets

import android.accounts.Account
import android.accounts.AccountManager
import android.accounts.OperationCanceledException
import android.app.Activity
import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import expo.modules.kotlin.activityresult.AppContextActivityResultContract
import expo.modules.kotlin.activityresult.AppContextActivityResultLauncher
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.withTimeoutOrNull
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
  private val phoneLocked = AtomicBoolean(false)
  private var saveLauncher: AppContextActivityResultLauncher<String, Boolean>? = null
  private var accountLauncher: AppContextActivityResultLauncher<String, PickedAccount?>? = null
  private var consentLauncher: AppContextActivityResultLauncher<String, Boolean>? = null
  private var pendingConsent: Intent? = null
  private val main = android.os.Handler(android.os.Looper.getMainLooper())
  private val screenOff = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == Intent.ACTION_SCREEN_OFF) phoneLocked.set(true)
    }
  }
  private val bankReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      try {
        sendEvent("onBank", mapOf("type" to "line"))
      } catch (_: Throwable) {
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("NucleusAndroid")
    Events("onLan", "onBank")

    OnCreate {
      val ctx = appContext.reactContext ?: return@OnCreate
      val filter = IntentFilter(Intent.ACTION_SCREEN_OFF)
      val bank = IntentFilter(BANK_ACTION)
      if (Build.VERSION.SDK_INT >= 33) {
        ctx.registerReceiver(screenOff, filter, Context.RECEIVER_NOT_EXPORTED)
        ctx.registerReceiver(bankReceiver, bank, Context.RECEIVER_NOT_EXPORTED)
      } else {
        ctx.registerReceiver(screenOff, filter)
        ctx.registerReceiver(bankReceiver, bank)
      }
    }

    OnDestroy {
      try {
        appContext.reactContext?.unregisterReceiver(screenOff)
      } catch (_: Exception) {
      }
      try {
        appContext.reactContext?.unregisterReceiver(bankReceiver)
      } catch (_: Exception) {
      }
    }

    RegisterActivityContracts {
      saveLauncher = registerForActivityResult(SaveLockedFileContract())
      accountLauncher = registerForActivityResult(ChooseAccountContract())
      consentLauncher = registerForActivityResult(ConsentContract())
    }

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

    Function("consumePhoneLock") {
      val ctx = appContext.reactContext ?: return@Function mapOf("deviceLocked" to false, "screenTurnedOff" to false)
      val keyguard = ctx.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      val deviceLocked = keyguard.isDeviceLocked
      val screenTurnedOff = phoneLocked.getAndSet(false)
      mapOf("deviceLocked" to deviceLocked, "screenTurnedOff" to screenTurnedOff)
    }

    Function("clearIconRestart") {
      val ctx = appContext.reactContext ?: return@Function Unit
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(ICON_RESTART).commit()
      Unit
    }

    Function("consumeIconRestart") {
      val ctx = appContext.reactContext ?: return@Function false
      val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val marked = prefs.getBoolean(ICON_RESTART, false)
      if (!marked) return@Function false
      prefs.edit().remove(ICON_RESTART).commit()
      val keyguard = ctx.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      val locked = keyguard.isKeyguardLocked || phoneLocked.getAndSet(false)
      !locked
    }

    Function("readBankNotices") {
      val ctx = appContext.reactContext ?: return@Function "[]"
      BankNotices.drain(ctx)
    }

    Function("notificationAccess") {
      val ctx = appContext.reactContext ?: return@Function false
      bankListenerEnabled(ctx)
    }

    Function("openNotificationListener") {
      val ctx = appContext.reactContext ?: return@Function "blocked"
      try {
        ctx.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        "opened"
      } catch (_: Exception) {
        "blocked"
      }
    }

    AsyncFunction("readSms") {
      val ctx = appContext.reactContext ?: return@AsyncFunction "[]"
      if (ctx.checkSelfPermission(android.Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) return@AsyncFunction "[]"
      val cursor = ctx.contentResolver.query(Uri.parse("content://sms/inbox"), arrayOf("address", "body", "date"), null, null, "date DESC")
        ?: return@AsyncFunction "[]"
      val arr = org.json.JSONArray()
      cursor.use { rows ->
        var n = 0
        while (rows.moveToNext() && n < 40) {
          n += 1
          val item = org.json.JSONObject()
          item.put("sender", rows.getString(0) ?: "")
          item.put("body", rows.getString(1) ?: "")
          item.put("at", rows.getLong(2).toString())
          arr.put(item)
        }
      }
      arr.toString()
    }

    Function("installedVersion") {
      val ctx = appContext.reactContext ?: return@Function ""
      try {
        val info = if (Build.VERSION.SDK_INT >= 33) {
          ctx.packageManager.getPackageInfo(ctx.packageName, PackageManager.PackageInfoFlags.of(0))
        } else {
          @Suppress("DEPRECATION")
          ctx.packageManager.getPackageInfo(ctx.packageName, 0)
        }
        info.versionName ?: ""
      } catch (_: Exception) {
        ""
      }
    }

    Function("showLockCard") { title: String, body: String ->
      val ctx = appContext.reactContext ?: return@Function
      val manager = ctx.getSystemService(NotificationManager::class.java) ?: return@Function
      if (Build.VERSION.SDK_INT >= 26) {
        val channel = NotificationChannel(LOCK_CARD_CHANNEL, "Emergency card", NotificationManager.IMPORTANCE_HIGH)
        channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        channel.setSound(null, null)
        channel.enableVibration(false)
        manager.createNotificationChannel(channel)
      }
      val notification = if (Build.VERSION.SDK_INT >= 26) {
        Notification.Builder(ctx, LOCK_CARD_CHANNEL)
          .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
          .setContentTitle(title.take(40))
          .setContentText(body.take(120))
          .setVisibility(Notification.VISIBILITY_PUBLIC)
          .setOngoing(true)
          .setOnlyAlertOnce(true)
          .build()
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(ctx)
          .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
          .setContentTitle(title.take(40))
          .setContentText(body.take(120))
          .setVisibility(Notification.VISIBILITY_PUBLIC)
          .setPriority(Notification.PRIORITY_HIGH)
          .setOngoing(true)
          .build()
      }
      manager.notify(LOCK_CARD_ID, notification)
    }

    Function("hideLockCard") {
      val ctx = appContext.reactContext ?: return@Function Unit
      ctx.getSystemService(NotificationManager::class.java)?.cancel(LOCK_CARD_ID)
    }

    AsyncFunction("writeLockedFile") Coroutine { path: String ->
      val ctx = appContext.reactContext ?: return@Coroutine false
      val existing = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(CLOUD_FILE, null)
      if (!existing.isNullOrBlank() && writeToUri(ctx, Uri.parse(existing), path)) return@Coroutine true
      val launcher = saveLauncher ?: return@Coroutine false
      launcher.launch(path)
    }

    AsyncFunction("storeLockedFile") Coroutine { provider: String, path: String ->
      storeChosenFile(provider, path)
    }

    Function("forgetCloudFile") {
      val ctx = appContext.reactContext ?: return@Function Unit
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(CLOUD_FILE).remove(DRIVE_FILE_ID).apply()
    }

    Function("publishCycle") { json: String ->
      val ctx = appContext.reactContext ?: return@Function
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(CYCLE, json).apply()
      WidgetRender.refresh(ctx)
    }

    Function("setLauncherIcon") { name: String ->
      val ctx = appContext.reactContext ?: return@Function
      if (name !in LAUNCHER_ALIASES) return@Function
      val pm = ctx.packageManager
      val pkg = ctx.packageName
      // Rewriting an alias restarts this activity. Leave it alone when the picture is already the one showing.
      if (launcherAliasUnchanged(pm, pkg, name)) return@Function
      rememberIconRestart(ctx)
      if (!componentEnabled(pm, pkg, name)) {
        pm.setComponentEnabledSetting(ComponentName(pkg, "$pkg.$name"), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP)
      }
      for (alias in LAUNCHER_ALIASES) {
        if (alias == name) continue
        if (!componentEnabled(pm, pkg, alias)) continue
        pm.setComponentEnabledSetting(ComponentName(pkg, "$pkg.$alias"), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP)
      }
    }
  }

  private fun rememberIconRestart(ctx: Context) {
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(ICON_RESTART, true).commit()
  }

  private suspend fun storeChosenFile(provider: String, path: String): Map<String, Any> {
    val label = when (provider) {
      "drive" -> "Drive"
      "onedrive" -> "OneDrive"
      else -> return stopped("Drive", "choose Drive or OneDrive first")
    }
    val ctx = appContext.reactContext ?: return stopped(label, "sign-in runs in the installed Android app")
    val launcher = accountLauncher ?: return stopped(label, "sign-in could not open")
    val type = if (provider == "onedrive") "com.microsoft.msa" else "com.google"
    val picked = try {
      withTimeoutOrNull(180_000) { launcher.launch(type) }
    } catch (_: Exception) {
      null
    }
    if (picked == null) return stopped(label, "cancelled")
    val bytes = readLocal(ctx, path)
    if (bytes.isEmpty()) return stopped(label, "the locked file is empty")
    val scope = if (provider == "onedrive") {
      "https://graph.microsoft.com/Files.ReadWrite.AppFolder"
    } else {
      "https://www.googleapis.com/auth/drive.file"
    }
    val account = Account(picked.name, picked.type)
    val token = try {
      tokenFor(account, scope)
    } catch (_: OperationCanceledException) {
      return stopped(label, "cancelled")
    } catch (e: Exception) {
      return stopped(label, clipReason(e.message))
    }
    if (token.isNullOrBlank()) return stopped(label, "sign-in could not open")
    var uploaded = uploadLockedBytes(ctx, provider, token, bytes)
    if (uploaded.code == 401) {
      AccountManager.get(ctx).invalidateAuthToken(account.type, token)
      val again = try {
        tokenFor(account, scope)
      } catch (_: Exception) {
        null
      }
      if (again.isNullOrBlank()) return stopped(label, "sign-in could not open")
      uploaded = uploadLockedBytes(ctx, provider, again, bytes)
    }
    if (uploaded.ok) return mapOf("ok" to true, "message" to "")
    val detail = if (uploaded.code == 0) "network" else uploaded.code.toString()
    return stopped(label, detail)
  }

  private suspend fun tokenFor(account: Account, scope: String): String? {
    val ctx = appContext.reactContext ?: return null
    val am = AccountManager.get(ctx)
    val activity = appContext.currentActivity
    val tokenType = "oauth2:$scope"
    try {
      val future = if (activity != null) {
        @Suppress("DEPRECATION")
        am.getAuthToken(account, tokenType, null, activity, null, null)
      } else {
        am.getAuthToken(account, tokenType, null, false, null, null)
      }
      val bundle = future.getResult(3, TimeUnit.MINUTES)
      val token = bundle.getString(AccountManager.KEY_AUTHTOKEN)
      if (!token.isNullOrBlank()) return token
      val intent = consentIntent(bundle) ?: return null
      return consentThenToken(am, account, tokenType, intent)
    } catch (e: Exception) {
      val intent = recoverableIntent(e) ?: throw e
      return consentThenToken(am, account, tokenType, intent)
    }
  }

  /** The compile SDK omits this accounts type. The device still throws it, with a consent intent. */
  private fun recoverableIntent(error: Throwable): Intent? {
    var type: Class<*>? = error.javaClass
    while (type != null) {
      if (type.name == "android.accounts.UserRecoverableAuthException") {
        return try {
          type.getMethod("getIntent").invoke(error) as? Intent
        } catch (_: Exception) {
          null
        }
      }
      type = type.superclass
    }
    return null
  }

  private suspend fun consentThenToken(am: AccountManager, account: Account, tokenType: String, intent: Intent): String? {
    val launcher = consentLauncher ?: return null
    pendingConsent = intent
    val ok = try {
      withTimeoutOrNull(180_000) { launcher.launch("consent") } == true
    } catch (_: Exception) {
      false
    }
    if (!ok) return null
    val bundle = am.getAuthToken(account, tokenType, null, false, null, null).getResult(30, TimeUnit.SECONDS)
    return bundle.getString(AccountManager.KEY_AUTHTOKEN)
  }

  private fun consentIntent(bundle: Bundle): Intent? {
    return if (Build.VERSION.SDK_INT >= 33) bundle.getParcelable(AccountManager.KEY_INTENT, Intent::class.java)
    else {
      @Suppress("DEPRECATION")
      bundle.getParcelable<Intent>(AccountManager.KEY_INTENT)
    }
  }

  private fun launcherAliasUnchanged(pm: PackageManager, pkg: String, name: String): Boolean {
    for (alias in LAUNCHER_ALIASES) {
      val on = componentEnabled(pm, pkg, alias)
      if (alias == name && !on) return false
      if (alias != name && on) return false
    }
    return true
  }

  /** COMPONENT_ENABLED_STATE_DEFAULT follows the manifest: only IconPaperPaper starts enabled. */
  private fun componentEnabled(pm: PackageManager, pkg: String, alias: String): Boolean {
    return when (pm.getComponentEnabledSetting(ComponentName(pkg, "$pkg.$alias"))) {
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED_USER,
      PackageManager.COMPONENT_ENABLED_STATE_DISABLED_UNTIL_USED -> false
      else -> alias == "IconPaperPaper"
    }
  }

  private inner class ConsentContract : AppContextActivityResultContract<String, Boolean> {
    override fun createIntent(context: Context, input: String): Intent {
      return pendingConsent ?: Intent(Settings.ACTION_SETTINGS)
    }

    override fun parseResult(input: String, resultCode: Int, intent: Intent?): Boolean {
      pendingConsent = null
      return resultCode == Activity.RESULT_OK
    }
  }

  private inner class SaveLockedFileContract : AppContextActivityResultContract<String, Boolean> {
    override fun createIntent(context: Context, input: String): Intent {
      return Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = "application/json"
        putExtra(Intent.EXTRA_TITLE, "nucleus-locked.json")
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)
      }
    }

    override fun parseResult(input: String, resultCode: Int, intent: Intent?): Boolean {
      if (resultCode != Activity.RESULT_OK) return false
      val uri = intent?.data ?: return false
      val ctx = appContext.reactContext ?: return false
      val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
      return try {
        ctx.contentResolver.takePersistableUriPermission(uri, flags)
        val ok = writeToUri(ctx, uri, input)
        if (ok) ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(CLOUD_FILE, uri.toString()).apply()
        ok
      } catch (_: Exception) {
        false
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

private const val LOCK_CARD_CHANNEL = "nucleus-lock-card"
private const val LOCK_CARD_ID = 704
private const val CLOUD_FILE = "cloud_file_uri"
private const val ICON_RESTART = "icon_restart_unlocked"

private fun stopped(label: String, reason: String): Map<String, Any> {
  return mapOf("ok" to false, "message" to "$label did not store the file ($reason).")
}

private fun clipReason(raw: String?): String {
  val text = raw?.replace(Regex("\\s+"), " ")?.trim().orEmpty()
  if (text.isEmpty()) return "did not finish"
  return text.take(80)
}

private data class PickedAccount(val name: String, val type: String)

private class ChooseAccountContract : AppContextActivityResultContract<String, PickedAccount?> {
  override fun createIntent(context: Context, input: String): Intent {
    @Suppress("DEPRECATION")
    return AccountManager.newChooseAccountIntent(null, null, arrayOf(input), "Sign in to store the locked file", null, null, null)
  }

  override fun parseResult(input: String, resultCode: Int, intent: Intent?): PickedAccount? {
    if (resultCode != Activity.RESULT_OK || intent == null) return null
    val name = intent.getStringExtra(AccountManager.KEY_ACCOUNT_NAME)?.trim().orEmpty()
    if (name.isEmpty()) return null
    val type = intent.getStringExtra(AccountManager.KEY_ACCOUNT_TYPE)?.trim().orEmpty().ifBlank { input }
    return PickedAccount(name, type)
  }
}

private fun writeToUri(ctx: Context, uri: Uri, path: String): Boolean {
  return try {
    val bytes = readLocal(ctx, path)
    if (bytes.isEmpty()) return false
    ctx.contentResolver.openOutputStream(uri, "wt")?.use { stream ->
      stream.write(bytes)
      true
    } ?: false
  } catch (_: Exception) {
    false
  }
}

private fun readLocal(ctx: Context, path: String): ByteArray {
  if (path.startsWith("content://")) {
    return ctx.contentResolver.openInputStream(Uri.parse(path))?.use { it.readBytes() } ?: ByteArray(0)
  }
  val filePath = if (path.startsWith("file://")) Uri.parse(path).path ?: return ByteArray(0) else path
  val file = java.io.File(filePath)
  if (!file.isFile) return ByteArray(0)
  return file.readBytes()
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
