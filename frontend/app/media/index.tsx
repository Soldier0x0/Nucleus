import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { deleteEntity } from "@/src/core/actions";
import type { MediaItem, MediaKind, MediaStatus } from "@/src/core/types";
import { num, uid } from "@/src/core/format";
import { Header } from "@/src/components/Header";
import { Button, Chip, ChipRow, EmptyState, Eyebrow, Icon, IconButton, Press, Segmented, T } from "@/src/components/ui";
import { Ring } from "@/src/components/charts";
import { Sheet } from "@/src/components/Sheet";
import { Field } from "@/src/components/inputs";
import { useToast } from "@/src/components/Toast";
import { ModuleGate } from "@/src/components/ModuleGate";

const KINDS: { id: MediaKind; label: string; icon: string }[] = [
  { id: "movie", label: "Films", icon: "movie-open-outline" },
  { id: "series", label: "Series", icon: "television-classic" },
  { id: "book", label: "Books", icon: "book-open-page-variant-outline" },
  { id: "game", label: "Games", icon: "gamepad-variant-outline" },
  { id: "other", label: "Other", icon: "shape-outline" },
];
const STATUS: { id: MediaStatus; label: string }[] = [
  { id: "backlog", label: "Want to" },
  { id: "active", label: "In progress" },
  { id: "done", label: "Finished" },
  { id: "dropped", label: "Dropped" },
];
const kindMeta = (k: MediaKind) => KINDS.find((x) => x.id === k)!;
const blank = (kind: MediaKind): MediaItem => ({ id: uid(), kind, title: "", status: "backlog", progress: 0, rating: 0, tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

export default function Media() {
  const { db } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<MediaKind | "all">("all");
  const [status, setStatus] = useState<MediaStatus | "all">("all");
  const [edit, setEdit] = useState<MediaItem | null>(null);

  const list = useMemo(
    () => db.media.filter((m) => (kind === "all" || m.kind === kind) && (status === "all" || m.status === status)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [db.media, kind, status],
  );
  const finished = db.media.filter((m) => m.status === "done");
  const avg = finished.filter((m) => m.rating > 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Media" testID="media-header" right={<IconButton icon="plus" label="Add to shelf" testID="media-add-button" onPress={() => setEdit(blank(kind === "all" ? "movie" : kind))} />} />
      <ChipRow testID="media-kind-row">
        <Chip label="Everything" selected={kind === "all"} testID="media-kind-all" onPress={() => setKind("all")} />
        {KINDS.map((k) => (
          <Chip key={k.id} label={k.label} icon={k.icon} selected={kind === k.id} testID={`media-kind-${k.id}`} onPress={() => setKind(k.id)} />
        ))}
      </ChipRow>
      <View style={{ paddingHorizontal: sp.lg, paddingBottom: 8 }}>
        <Segmented testID="media-status" value={status} onChange={setStatus} options={[{ value: "all", label: "All" }, ...STATUS.map((s) => ({ value: s.id, label: s.label }))]} />
      </View>
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingTop: 4, paddingBottom: insets.bottom + 24, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {db.media.length ? (
          <Eyebrow style={{ marginBottom: 10 }} testID="media-summary">
            {db.media.length} on the shelf · {finished.length} finished{avg.length ? ` · ${num(avg.reduce((s, m) => s + m.rating, 0) / avg.length, 1)}★ average` : ""}
          </Eyebrow>
        ) : null}
        {list.length === 0 ? (
          <EmptyState
            testID="media-empty"
            icon="filmstrip-box-multiple"
            title={db.media.length ? "Nothing in this filter" : "Your shelf is empty"}
            body={db.media.length ? "Try another type or status." : "Keep track of what you're watching, reading and playing — progress, rating and a few words for later."}
            action={db.media.length ? undefined : <Button label="Add the first one" icon="plus" testID="media-empty-add" onPress={() => setEdit(blank("movie"))} />}
          />
        ) : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: sp.md }}>
          {list.map((m) => (
            <Press key={m.id} testID={`media-card-${m.id}`} onPress={() => setEdit(m)} style={[styles.card, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
              {m.cover ? <Image source={{ uri: m.cover }} style={styles.cover} contentFit="cover" accessibilityLabel="" /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Ring value={m.status === "done" ? 1 : m.progress / 100} size={46} stroke={5}>
                  <Icon name={kindMeta(m.kind).icon} size={18} color={colors.muted} />
                </Ring>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="label" numberOfLines={2}>
                    {m.title || "Untitled"}
                  </T>
                  <T muted style={{ fontSize: 11 }}>
                    {STATUS.find((s) => s.id === m.status)!.label}
                    {m.status === "active" ? ` · ${m.progress}%` : ""}
                  </T>
                </View>
              </View>
              {m.rating > 0 ? (
                <View style={{ flexDirection: "row", gap: 2, marginTop: 8 }}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Icon key={i} name={i <= m.rating ? "star" : "star-outline"} size={13} color={i <= m.rating ? colors.brandPrimary : colors.muted} />
                  ))}
                </View>
              ) : null}
              {m.tags.length ? (
                <T muted style={{ fontSize: 11, marginTop: 6 }} numberOfLines={1}>
                  {m.tags.join(" · ")}
                </T>
              ) : null}
            </Press>
          ))}
        </View>
      </ScrollView>
      {edit ? <MediaSheet item={edit} onClose={() => setEdit(null)} /> : null}
      <ModuleGate id="media" name="Media" icon="filmstrip-box-multiple" />
    </View>
  );
}

function MediaSheet({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const { db, update } = useStore();
  const { colors } = useTheme();
  const toast = useToast();
  const [kind, setKind] = useState<MediaKind>(item.kind);
  const [title, setTitle] = useState(item.title);
  const [status, setStatus] = useState<MediaStatus>(item.status);
  const [progress, setProgress] = useState(item.progress);
  const [rating, setRating] = useState(item.rating);
  const [review, setReview] = useState(item.review ?? "");
  const [tags, setTags] = useState(item.tags.join(", "));
  const [cover, setCover] = useState(item.cover);
  const exists = db.media.some((m) => m.id === item.id);
  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [2, 3], quality: 0.35, base64: true });
    if (result.canceled || !result.assets[0]?.base64) return;
    if (result.assets[0].base64.length > 140000) {
      toast("That photo is too large. Crop a smaller one.", "alert-circle-outline");
      return;
    }
    setCover(`data:image/jpeg;base64,${result.assets[0].base64}`);
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title={exists ? "Edit shelf item" : "Add to shelf"}
      testID="media-sheet"
      footer={
        <Button
          label="Save"
          icon="check"
          testID="media-save-button"
          onPress={() => {
            const next: MediaItem = { ...item, kind, title: title.trim() || "Untitled", status, progress: status === "done" ? 100 : progress, rating, review: review.trim() || undefined, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), cover, updatedAt: new Date().toISOString() };
            update((d) => ({ ...d, media: exists ? d.media.map((m) => (m.id === next.id ? next : m)) : [next, ...d.media] }));
            toast("Shelf updated", "filmstrip-box-multiple");
            onClose();
          }}
        />
      }
    >
      <Eyebrow style={{ marginBottom: 8 }}>Type</Eyebrow>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        {KINDS.map((k) => (
          <Chip key={k.id} label={k.label} icon={k.icon} selected={kind === k.id} testID={`media-sheet-kind-${k.id}`} onPress={() => setKind(k.id)} />
        ))}
      </View>
      {cover ? <Image source={{ uri: cover }} style={{ width: "100%", height: 160, borderRadius: radius.md, marginBottom: 12 }} contentFit="cover" /> : null}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <Button small kind="secondary" icon="image-outline" label={cover ? "Change photo" : "Choose a photo"} testID="media-cover-button" onPress={pickCover} />
        {cover ? <Button small kind="ghost" label="Remove photo" testID="media-cover-clear" onPress={() => setCover(undefined)} /> : null}
      </View>
      <Field label="Title" testID="media-title-input" value={title} onChangeText={setTitle} placeholder="Name of the film, book, game…" />
      <Eyebrow style={{ marginBottom: 8 }}>Status</Eyebrow>
      <Segmented testID="media-sheet-status" value={status} onChange={setStatus} options={STATUS.map((s) => ({ value: s.id, label: s.label }))} />
      {status === "active" ? (
        <View style={{ marginTop: 14 }}>
          <Eyebrow style={{ marginBottom: 8 }}>Progress · {progress}%</Eyebrow>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {[0, 10, 25, 50, 75, 90].map((p) => (
              <Chip key={p} label={`${p}%`} selected={progress === p} testID={`media-progress-${p}`} onPress={() => setProgress(p)} />
            ))}
          </View>
        </View>
      ) : null}
      <Eyebrow style={{ marginTop: 16, marginBottom: 8 }}>Your rating</Eyebrow>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Press key={i} testID={`media-rating-${i}`} onPress={() => setRating(rating === i ? 0 : i)}>
            <Icon name={i <= rating ? "star" : "star-outline"} size={30} color={i <= rating ? colors.brandPrimary : colors.muted} />
          </Press>
        ))}
      </View>
      <View style={{ height: 14 }} />
      <Field label="A few words for later" testID="media-review-input" value={review} onChangeText={setReview} multiline style={{ minHeight: 80 }} />
      <Field label="Tags (comma separated)" testID="media-tags-input" value={tags} onChangeText={setTags} placeholder="sci-fi, rewatch" />
      {exists ? (
        <Button
          kind="danger"
          small
          icon="delete-outline"
          label="Remove from shelf"
          testID="media-delete-button"
          style={{ marginTop: 8 }}
          onPress={() => {
            update((d) => deleteEntity(d, { kind: "media", id: item.id }));
            onClose();
          }}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: { width: "48%", flexGrow: 1, borderWidth: 1, borderRadius: radius.lg, padding: 12 },
  cover: { width: "100%", height: 132, borderRadius: radius.md, marginBottom: 10 },
});
