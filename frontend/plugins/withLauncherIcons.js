const { withAndroidManifest, withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");
const { adaptiveIconXml, iconPlan } = require("./launcherIconPlan");

/**
 * Android cannot swap a launcher bitmap at runtime. Each picture is an
 * activity-alias; Nucleus enables one and disables the rest. MainActivity
 * itself stays enabled so the alias that targets it keeps working.
 * Alias names match launcherAlias() in src/core/launcher.ts.
 */
const FAMILIES = ["paper", "metal", "glass", "tiles"];
const VARIANTS = ["paper", "midnight", "dune", "amoled"];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const aliasName = (family, variant) => `.Icon${cap(family)}${cap(variant)}`;

function isLauncherFilter(filter) {
  const actions = filter.action ?? [];
  const cats = filter.category ?? [];
  const main = actions.some((a) => a.$?.["android:name"] === "android.intent.action.MAIN");
  const launcher = cats.some((c) => c.$?.["android:name"] === "android.intent.category.LAUNCHER");
  return main && launcher;
}

function withLauncherIcons(config) {
  config = withDangerousMod(config, [
    "android",
    (cfg) => {
      const res = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/res");
      const mipmap = path.join(res, "mipmap-xxxhdpi");
      const anydpi = path.join(res, "mipmap-anydpi-v26");
      const values = path.join(res, "values");
      fs.mkdirSync(mipmap, { recursive: true });
      fs.mkdirSync(anydpi, { recursive: true });
      fs.mkdirSync(values, { recursive: true });
      const srcDir = path.join(cfg.modRequest.projectRoot, "assets/launcher");
      const colors = ['<?xml version="1.0" encoding="utf-8"?>', "<resources>"];
      for (const family of FAMILIES) {
        for (const variant of VARIANTS) {
          const plan = iconPlan(family, variant);
          const png = path.join(srcDir, `${family}-${variant}.png`);
          fs.copyFileSync(png, path.join(mipmap, `${plan.resource}.png`));
          fs.copyFileSync(png, path.join(mipmap, `${plan.foreground}.png`));
          fs.writeFileSync(path.join(anydpi, `${plan.resource}.xml`), adaptiveIconXml(plan));
          colors.push(`  <color name="${plan.resource}">${plan.background}</color>`);
        }
      }
      colors.push("</resources>", "");
      fs.writeFileSync(path.join(values, "nucleus_launcher_colors.xml"), colors.join("\n"));
      return cfg;
    },
  ]);

  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity["intent-filter"] = (activity["intent-filter"] ?? []).filter((f) => !isLauncherFilter(f));
    const ours = new Set(FAMILIES.flatMap((family) => VARIANTS.map((variant) => aliasName(family, variant))));
    const kept = (app["activity-alias"] ?? []).filter((alias) => !ours.has(alias.$?.["android:name"]));
    const added = FAMILIES.flatMap((family) =>
      VARIANTS.map((variant) => ({
        $: {
          "android:name": aliasName(family, variant),
          "android:targetActivity": ".MainActivity",
          "android:enabled": family === "paper" && variant === "paper" ? "true" : "false",
          "android:exported": "true",
          "android:icon": `@mipmap/ic_${family}_${variant}`,
          "android:roundIcon": `@mipmap/ic_${family}_${variant}`,
          "android:label": "@string/app_name",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.intent.action.MAIN" } }],
            category: [{ $: { "android:name": "android.intent.category.LAUNCHER" } }],
          },
        ],
      })),
    );
    app["activity-alias"] = [...kept, ...added];
    return cfg;
  });
}

module.exports = withLauncherIcons;
