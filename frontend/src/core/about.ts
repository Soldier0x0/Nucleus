/** The About row. The number is the version name stamped into the installed APK. */
export function aboutTitle(installedVersion: string): string {
  const version = installedVersion.trim();
  return version ? `Nucleus ${version}` : "Nucleus";
}
