export type GalleryShot = { id: string; uri: string };

export function galleryShots(rows: { id: string; photo?: string }[]): GalleryShot[] {
  return rows.filter((row) => !!row.photo).map((row) => ({ id: row.id, uri: row.photo as string }));
}

export function stepGallery(index: number, count: number, direction: "next" | "prev"): { index: number; swiped: boolean } {
  if (count <= 0) return { index: 0, swiped: false };
  if (count === 1) return { index: 0, swiped: true };
  const delta = direction === "next" ? 1 : -1;
  return { index: (index + delta + count) % count, swiped: true };
}
