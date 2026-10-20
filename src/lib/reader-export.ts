import type { Study } from "./study";
import type { Annotation } from "./annotations";
import {
  kindLabel,
  pageLabel,
  paper,
  sectionForAnnotation,
  sortedAnnotations,
  type OutlineSection,
} from "./reader-model";
export type ExportFormat = "md" | "json" | "csv";
export function exportAnnotations(
  annotations: Annotation[],
  format: ExportFormat,
  includeQuotes: boolean,
  sections: OutlineSection[],
  labels?: string[] | null,
  date = new Date(),
  study: Study = paper,
) {
  const rows = sortedAnnotations(annotations).map((a) => ({
    id: a.id,
    paperId: study.id === paper.id ? "neptune-odyssey" : study.id,
    type: a.kind,
    pdfPage: a.page,
    section: sectionForAnnotation(a, sections)?.title ?? "Document",
    page: pageLabel(a.page, labels),
    ...(includeQuotes ? { quote: a.quote } : {}),
    body: a.body,
    status: a.kind === "question" ? (a.resolved ? "resolved" : "open") : "",
    createdAt: a.createdAt,
    rects: a.rects,
  }));
  if (format === "json") return JSON.stringify(rows, null, 2);
  if (format === "csv") {
    const columns = [
      "type",
      "section",
      "page",
      ...(includeQuotes ? ["quote"] : []),
      "body",
      "status",
      "createdAt",
    ] as const;
    const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    return [
      columns.join(","),
      ...rows.map((row) =>
        columns.map((k) => cell(row[k as keyof typeof row])).join(","),
      ),
    ].join("\r\n");
  }
  const lines = [
    `# ${study.title}`,
    `Exported from Margin · ${date.toISOString().slice(0, 10)} · ${rows.length} annotations`,
  ];
  let previous = "";
  rows.forEach((row) => {
    const group = `${row.section} · p. ${row.page}`;
    if (group !== previous) {
      lines.push(`## ${group}`);
      previous = group;
    }
    if (includeQuotes)
      lines.push(
        (row.quote ?? "")
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n"),
      );
    lines.push(`- **${kindLabel[row.type]}:** ${row.body}`);
    if (row.status) lines.push(`- Status: ${row.status}`);
  });
  return lines.join("\n\n");
}
