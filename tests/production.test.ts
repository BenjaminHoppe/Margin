import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AnnotationPageLayer,
  AnnotationCard,
} from "../src/components/production/annotation-layers";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  initialReaderState,
  pageLabel,
  readReaderState,
  READER_KEY,
  seedAnnotations,
  fallbackSections,
  chaptersFromOutline,
  paper,
  sectionForAnnotation,
  annotationsForSection,
  sectionForPosition,
  sectionProgress,
  readerKey,
} from "../src/lib/reader-model";
import { studies } from "../src/lib/catalog";
import { exportAnnotations } from "../src/lib/reader-export";
import { locateQuote, normalizedQuote } from "../src/lib/quote-match";

test("new reader starts at printed page 8 with a complete seeded workflow", () => {
  const state = initialReaderState();
  assert.equal(state.position.page, 19);
  assert.equal(pageLabel(19), "8");
  assert.equal(state.annotations.length, 16);
  const chapters = chaptersFromOutline(fallbackSections);
  const populated = chapters.filter((c) =>
    state.annotations.some((a) => a.page >= c.start && a.page <= c.end),
  );
  assert.ok(populated.length >= 6, "demo content should span the study");
  assert.equal(state.active, "seed-5");
  assert.equal(state.mode, "margin");
});
test("existing notes migrate without replacing the legacy data", () => {
  const annotation = {
    ...seedAnnotations()[0],
    id: "my-note",
    body: "My existing note",
  };
  const writes: string[] = [];
  const storage = {
    getItem(key: string) {
      if (key === `margin:${paper.id}:v1`)
        return JSON.stringify({ annotations: [annotation], page: 20 });
      writes.push(key);
      return null;
    },
  };
  const result = readReaderState(storage);
  assert.equal(
    result.state.annotations.find((a) => a.id === "my-note")?.body,
    "My existing note",
  );
  assert.equal(result.state.annotations.length, 17);
  assert.equal(result.state.position.page, 20);
  assert.ok(writes.includes(READER_KEY));
});
test("an intentionally empty saved paper stays empty", () => {
  const state = { ...initialReaderState(), annotations: [] };
  assert.deepEqual(
    readReaderState({
      getItem: (key) => (key === READER_KEY ? JSON.stringify(state) : null),
    }).state.annotations,
    [],
  );
});
test("corrupt storage is reported and never overwritten by the reader", () => {
  const result = readReaderState({ getItem: () => "{corrupt" });
  assert.ok(result.error.includes("preserved"));
});
test("chapter boundaries cover each real PDF page exactly once", () => {
  const chapters = chaptersFromOutline(fallbackSections);
  assert.equal(chapters.length, 9);
  assert.equal(chapters.find((c) => c.id === "B")?.start, 53);
  assert.equal(chapters.find((c) => c.id === "B")?.end, 113);
  assert.deepEqual(
    chapters.flatMap((c) =>
      Array.from({ length: c.end - c.start + 1 }, (_, i) => i + c.start),
    ),
    Array.from({ length: 116 }, (_, i) => i + 1),
  );
  assert.equal(pageLabel(49), "A-1");
  assert.equal(pageLabel(114), "C-1");
});
test("exports include sections, printed labels and question status, with optional quotes", () => {
  const seed = seedAnnotations();
  const json = JSON.parse(
    exportAnnotations(seed, "json", false, fallbackSections),
  );
  const question = json.find((row: { id: string }) => row.id === "seed-5");
  assert.equal(question.page, "8");
  assert.equal(question.status, "open");
  assert.equal("quote" in question, false);
  assert.equal("understanding" in question, false);
  const md = exportAnnotations(
    seed,
    "md",
    true,
    fallbackSections,
    null,
    new Date("2026-10-19T00:00:00Z"),
  );
  assert.match(md, /Triton as an Ocean World · p\. 8/);
  assert.match(md, /Status: open/);
  assert.doesNotMatch(md, /Understanding:/);
  assert.match(md, /Exported from Margin · 2026-10-19/);
  const csv = exportAnnotations(
    [{ ...seed[0], body: 'A "quote", and\na newline' }],
    "csv",
    true,
    fallbackSections,
  );
  assert.match(csv, /"A ""quote"", and\na newline"/);
});
test("quote normalization handles typography, line breaks and footnotes", () => {
  assert.equal(
    normalizedQuote("charac-\nterize Neptune’s ¹ field"),
    normalizedQuote("characterize Neptune's field"),
  );
  assert.equal(normalizedQuote("ﬁeld"), normalizedQuote("field"));
});
test("all sixteen seed passages resolve to valid coordinates in the supplied PDF", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({
    data: new Uint8Array(
      await readFile(
        new URL("../public/papers/neptune-odyssey.pdf", import.meta.url),
      ),
    ),
    useSystemFonts: true,
  }).promise;
  try {
    for (const annotation of seedAnnotations()) {
      const page = await pdf.getPage(annotation.page);
      const viewport = page.getViewport({ scale: 1 });
      const text = await page.getTextContent();
      const rects = locateQuote(
        text.items.filter((item) => "str" in item),
        annotation.quote,
        viewport.width,
        viewport.height,
      );
      assert.ok(rects.length, annotation.id);
      assert.ok(
        rects.every(
          (r) =>
            r.x >= 0 &&
            r.y >= 0 &&
            r.width > 0 &&
            r.height > 0 &&
            r.x + r.width <= 1 &&
            r.y + r.height <= 1,
        ),
      );
    }
    const page = await pdf.getPage(19);
    const text = await page.getTextContent();
    assert.deepEqual(
      locateQuote(
        text.items.filter((item) => "str" in item),
        "This passage does not exist in this document",
        612,
        792,
      ),
      [],
    );
  } finally {
    await pdf.destroy();
  }
});

