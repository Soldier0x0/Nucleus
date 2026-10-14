export function bankAccessPrompt(): { line: string; blockedLine: string; grantsItself: false } {
  return {
    line: "A file install needs Allow restricted settings first, then notification access. Turn Nucleus on in notification access. Nucleus reads those notifications, not SMS.",
    blockedLine: "If Android blocks that screen, allow restricted settings from the Nucleus app info menu first.",
    grantsItself: false,
  };
}

/** After the person asked, a return with access already on keeps bank texts. The app does not grant that access. */
/**
 * v0.9.8 (plan 5.5): notification access is on but the switch is off and the person never turned it
 * off themselves, so turn the switch on from the root, not only from Settings.
 */
export function bankInboxAutoOn(input: { accessOn: boolean; inboxOn: boolean; turnedOff: boolean }): boolean {
  return input.accessOn && !input.inboxOn && !input.turnedOff;
}

export function bankInboxAfterReturn(input: { asked: boolean; accessOn: boolean; inboxOn: boolean }): boolean {
  if (input.inboxOn) return true;
  return input.asked && input.accessOn;
}
