export function bankAccessPrompt(): { line: string; blockedLine: string; grantsItself: false } {
  return {
    line: "Turn Nucleus on in notification access.",
    blockedLine: "If Android blocks that screen, allow restricted settings from the Nucleus app info menu first.",
    grantsItself: false,
  };
}