test("section grouping uses heading positions within the same PDF page", () => {
  const sections = [
    { title: "Ocean world", page: 19, y: 0.1 },
    { title: "Comparative planetology", page: 20, y: 0.3 },
    { title: "Small satellites", page: 20, y: 0.6 },
  ];
  const annotation = {
    ...seedAnnotations()[5],
    rects: [{ x: 0.1, y: 0.2, width: 0.5, height: 0.02 }],
  };
  assert.equal(sectionForAnnotation(annotation, sections).title, "Ocean world");
  assert.equal(
    sectionForAnnotation(
      { ...annotation, rects: [{ ...annotation.rects[0], y: 0.4 }] },
      sections,
    ).title,
    "Comparative planetology",
  );
});
test("malformed saved drafts preserve the original storage for recovery", () => {
  const state = { ...initialReaderState(), draft: { body: "Unsaved text" } };
  const result = readReaderState({ getItem: () => JSON.stringify(state) });
  assert.match(result.error, /preserved/);
});

test("each additional study starts empty and uses independent storage and page limits", () => {
  for (const study of studies.slice(1)) {
    const state = readReaderState({ getItem: () => null }, study).state;
    assert.equal(state.annotations.length, 0);
    assert.equal(state.position.page, 1);
    assert.notEqual(readerKey(study), READER_KEY);
    const sections = [{ title: "Paper", page: 1 }];
    assert.equal(
      chaptersFromOutline(sections, study.pageCount, false)[0].end,
      study.pageCount,
    );
    const output = exportAnnotations(
      [],
      "md",
      true,
      sections,
      null,
      new Date(),
      study,
    );
    assert.ok(output.startsWith(`# ${study.title}`));
  }
});
test("the new demo is added once while preserving personal annotations and drafts", () => {
  const note = {
    ...seedAnnotations()[0],
    id: "personal",
    body: "Keep my own words",
  };
  const old = {
    ...initialReaderState(),
    demoSeedVersion: 2,
    annotations: [seedAnnotations()[0], note],
    draft: { ...note },
  };
  const first = readReaderState({
    getItem: (key) => (key === READER_KEY ? JSON.stringify(old) : null),
  }).state;
  assert.equal(first.annotations.length, 17);
  assert.equal(first.demoSeedVersion, 4);
  assert.equal(first.draft?.body, note.body);
  const second = readReaderState({
    getItem: (key) => (key === READER_KEY ? JSON.stringify(first) : null),
  }).state;
  assert.deepEqual(second.annotations, first.annotations);
});
test("all library PDFs exist with the catalogued page counts", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  assert.equal(studies.length, 11);
  assert.equal(new Set(studies.map((s) => s.slug)).size, studies.length);
  for (const study of studies) {
    const pdf = await getDocument({
      data: new Uint8Array(
        await readFile(new URL(`../public${study.url}`, import.meta.url)),
      ),
    }).promise;
    assert.equal(pdf.numPages, study.pageCount, study.title);
    if (study.slug !== "neptune-odyssey") {
      assert.ok(
        study.sections.length > 1,
        `${study.shortTitle}: missing sections`,
      );
      const pages = new Map<number, Awaited<ReturnType<typeof pdf.getPage>>>();
      const normalize = (value: string) =>
        value
          .normalize("NFKD")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");
      for (const [index, section] of study.sections.entries()) {
        assert.ok(
          section.page >= 1 && section.page <= pdf.numPages,
          section.title,
        );
        assert.ok(
          index === 0 || section.page >= study.sections[index - 1].page,
          section.title,
        );
        assert.ok(
          (section.y ?? 0) >= 0 && (section.y ?? 0) <= 1,
          section.title,
        );
        assert.ok((section.depth ?? 0) >= 0, section.title);
        // These two labels describe unheaded opening/figure pages.
        if (["Overview", "Extended data"].includes(section.title)) continue;
        let page = pages.get(section.page);
        if (!page) {
          page = await pdf.getPage(section.page);
          pages.set(section.page, page);
        }
        const text = await page.getTextContent();
        const heading = normalize(
          study.slug === "voyager-plasma-waves" &&
            section.title === "References"
            ? "1. Gurnett"
            : section.title.replace(/^Appendix [ABC]\. /, ""),
        );
        const contents = normalize(
          text.items
            .filter((item) => "str" in item)
            .map((item) => item.str)
            .join(""),
        );
        assert.ok(
          contents.includes(heading),
          `${study.shortTitle}: ${section.title} is not on PDF page ${section.page}`,
        );
      }
    }
    await pdf.destroy();
  }
});

