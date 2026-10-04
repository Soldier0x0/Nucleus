/** Adaptive launcher icon. Android masks this. The ground is opaque and not white. */
const GROUND = {
  paper: "#F3EDE4",
  midnight: "#0B0D12",
  dune: "#E7D3B5",
  amoled: "#000000",
};

function iconPlan(family, variant) {
  const background = GROUND[variant];
  if (!background) throw new Error(`Unknown launcher variant ${variant}`);
  return {
    kind: "adaptive",
    masked: true,
    transparent: false,
    emptyCanvas: false,
    background,
    foreground: `ic_${family}_${variant}_fg`,
    resource: `ic_${family}_${variant}`,
  };
}

function adaptiveIconXml(plan) {
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">',
    `  <background android:drawable="@color/${plan.resource}" />`,
    `  <foreground android:drawable="@mipmap/${plan.foreground}" />`,
    "</adaptive-icon>",
    "",
  ].join("\n");
}

module.exports = { iconPlan, adaptiveIconXml, GROUND };
