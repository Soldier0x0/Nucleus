import { useState } from "react";
import { useStore } from "@/src/core/store";
import { cleanCallName } from "@/src/core/greeting";
import { Field } from "./inputs";
import { Sheet } from "./Sheet";
import { Button, T } from "./ui";

/** One ask, after unlock, when an updated install has no name yet. */
export function NameAsk() {
  const { db, setSettings, session } = useStore();
  const [draft, setDraft] = useState("");
  const s = db.settings;
  if (session !== "real" || !s.onboarded || s.nameAsked || s.givenName) return null;
  const save = (name: string) => setSettings({ givenName: cleanCallName(name) || undefined, nameAsked: true });
  return (
    <Sheet visible title="What should I call you?" testID="name-ask-sheet" onClose={() => save(draft)} footer={<Button label="Save" testID="name-ask-save" onPress={() => save(draft)} />}>
      <T muted style={{ marginBottom: 12 }}>
        This is only for the greeting. A decoy PIN never shows it.
      </T>
      <Field label="Name" testID="name-ask-input" value={draft} onChangeText={setDraft} placeholder="Asha" autoCapitalize="words" />
      <Button kind="ghost" label="Not now" testID="name-ask-skip" onPress={() => save("")} />
    </Sheet>
  );
}