test("same-page headings complete preceding segments and select the correct section", () => {
  const sections = [
    { title: "Chapter", page: 12, y: 0.1 },
    { title: "First section", page: 12, y: 0.1 },
    { title: "Second section", page: 12, y: 0.6 },
    { title: "Next page", page: 13, y: 0.2 },
  ];
  assert.equal(sectionForPosition(12, 0.6, sections).title, "Second section");
  assert.equal(sectionProgress(0, 12, 0.6, sections, 116), 1);
  assert.equal(sectionProgress(1, 12, 0.6, sections, 116), 1);
  assert.equal(sectionProgress(2, 12, 0.6, sections, 116), 0);
  assert.ok(sectionProgress(2, 12, 0.9, sections, 116) > 0);
  assert.equal(sectionProgress(2, 13, 0.1999, sections, 116), 1);
  assert.equal(sectionProgress(3, 12, 0.6, sections, 116), 0);
});

test("short outline sections are not skipped by active-section tolerance", () => {
  const sections = [
    { title: "Short section", page: 12, y: 0.2 },
    { title: "Next section", page: 12, y: 0.203 },
  ];
  assert.equal(sectionForPosition(12, 0.2, sections).title, "Short section");
  assert.equal(sectionForPosition(12, 0.202, sections).title, "Short section");
  assert.equal(sectionForPosition(12, 0.203, sections).title, "Next section");
});

test("layout samples append once without replacing edited v3 annotations or drafts", () => {
  const edited = { ...seedAnnotations()[0], body: "My edited demo note" };
  const previous = {
    ...initialReaderState(),
    demoSeedVersion: 3,
    annotations: [edited],
    draft: { ...edited },
  };
  const first = readReaderState({
    getItem: () => JSON.stringify(previous),
  }).state;
  assert.equal(first.annotations.length, 5);
  assert.deepEqual(first.annotations[0], edited);
  assert.deepEqual(first.draft, previous.draft);
  const second = readReaderState({
    getItem: () => JSON.stringify(first),
  }).state;
  assert.deepEqual(second.annotations, first.annotations);
});
test("sidebar markers separate same-page siblings while including a parent's descendants", () => {
  const sections = [
    { title: "Chapter", page: 20, y: 0, depth: 0 },
    { title: "Triton", page: 20, y: 0.2, depth: 1 },
    { title: "Rings", page: 20, y: 0.7, depth: 1 },
  ];
  const base = seedAnnotations()[0];
  const annotations = [
    {
      ...base,
      id: "triton",
      page: 20,
      rects: [{ x: 0.1, y: 0.4, width: 0.2, height: 0.02 }],
    },
    {
      ...base,
      id: "rings",
      page: 20,
      rects: [{ x: 0.1, y: 0.8, width: 0.2, height: 0.02 }],
    },
  ];
  assert.deepEqual(
    annotationsForSection(sections[1], sections, annotations).map((a) => a.id),
    ["triton"],
  );
  assert.deepEqual(
    annotationsForSection(sections[2], sections, annotations).map((a) => a.id),
    ["rings"],
  );
  assert.equal(
    annotationsForSection(sections[0], sections, annotations).length,
    2,
  );
});

test("session-only content resets additions and drafts while retaining reader preferences", async () => {
  const { resetSessionAnnotations, initialReaderState } =
    await import("../src/lib/reader-model");
  const defaults = initialReaderState();
  const personal = {
    ...defaults.annotations[0],
    id: "personal",
  };
  const session = {
    ...defaults,
    annotations: [personal],
    draft: personal,
    active: personal.id,
    minimap: "contents" as const,
  };
  const restored = resetSessionAnnotations(session);
  assert.deepEqual(restored.annotations, defaults.annotations);
  assert.equal(restored.draft, null);
  assert.equal(restored.active, defaults.active);
  assert.equal(restored.minimap, "contents");
  assert.deepEqual(restored.position, session.position);
  assert.equal(session.annotations[0].id, "personal");
});

