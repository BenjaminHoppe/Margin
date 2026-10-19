import type { Study } from "./study";
export type Kind = "highlight" | "note" | "question";
export type Understanding =
  "unmarked" | "unclear" | "partly understood" | "understood";
export const UNDERSTANDINGS: Understanding[] = [
  "unmarked",
  "unclear",
  "partly understood",
  "understood",
];
export type Rect = { x: number; y: number; width: number; height: number };
export type Anchor = { page: number; quote: string; rects: Rect[] };
export type Annotation = Anchor & {
  id: string;
  kind: Kind;
  body: string;
  understanding: Understanding;
  resolved: boolean;
  createdAt: string;
  updatedAt: string;
};
export type Draft = Anchor & {
  id?: string;
  kind: Kind;
  body: string;
  understanding: Understanding;
  resolved: boolean;
};
export type SavedState = {
  version: 1;
  annotations: Annotation[];
  draft: Draft | null;
  page: number;
  appearance: "light" | "dark";
};
export const storageKey = (documentId: string) => `margin:${documentId}:v1`;
const empty: SavedState = {
  version: 1,
  annotations: [],
  draft: null,
  page: 1,
  appearance: "light",
};
const validAnchor = (a: Anchor, pageCount: number) =>
  Number.isInteger(a.page) &&
  a.page >= 1 &&
  a.page <= pageCount &&
  typeof a.quote === "string" &&
  Array.isArray(a.rects) &&
  a.rects.length > 0 &&
  a.rects.every(
    (r) =>
      [r.x, r.y, r.width, r.height].every(Number.isFinite) &&
      r.x >= 0 &&
      r.y >= 0 &&
      r.width > 0 &&
      r.height > 0 &&
      r.x + r.width <= 1.01 &&
      r.y + r.height <= 1.01,
  );
const validDraft = (a: Draft, pageCount: number) =>
  validAnchor(a, pageCount) &&
  ["highlight", "note", "question"].includes(a.kind) &&
  typeof a.body === "string" &&
  UNDERSTANDINGS.includes(a.understanding) &&
  typeof a.resolved === "boolean";
export function readState(
  documentId: string,
  pageCount: number,
): { state: SavedState; error: string } {
  try {
    const raw = localStorage.getItem(storageKey(documentId));
    if (!raw) return { state: empty, error: "" };
    const parsed = JSON.parse(raw) as SavedState;
    if (
      parsed.version !== 1 ||
      !Array.isArray(parsed.annotations) ||
      !parsed.annotations.every(
        (a) => validDraft(a, pageCount) && typeof a.id === "string",
      ) ||
      (parsed.draft && !validDraft(parsed.draft, pageCount))
    )
      throw new Error("Invalid saved data");
    return {
      state: {
        ...parsed,
        page: Math.min(pageCount, Math.max(1, Number(parsed.page) || 1)),
        appearance: parsed.appearance === "dark" ? "dark" : "light",
      },
      error: "",
    };
  } catch {
    return {
      state: empty,
      error:
        "Your local notes could not be read. Existing browser data has been left untouched. Export any notes from your other tab before retrying.",
    };
  }
}
export function toMarkdown(
  annotations: Annotation[],
  study: Pick<Study, "title" | "subtitle" | "sourceUrl" | "fileName">,
) {
  const parts = [
    `# ${study.title}`,
    study.subtitle,
    study.sourceUrl ?? `Source file: ${study.fileName}`,
  ];
  for (const a of [...annotations].sort(
    (a, b) => a.page - b.page || a.rects[0].y - b.rects[0].y,
  )) {
    parts.push(
      `## ${a.kind[0].toUpperCase() + a.kind.slice(1)} · page ${a.page}`,
      a.quote
        .split("\n")
        .map((l) => `> ${l}`)
        .join("\n"),
      a.body,
      `Understanding: ${a.understanding}${a.kind === "question" ? ` · ${a.resolved ? "Resolved" : "Open"}` : ""}`,
    );
  }
  return parts.join("\n\n");
}

// Preserve edits when a user reopens the same marker, while allowing clean
// annotation previews to switch without an unnecessary discard step.
export function isDraftDirty(
  draft: Draft | null,
  annotations: Annotation[],
): boolean {
  if (!draft) return false;
  if (!draft.id)
    return (
      !!draft.body.trim() ||
      draft.understanding !== "unmarked" ||
      draft.resolved
    );
  const original = annotations.find((a) => a.id === draft.id);
  return (
    !original ||
    (["body", "kind", "understanding", "resolved"] as const).some(
      (key) => draft[key] !== original[key],
    )
  );
}
