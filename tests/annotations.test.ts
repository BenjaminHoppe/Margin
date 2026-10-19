import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeRects } from "../src/lib/selection";
import {
  readState,
  isDraftDirty,
  storageKey,
  toMarkdown,
  type Annotation,
} from "../src/lib/annotations";
import { MARS, NEPTUNE, documentId, filenameTitle } from "../src/lib/study";
const annotation: Annotation = {
  id: "one",
  page: 2,
  quote: "A selected passage",
  rects: [{ x: 0.1, y: 0.2, width: 0.4, height: 0.02 }],
  kind: "question",
  body: "How do these compare?",
  understanding: "unclear",
  resolved: false,
  createdAt: "2026-10-19T00:00:00Z",
  updatedAt: "2026-10-19T00:00:00Z",
};
test("duplicate PDF span and text rectangles collapse without joining separate lines", () => {
  const merged = mergeRects([
    { x: 0.1, y: 0.2, width: 0.2, height: 0.02 },
    { x: 0.1, y: 0.2, width: 0.1, height: 0.02 },
    { x: 0.2, y: 0.2, width: 0.15, height: 0.02 },
    { x: 0.1, y: 0.23, width: 0.3, height: 0.02 },
  ]);
  assert.equal(merged.length, 2);
  assert.ok(Math.abs(merged[0].width - 0.25) < 0.0001);
  assert.equal(merged[1].y, 0.23);
});
test("persistence restores passage anchors, question state, drafts, and page", () => {
  const state = {
    version: 1,
    annotations: [annotation],
    draft: { ...annotation, body: "Unsaved edit" },
    page: 2,
    appearance: "dark",
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) =>
        key === storageKey(MARS.id) ? JSON.stringify(state) : null,
    },
    configurable: true,
  });
  const restored = readState(MARS.id, MARS.pageCount);
  assert.equal(restored.error, "");
  assert.deepEqual(restored.state, state);
});
test("corrupt storage returns a recovery error instead of throwing", () => {
  Object.defineProperty(globalThis, "localStorage", {
    value: { getItem: () => "{broken" },
    configurable: true,
  });
  assert.match(readState(MARS.id, MARS.pageCount).error, /left untouched/);
});
test("invalid geometry is rejected rather than drawn on the wrong passage", () => {
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: () =>
        JSON.stringify({
          version: 1,
          annotations: [
            { ...annotation, rects: [{ x: 2, y: 0, width: 1, height: 1 }] },
          ],
        }),
    },
    configurable: true,
  });
  assert.ok(readState(MARS.id, MARS.pageCount).error);
});
test("Markdown preserves quote, page, independent understanding, and question status", () => {
  const markdown = toMarkdown(
    [
      annotation,
      {
        ...annotation,
        id: "two",
        page: 1,
        kind: "note",
        understanding: "understood",
      },
    ],
    MARS,
  );
  assert.ok(markdown.indexOf("page 1") < markdown.indexOf("page 2"));
  assert.match(markdown, /> A selected passage/);
  assert.match(markdown, /Understanding: unclear · Open/);
  assert.match(markdown, /How do these compare\?/);
});

test("draft protection distinguishes clean previews from body, kind, and understanding changes", () => {
  assert.equal(isDraftDirty({ ...annotation }, [annotation]), false);
  assert.equal(
    isDraftDirty({ ...annotation, body: "Edited" }, [annotation]),
    true,
  );
  assert.equal(
    isDraftDirty({ ...annotation, understanding: "understood" }, [annotation]),
    true,
  );
  assert.equal(
    isDraftDirty({ ...annotation, resolved: true }, [annotation]),
    true,
  );
  assert.equal(isDraftDirty(null, [annotation]), false);
});

test("Neptune accepts annotations and reading positions on all 116 pages", () => {
  const state = {
    version: 1,
    annotations: [{ ...annotation, page: 116 }],
    draft: null,
    page: 116,
    appearance: "light",
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) =>
        key === storageKey(NEPTUNE.id) ? JSON.stringify(state) : null,
    },
    configurable: true,
  });
  assert.equal(readState(NEPTUNE.id, 116).state.page, 116);
  assert.equal(readState(NEPTUNE.id, 116).state.annotations[0].page, 116);
  assert.deepEqual(readState(MARS.id, 39).state.annotations, []);
  assert.equal(readState(MARS.id, 39).state.page, 1);
});
test("the original Mars storage key is preserved and content hashes identify reselected files", () => {
  assert.equal(storageKey(MARS.id), "margin:arxiv-2501.05337:v1");
  assert.equal(documentId(MARS.hash), MARS.id);
  assert.equal(documentId(NEPTUNE.hash), NEPTUNE.id);
  assert.equal(documentId("abc"), "sha256-abc");
  assert.equal(filenameTitle("full_paper-v2.PDF"), "full paper v2");
});
test("export uses the selected document title and source", () => {
  const markdown = toMarkdown([{ ...annotation, page: 116 }], NEPTUNE);
  assert.match(markdown, /Neptune Odyssey/);
  assert.match(markdown, /page 116/);
  assert.doesNotMatch(markdown, /Martian|2501.05337/);
});

test("word fragments merge across spaces without joining columns or adjacent lines", () => {
  const merged = mergeRects([
    { x: 0.1, y: 0.2, width: 0.06, height: 0.02 },
    { x: 0.17, y: 0.2, width: 0.08, height: 0.02 },
    { x: 0.6, y: 0.2, width: 0.2, height: 0.02 },
    { x: 0.1, y: 0.23, width: 0.15, height: 0.02 },
  ]);
  assert.equal(merged.length, 3);
  assert.ok(Math.abs(merged[0].width - 0.15) < 0.0001);
  assert.equal(merged[1].x, 0.6);
  assert.equal(merged[2].y, 0.23);
});