test("cancelled and deleted editors leave no empty card or connector", () => {
  const annotation = {
    ...seedAnnotations()[0],
    kind: "highlight" as const,
    body: "",
    rects: [{ x: 0.1, y: 0.2, width: 0.5, height: 0.025 }],
  };
  const noop = () => {};
  const props = {
    annotations: [annotation],
    page: annotation.page,
    height: 1000,
    near: true,
    mode: "margin" as const,
    focus: false,
    peek: null,
    active: annotation.id,
    show: { highlight: true, note: true, question: true, understanding: false },
    labels: null,
    draft: null,
    onDraftChange: noop,
    onDraftTypeChange: noop,
    onDraftCancel: noop,
    onDraftSave: noop,
    onOpen: noop,
    onClosePeek: noop,
    onShowMargin: noop,
    onEdit: noop,
    onDelete: noop,
  };
  const editing = renderToStaticMarkup(
    createElement(AnnotationPageLayer, {
      ...props,
      draft: { ...annotation, body: "Unsaved text", kind: "note" },
    }),
  );
  assert.match(editing, /inline-composer/);
  assert.match(editing, /range-tick note/);
  const cancelled = renderToStaticMarkup(
    createElement(AnnotationPageLayer, { ...props, active: null }),
  );
  assert.doesNotMatch(cancelled, /inline-composer|Unsaved text|draft-card/);
  assert.match(cancelled, /Add note/);
  assert.doesNotMatch(cancelled, /<kbd>\/<\/kbd>/);
  assert.match(cancelled, /<div class="card-main"/);
  assert.doesNotMatch(cancelled, /<button class="card-main"/);
  const preview = renderToStaticMarkup(
    createElement(AnnotationCard, {
      annotation,
      labels: null,
      preview: true,
      onOpen: noop,
    }),
  );
  assert.match(preview, /<button class="card-main"/);

  const withExistingText = renderToStaticMarkup(
    createElement(AnnotationPageLayer, {
      ...props,
      annotations: [{ ...annotation, body: "Keep this existing text" }],
    }),
  );
  assert.match(withExistingText, /Keep this existing text/);
  assert.match(withExistingText, /Add note/);
  for (const kind of ["note", "question"] as const) {
    const writingCard = renderToStaticMarkup(
      createElement(AnnotationCard, {
        annotation: { ...annotation, kind, body: "Keep my words" },
        labels: null,
        onEdit: noop,
        onDelete: noop,
      }),
    );
    assert.match(writingCard, /Keep writing/);
    assert.match(writingCard, /Keep my words/);
    assert.doesNotMatch(writingCard, /Open question|question-status/);
  }

  assert.match(cancelled, /range-tick highlight/);
  const second = {
    ...annotation,
    id: "second-highlight",
    rects: [{ ...annotation.rects[0], y: 0.5 }],
  };
  const multiple = renderToStaticMarkup(
    createElement(AnnotationPageLayer, {
      ...props,
      annotations: [annotation, second],
      active: second.id,
    }),
  );
  assert.equal((multiple.match(/card-add-note/g) ?? []).length, 2);
  assert.equal((multiple.match(/<kbd>\/<\/kbd>/g) ?? []).length, 1);
  const crowded = renderToStaticMarkup(
    createElement(AnnotationPageLayer, {
      ...props,
      annotations: Array.from({ length: 6 }, (_, i) => ({
        ...annotation,
        id: `crowded-${i}`,
        rects: [{ ...annotation.rects[0], y: 0.1 + i * 0.08 }],
      })),
    }),
  );
  assert.equal((crowded.match(/class="annotation-card /g) ?? []).length, 6);
  assert.doesNotMatch(crowded, /overflow-chip|\+3 here/);

  const deleted = renderToStaticMarkup(
    createElement(AnnotationPageLayer, {
      ...props,
      annotations: [],
      active: null,
    }),
  );
  assert.doesNotMatch(
    deleted,
    /margin-column|connector|range-tick|annotation-card/,
  );
  const hidden = renderToStaticMarkup(
    createElement(AnnotationPageLayer, { ...props, mode: "hidden" }),
  );
  assert.doesNotMatch(hidden, /margin-column|connector|annotation-card/);
  assert.match(hidden, /range-tick highlight/);
});
