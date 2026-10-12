import { useMemo, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, useTheme } from "@/src/theme";
import { useStore } from "@/src/core/store";
import { uid } from "@/src/core/format";
import type { WikiPage } from "@/src/core/types";
import { backlinks, linkedTitles, pageByTitle } from "@/src/core/wiki";
import { Header } from "@/src/components/Header";
import { Button, Card, Chip, ChipRow, EmptyState, Eyebrow, IconButton, T } from "@/src/components/ui";
import { Sheet } from "@/src/components/Sheet";
import { Field } from "@/src/components/inputs";
import { useToast } from "@/src/components/Toast";
import { ModuleGate } from "@/src/components/ModuleGate";

const blank = (): WikiPage => ({ id: uid(), title: "", body: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });

export default function Wiki() {
  const { db, update } = useStore();
  const { colors, sp } = useTheme();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<WikiPage | null>(null);
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.wiki.filter((p) => !s || p.title.toLowerCase().includes(s) || p.body.toLowerCase().includes(s));
  }, [db.wiki, q]);

  const openTitle = (title: string) => {
    const found = pageByTitle(db.wiki, title);
    if (found) {
      setPage(found);
      return;
    }
    setPage({ ...blank(), title });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <Header title="Wiki" testID="wiki-header" right={<IconButton icon="plus" label="New page" testID="wiki-add" onPress={() => setPage(blank())} />} />
      <ScrollView contentContainerStyle={{ padding: sp.lg, paddingBottom: insets.bottom + 24, gap: 12, maxWidth: 720, width: "100%", alignSelf: "center" }}>
        {db.wiki.length > 3 ? (
          <TextInput testID="wiki-search" value={q} onChangeText={setQ} placeholder="Search pages" placeholderTextColor={colors.muted} style={{ height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.md, paddingHorizontal: 12, color: colors.onSurface }} />
        ) : null}
        {list.length === 0 ? (
          <EmptyState testID="wiki-empty" icon="book-open-variant" title={db.wiki.length ? "Nothing matches" : "No pages yet"} body="Write a page and link another with [[Page title]]." action={db.wiki.length ? undefined : <Button label="New page" icon="plus" testID="wiki-empty-add" onPress={() => setPage(blank())} />} />
        ) : (
          list.map((p) => (
            <Card key={p.id} testID={`wiki-page-${p.id}`} onPress={() => setPage(p)}>
              <T v="h2">{p.title || "Untitled"}</T>
              {p.body ? <T muted numberOfLines={2} style={{ marginTop: 4 }}>{p.body}</T> : null}
            </Card>
          ))
        )}
      </ScrollView>
      {page ? <PageSheet key={page.id} page={page} pages={db.wiki} onOpen={openTitle} onClose={() => setPage(null)} onSave={(next) => { update((d) => ({ ...d, wiki: d.wiki.some((p) => p.id === next.id) ? d.wiki.map((p) => (p.id === next.id ? next : p)) : [...d.wiki, next] })); setPage(null); }} onDelete={() => { update((d) => ({ ...d, wiki: d.wiki.filter((p) => p.id !== page.id) })); setPage(null); }} /> : null}
      <ModuleGate id="wiki" name="Wiki" icon="book-open-variant" />
    </View>
  );
}

function PageSheet({ page, pages, onClose, onSave, onDelete, onOpen }: { page: WikiPage; pages: WikiPage[]; onClose: () => void; onSave: (page: WikiPage) => void; onDelete: () => void; onOpen: (title: string) => void }) {
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const toast = useToast();
  const { colors } = useTheme();
  const links = linkedTitles(body);
  const incoming = backlinks(pages, title);
  return (
    <>
    <Sheet
      visible
      onClose={onClose}
      title={title.trim() || "Page"}
      testID="wiki-sheet"
      footer={<Button label="Save page" testID="wiki-save" disabled={!title.trim()} onPress={() => onSave({ ...page, title: title.trim(), body, updatedAt: new Date().toISOString() })} />}
    >
      <Field label="Title" value={title} onChangeText={setTitle} testID="wiki-title" />
      <T muted style={{ fontSize: 12, marginBottom: 6 }}>Link another page with [[Page title]].</T>
      {pages.some((p) => p.id === page.id) ? null : <T muted style={{ fontSize: 12, marginBottom: 6 }}>This page does not exist yet. Save page to create it.</T>}
      <TextInput testID="wiki-body" value={body} onChangeText={setBody} multiline placeholder="Write the page" placeholderTextColor={colors.muted} style={{ minHeight: 140, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, padding: 12, color: colors.onSurface, textAlignVertical: "top" }} />
      {links.length ? (
        <View style={{ marginTop: 12 }}>
          <Eyebrow>Links</Eyebrow>
          <ChipRow testID="wiki-links">
            {links.map((t) => <Chip key={t} label={t} testID={`wiki-link-${t}`} onPress={() => onOpen(t)} />)}
          </ChipRow>
        </View>
      ) : null}
      {incoming.length ? (
        <View style={{ marginTop: 12 }}>
          <Eyebrow>Backlinks</Eyebrow>
          {incoming.map((p) => <T key={p.id} style={{ marginTop: 6 }} onPress={() => onOpen(p.title)}>{p.title}</T>)}
        </View>
      ) : null}
      {pages.some((p) => p.id === page.id) ? <Button kind="danger" label="Delete page" testID="wiki-delete" onPress={() => setConfirmDelete(true)} style={{ marginTop: 16 }} /> : null}
    </Sheet>
    <Sheet visible={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this page?" testID="wiki-delete-sheet">
      <T style={{ marginBottom: 16 }}>"{title.trim() || page.title || "Untitled"}" will be removed, along with any backlinks to it.</T>
      <Button
        kind="danger"
        label="Delete page"
        icon="delete-outline"
        testID="wiki-delete-confirm"
        onPress={() => {
          setConfirmDelete(false);
          onDelete();
          toast("Page deleted", "delete-outline");
        }}
      />
    </Sheet>
    </>
  );
}
