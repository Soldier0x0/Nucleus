const { withMainActivity, withAndroidManifest, AndroidConfig } = require("@expo/config-plugins");

/**
 * Sharing a line of text into Nucleus. Android's SEND intent is rewritten into
 * nucleus://capture?text=… before React Native reads the launch intent, so the
 * capture bar receives the exact string. Parsing stays in the capture grammar.
 */
function withTextShare(config) {
  config = withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const filters = activity["intent-filter"] ?? [];
    const has = filters.some((f) => JSON.stringify(f).includes("android.intent.action.SEND"));
    if (!has) {
      filters.push({
        action: [{ $: { "android:name": "android.intent.action.SEND" } }],
        category: [{ $: { "android:name": "android.intent.category.DEFAULT" } }],
        data: [{ $: { "android:mimeType": "text/plain" } }],
      });
      activity["intent-filter"] = filters;
    }
    return cfg;
  });

  return withMainActivity(config, (cfg) => {
    if (cfg.modResults.language !== "kt") return cfg;
    let src = cfg.modResults.contents;
    if (src.includes("rewriteShare")) return cfg;
    const helper = `
  private fun rewriteShare(incoming: android.content.Intent?) {
    if (incoming?.action == android.content.Intent.ACTION_SEND && incoming.type?.startsWith("text/") == true) {
      val text = incoming.getStringExtra(android.content.Intent.EXTRA_TEXT) ?: return
      incoming.action = android.content.Intent.ACTION_VIEW
      incoming.data = android.net.Uri.parse("nucleus://capture?text=" + android.net.Uri.encode(text))
      incoming.removeExtra(android.content.Intent.EXTRA_TEXT)
    }
  }

  override fun onNewIntent(intent: android.content.Intent) {
    rewriteShare(intent)
    super.onNewIntent(intent)
    setIntent(intent)
  }
`;
    if (src.includes("super.onCreate(null)")) src = src.replace("super.onCreate(null)", "rewriteShare(intent)\n    super.onCreate(null)");
    else if (src.includes("super.onCreate(savedInstanceState)")) src = src.replace("super.onCreate(savedInstanceState)", "rewriteShare(intent)\n    super.onCreate(savedInstanceState)");
    else return cfg;
    if (src.includes("override fun getMainComponentName()")) src = src.replace("\n  override fun getMainComponentName()", `${helper}\n  override fun getMainComponentName()`);
    else src = src.replace(/\n}\s*$/, `${helper}\n}\n`);
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = withTextShare;
