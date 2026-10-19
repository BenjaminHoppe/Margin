import type { Annotation, Draft, Kind, Understanding } from "./annotations";
import { NEPTUNE, type Study, type Section } from "./study";
export type AnnotationMode = "margin" | "list" | "hidden";
export type MinimapMode = "map" | "contents";
export type Theme = "auto" | "light" | "dark";
export type ShowOnPage = Record<Kind | "understanding", boolean>;
export type OutlineSection = Section & {
  depth?: number;
  id?: string;
  y?: number;
};
export type ReaderState = {
  version: 1;
  demoSeedVersion?: number;
  annotations: Annotation[];
  draft: Draft | null;
  position: { page: number; fraction: number };
  minimap: MinimapMode;
  mode: AnnotationMode;
  showOnPage: ShowOnPage;
  active: string | null;
};
export const PAPER_ID = "neptune-odyssey";
export const READER_KEY = `margin:v1:${PAPER_ID}`;
export const SETTINGS_KEY = "margin:settings:v1";
export const paper = { ...NEPTUNE, url: "/papers/neptune-odyssey.pdf" };
export const understandingLabel: Record<Understanding, string> = {
  unmarked: "Not marked",
  unclear: "Unclear",
  "partly understood": "Partly understood",
  understood: "Understood",
};
export const kinds: Kind[] = ["highlight", "note", "question"];
export const kindLabel: Record<Kind, string> = {
  highlight: "Highlight",
  note: "Note",
  question: "Question",
};
const seedRows: [Kind, number, string, string, Understanding][] = [
  [
    "note",
    10,
    "the first to orbit an ice giant planet",
    "An ice giant and a captured Kuiper Belt world in one trip. The Neptune–Triton pairing is the part that makes this mission compelling to me.",
    "understood",
  ],
  [
    "highlight",
    26,
    "Savings from adding the hibernative cruise phases is $160M in FY25 dollars.",
    "A quiet cruise is a design decision with a real cost payoff.",
    "understood",
  ],
  [
    "note",
    30,
    "The equipment layout and thermal design are intended to minimize heater power required.",
    "At Neptune, keeping the spacecraft warm competes with doing science. I like that the physical layout itself saves power.",
    "partly understood",
  ],
  [
    "highlight",
    19,
    "The complex nature of Neptune’s magnetic field and Triton’s inclined orbit produce a background field at Triton that oscillates with its synodic period (14.5 h), its orbital period (141 h), and their harmonics.",
    "Two natural rhythms to probe the interior. I understand the basic induction idea; I want to see how clearly the data separates an ocean from other conducting layers.",
    "understood",
  ],
  [
    "question",
    19,
    "Is there an ocean present, and if so, what is its depth and salinity, and how thick is the overlying ice shell? What generates the plumes?",
    "What would count as convincing evidence for an ocean here? Could the magnetic signal tell us how deep or salty it is, or do we need gravity measurements too?",
    "unclear",
  ],
  [
    "question",
    20,
    "whether Triton is responsible for sculpting Neptune’s radiation belts",
    "How can a moon reshape a planet’s radiation belts? Is Triton supplying particles, absorbing them, or changing where they can travel?",
    "unmarked",
  ],
  [
    "note",
    44,
    "The high-level mission schedule included in",
    "This makes the timescale feel real: design, build, then a very long wait for the encounter. How do you keep the scientific questions fresh over that span?",
    "understood",
  ],
  [
    "highlight",
    106,
    "Reducing probe mass results in more readily manufacturable thicknesses",
    "A small mass change can make the heat shield easier to manufacture. The constraints are connected all the way down.",
    "unmarked",
  ],
  [
    "note",
    45,
    "The estimated baseline mission cost without reserves is $2.664B",
    "I want to keep the baseline and the cost with reserves separate when comparing this with other flagship missions.",
    "partly understood",
  ],
  [
    "question",
    37,
    "Steeper entries yielded stagnation pressures that were beyond the capability of ground test facilities",
    "How do you build confidence in an entry you cannot fully reproduce on Earth? Which parts can be tested separately, and which rely on simulation?",
    "partly understood",
  ],
  [
    "question",
    68,
    "Table B.25. Probe – Nephelometer.",
    "What would the cloud-particle measurements add to the atmospheric chemistry? Could they tell us what the cloud layers are actually made of?",
    "unclear",
  ],
  [
    "note",
    85,
    "Probe Entry, Descent, and Landing (EDL)",
    "Come back to this sequence after the science sections. I want to connect each measurement to the short window when the probe can actually collect it.",
    "understood",
  ],
];
export function seedAnnotations(): Annotation[] {
  return seedRows.map(([kind, page, quote, body, understanding], i) => ({
    id: `seed-${i + 1}`,
    kind,
    page,
    quote,
    body,
    understanding,
    rects: [],
    resolved: false,
    createdAt: "2026-10-19T12:00:00.000Z",
    updatedAt: "2026-10-19T12:00:00.000Z",
  }));
}
export function readerKey(study: Study = paper) {
  return study.id === paper.id ? READER_KEY : `margin:v1:${study.id}`;
}
export function initialReaderState(study: Study = paper): ReaderState {
  const neptune = study.id === paper.id;
  return {
    version: 1,
    demoSeedVersion: 3,
    annotations: neptune ? seedAnnotations() : [],
    draft: null,
    position: { page: neptune ? 19 : 1, fraction: 0 },
    minimap: "map",
    mode: "margin",
    showOnPage: {
      highlight: true,
      note: true,
      question: true,
      understanding: false,
    },
    active: neptune ? "seed-5" : null,
  };
}
export function validAnnotation(value: unknown): value is Annotation {
  if (!value || typeof value !== "object") return false;
  const a = value as Annotation;
  return (
    typeof a.id === "string" &&
    kinds.includes(a.kind) &&
    typeof a.quote === "string" &&
    typeof a.body === "string" &&
    a.understanding in understandingLabel &&
    Number.isInteger(a.page) &&
    a.page >= 1 &&
    a.page <= 10000 &&
    Array.isArray(a.rects) &&
    a.rects.every(
      (r) =>
        r &&
        [r.x, r.y, r.width, r.height].every(Number.isFinite) &&
        r.x >= 0 &&
        r.y >= 0 &&
        r.width > 0 &&
        r.height > 0 &&
        r.x + r.width <= 1.01 &&
        r.y + r.height <= 1.01,
    )
  );
}
export function readReaderState(
  storage: Pick<Storage, "getItem">,
  study: Study = paper,
): {
  state: ReaderState;
  error: string;
} {
  const defaults = initialReaderState(study);
  const withDemo = (annotations: Annotation[], revision?: number) =>
    study.id === paper.id && revision !== 3
      ? [
          ...seedAnnotations(),
          ...annotations.filter((a) => !/^seed-\d+$/.test(a.id)),
        ]
      : annotations;
  try {
    const raw = storage.getItem(readerKey(study));
    if (raw) {
      const value = JSON.parse(raw) as ReaderState;
      if (
        value.version !== 1 ||
        !Array.isArray(value.annotations) ||
        !value.annotations.every(
          (a) => validAnnotation(a) && a.page <= study.pageCount,
        ) ||
        (value.draft != null &&
          !validAnnotation({ ...value.draft, id: value.draft.id ?? "draft" }))
      )
        throw new Error("Invalid annotations");
      return {
        state: {
          ...defaults,
          ...value,
          annotations: withDemo(value.annotations, value.demoSeedVersion),
          demoSeedVersion: 3,
          draft: value.draft ?? null,
          position: {
            page: Math.max(
              1,
              Math.min(
                study.pageCount,
                Number(value.position?.page) || defaults.position.page,
              ),
            ),
            fraction: Math.max(
              0,
              Math.min(1, Number(value.position?.fraction) || 0),
            ),
          },
          minimap: value.minimap === "contents" ? "contents" : "map",
          mode: ["margin", "list", "hidden"].includes(value.mode)
            ? value.mode
            : "margin",
          showOnPage: { ...defaults.showOnPage, ...value.showOnPage },
        },
        error: "",
      };
    }
    const legacy = storage.getItem(`margin:${study.id}:v1`);
    if (legacy) {
      const value = JSON.parse(legacy);
      if (
        Array.isArray(value.annotations) &&
        value.annotations.length &&
        value.annotations.every(
          (a: Annotation) => validAnnotation(a) && a.page <= study.pageCount,
        )
      )
        return {
          state: {
            ...defaults,
            annotations: withDemo(value.annotations),
            draft: value.draft ?? null,
            position: {
              page: Math.max(
                1,
                Math.min(
                  study.pageCount,
                  Number(value.page) || defaults.position.page,
                ),
              ),
              fraction: 0,
            },
            active: value.annotations[0].id,
          },
          error: "",
        };
    }
    return { state: defaults, error: "" };
  } catch {
    return {
      state: defaults,
      error:
        "Saved notes could not be read. Your existing browser data has been preserved; new changes will stay in this tab until you export them.",
    };
  }
}
export function sortedAnnotations(annotations: Annotation[]) {
  return [...annotations].sort(
    (a, b) => a.page - b.page || (a.rects[0]?.y ?? 0) - (b.rects[0]?.y ?? 0),
  );
}
export const fallbackSections: OutlineSection[] = [
  { title: "Executive Summary", page: 10, depth: 0 },
  { title: "1. Scientific Objectives", page: 12, depth: 0 },
  { title: "Science Traceability Matrix", page: 12, depth: 1 },
  { title: "Science Closure", page: 16, depth: 1 },
  { title: "1. Neptune (Ice Giant and Exoplanet) Origins", page: 16, depth: 2 },
  {
    title: "2. Neptune’s Strange Magnetic Field and Magnetospheric Processes",
    page: 17,
    depth: 2,
  },
  { title: "3. Triton as an Ocean World", page: 19, depth: 2 },
  {
    title:
      "4. Triton as a Kuiper Belt Dwarf Planet: Comparative Planetology (STM-T4)",
    page: 20,
    depth: 2,
  },
  { title: "5. Small Satellites and Rings", page: 20, depth: 2 },
  {
    title:
      "Cross-Disciplinary Science Opportunities: Exoplanets and Cruise Phase Science",
    page: 21,
    depth: 2,
  },
  { title: "2. High-Level Mission Concept", page: 22, depth: 0 },
  { title: "3. Technical Overview", page: 28, depth: 0 },
  {
    title: "4. Development Schedule and Schedule Constraints",
    page: 44,
    depth: 0,
  },
  { title: "5. Mission Life-Cycle Cost", page: 45, depth: 0 },
  { title: "A. Acronyms and Glossary of Terms", page: 49, depth: 0 },
  { title: "B. Design Team Study Report", page: 53, depth: 0 },
  { title: "C. References", page: 114, depth: 0 },
];
export function normalizeOutline(sections: OutlineSection[]): OutlineSection[] {
  const result = sections
    .filter(
      (s) =>
        s.page >= 10 &&
        (s.depth ?? 0) >= 1 &&
        (s.depth ?? 0) <= 3 &&
        !["Fact Sheet"].includes(s.title),
    )
    .map((s) => ({
      ...s,
      depth: Math.max(0, (s.depth ?? 1) - 1),
      title:
        s.title === "Appendix A."
          ? "A. Acronyms and Glossary of Terms"
          : s.title.replace(/^Appendix ([BC])\./, "$1."),
    }));
  return result.length ? result : fallbackSections;
}
export function sectionForPage(
  page: number,
  sections: OutlineSection[] = fallbackSections,
) {
  return [...sections].reverse().find((s) => s.page <= page) ?? sections[0];
}
// Outline destinations can start halfway down a page. Use the passage's
// vertical anchor so a preceding section owns text above the next heading.
export function sectionForAnnotation(
  annotation: Annotation,
  sections: OutlineSection[],
) {
  const y = annotation.rects[0]?.y;
  if (y === undefined) return sectionForPage(annotation.page, sections);
  return (
    [...sections]
      .reverse()
      .find(
        (section) =>
          section.page < annotation.page ||
          (section.page === annotation.page && (section.y ?? 0) <= y + 0.005),
      ) ?? sections[0]
  );
}
function roman(n: number): string {
  const pairs: [number, string][] = [
    [10, "x"],
    [9, "ix"],
    [5, "v"],
    [4, "iv"],
    [1, "i"],
  ];
  let s = "";
  for (const [v, c] of pairs)
    while (n >= v) {
      s += c;
      n -= v;
    }
  return s;
}
export function pageLabel(page: number, labels?: string[] | null) {
  if (labels?.[page - 1]) return labels[page - 1];
  if (page === 1) return "Cover";
  if (page < 12) return roman(page - 1);
  if (page >= 114) return `C-${page - 113}`;
  if (page >= 53) return `B-${page - 52}`;
  if (page >= 49) return `A-${page - 48}`;
  return String(page - 11);
}
export type Chapter = {
  id: string;
  title: string;
  start: number;
  end: number;
  sections: OutlineSection[];
};
export function chaptersFromOutline(
  sections: OutlineSection[],
  pageCount = 116,
  neptune = true,
): Chapter[] {
  if (!neptune) {
    const roots = sections.filter((s) => (s.depth ?? 0) === 0);
    const unique = roots.filter(
      (s, i) => i === 0 || s.page !== roots[i - 1].page,
    );
    const starts =
      unique[0]?.page === 1 ? unique : [{ title: "Paper", page: 1 }, ...unique];
    return starts.map((s, i) => ({
      id: String(i + 1),
      title: s.title,
      start: s.page,
      end: (starts[i + 1]?.page ?? pageCount + 1) - 1,
      sections: sections.filter(
        (row) =>
          row.page >= s.page &&
          row.page < (starts[i + 1]?.page ?? pageCount + 1),
      ),
    }));
  }
  const roots = sections.filter((s) => (s.depth ?? 0) === 0 && s.page >= 12);
  const starts = [
    { id: "FM", title: "Front matter", page: 1 },
    ...roots.map((s) => ({
      id: s.title.match(/^([1-5ABC])\./)?.[1] ?? s.title[0],
      title: s.title.replace(/^[1-5ABC]\.\s*/, ""),
      page: s.page,
    })),
  ];
  return starts.map((s, i) => ({
    id: s.id,
    title: s.title,
    start: s.page,
    end: (starts[i + 1]?.page ?? 117) - 1,
    sections: sections.filter(
      (row) => row.page >= s.page && row.page < (starts[i + 1]?.page ?? 117),
    ),
  }));
}
