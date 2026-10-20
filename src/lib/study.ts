export type Section = {
  title: string;
  page: number;
  depth?: number;
  y?: number;
};
export type Study = {
  id: string;
  hash: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  url: string;
  pageCount: number;
  sections: Section[];
  fileName: string;
  uploaded?: boolean;
  sourceUrl?: string;
};
export const MARS: Study = {
  // Keep the original storage identity so existing Mars notes are preserved.
  id: "arxiv-2501.05337",
  hash: "4ee67b83fc74967115ca41f396380311eb37d5361c8443c82a6e2305c7bf9bf3",
  title:
    "Martian atmospheric disturbances from orbital images and surface pressure at Jezero Crater, Mars, during Martian Year 36",
  shortTitle: "Atmospheric disturbances on Mars",
  subtitle: "Sánchez-Lavega et al. · 2025",
  url: "/studies/mars-jezero.pdf",
  pageCount: 39,
  fileName: "mars-jezero.pdf",
  sourceUrl: "https://arxiv.org/abs/2501.05337",
  sections: [
    { title: "Abstract", page: 1 },
    { title: "1. Introduction", page: 2 },
    { title: "2. Data analysis", page: 3 },
    { title: "3. Surface pressure at Jezero", page: 4 },
    { title: "4. Tide amplitudes and phases", page: 6 },
    { title: "5. Long-period waves", page: 7 },
    { title: "6. Imaging disturbances", page: 9 },
    { title: "7. Discussion", page: 23 },
    { title: "8. Summary", page: 29 },
    { title: "References", page: 31 },
  ],
};
export const NEPTUNE: Study = {
  id: "sha256-110dfc334baefaa840b185a0071d7805a7759fa611c79d26ef6864739b12359f",
  hash: "110dfc334baefaa840b185a0071d7805a7759fa611c79d26ef6864739b12359f",
  title: "Neptune Odyssey: Mission to the Neptune–Triton System",
  shortTitle: "Neptune Odyssey",
  subtitle: "Mission concept study · August 2020",
  url: "/studies/neptune-odyssey.pdf",
  pageCount: 116,
  fileName: "NeptuneOdyssey.pdf",
  // Physical PDF pages, verified against the supplied full report.
  sections: [
    { title: "Cover", page: 1 },
    { title: "Concept study team", page: 2 },
    { title: "Contents", page: 4 },
    { title: "Executive summary", page: 10 },
    { title: "1. Scientific objectives", page: 12 },
    { title: "2. High-level mission concept", page: 22 },
    { title: "3. Technical overview", page: 28 },
    { title: "4. Development schedule", page: 44 },
    { title: "5. Mission life-cycle cost", page: 45 },
    { title: "Appendix A. Acronyms and glossary", page: 49 },
    { title: "Appendix B. Design team study", page: 53 },
    { title: "Appendix C. References", page: 114 },
  ],
};
export const BUILTIN_STUDIES = [NEPTUNE, MARS];
export function documentId(hash: string) {
  return (
    BUILTIN_STUDIES.find((study) => study.hash === hash)?.id ?? `sha256-${hash}`
  );
}
export function filenameTitle(fileName: string) {
  return (
    fileName
      .replace(/\.pdf$/i, "")
      .replace(/[_-]+/g, " ")
      .trim() || "Untitled PDF"
  );
}
