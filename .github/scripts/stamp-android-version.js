const fs = require("fs");

const versionCode = Number(process.env.ANDROID_VERSION_CODE);
if (!Number.isInteger(versionCode) || versionCode < 1) {
  console.error("ANDROID_VERSION_CODE must be a positive integer.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync("app.json", "utf8"));
config.expo.android.versionCode = versionCode;
fs.writeFileSync("app.json", JSON.stringify(config, null, 2) + "\n");
console.log(`android.versionCode=${versionCode}`);
