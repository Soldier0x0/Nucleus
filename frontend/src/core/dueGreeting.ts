import { greetingLine } from "./greeting";

/** The one thing due today. Later items wait. */
export function oneDueToday(items: { title: string; date: string }[], today: string): { title: string } | null {
  const due = items.filter((item) => item.date === today).sort((a, b) => a.title.localeCompare(b.title));
  if (!due.length) return null;
  return { title: due[0].title };
}

export function homeLine(hour: number, name: string | undefined, dueTitle: string | null): string {
  if (dueTitle) return `${dueTitle} is due today`;
  return greetingLine(hour, name);
}
