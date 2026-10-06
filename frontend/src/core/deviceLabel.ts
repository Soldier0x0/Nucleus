/** Title-cases the first letter of each word and leaves the rest as the phone reported it. */
export function deviceMakeModel(manufacturer: string | null | undefined, model: string | null | undefined): string {
  const parts = [manufacturer, model]
    .flatMap((part) => (part ?? "").trim().split(/\s+/))
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1));
  return parts.length ? parts.join(" ") : "—";
}
