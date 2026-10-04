export type NoticeKind = "bill" | "fuel" | "service" | "backup" | "emergency";

export type NoticePresentation = {
  ongoing: boolean;
  sticky: boolean;
  dismissClears: boolean;
  dismissOpensApp: boolean;
};

/** Ordinary reminders can be dismissed. The emergency card stays while its switch is on. */
export function noticePresentation(kind: NoticeKind): NoticePresentation {
  switch (kind) {
    case "emergency":
      return { ongoing: true, sticky: true, dismissClears: false, dismissOpensApp: false };
    case "bill":
    case "fuel":
    case "service":
    case "backup":
      return { ongoing: false, sticky: false, dismissClears: true, dismissOpensApp: false };
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}

export function noticeKindFromId(id: string): Exclude<NoticeKind, "emergency"> | null {
  if (id.startsWith("bill:")) return "bill";
  if (id.startsWith("fuel:") || id.startsWith("ask:fuel:")) return "fuel";
  if (id.startsWith("service:")) return "service";
  if (id === "backup") return "backup";
  return null;
}

export function dismissNoticeAction() {
  return { identifier: "dismiss" as const, buttonTitle: "Dismiss", options: { opensAppToForeground: false as const } };
}
