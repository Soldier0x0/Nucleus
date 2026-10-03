/** Greeting uses the name stored in the open document. An empty name stays a plain greeting. */
export function cleanCallName(raw: string) {
  return raw.replace(/[\u0000-\u001f]/g, "").replace(/\s+/g, " ").trim().slice(0, 40);
}

export function greetingLine(hour: number, name?: string) {
  const hello = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const clean = name ? cleanCallName(name) : "";
  return clean ? `${hello}, ${clean}` : hello;
}
