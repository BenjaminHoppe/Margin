"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { locateQuote, type QuoteTextItem } from "@/lib/quote-match";
import type { OutlineSection } from "@/lib/reader-model";
import type { Rect } from "@/lib/annotations";
import { Document, Page, pdfjs } from "react-pdf";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { type Study, type Section } from "@/lib/study";
import type { Annotation } from "@/lib/annotations";
import { captureSelection, mergeRects } from "@/lib/selection";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
const options = {
  cMapUrl: "/pdfjs/cmaps/",
  standardFontDataUrl: "/pdfjs/standard_fonts/",
  wasmUrl: "/pdfjs/wasm/",
};
type Props = {
  study: Study;
  annotationsEnabled?: boolean;
  width: number;
  annotations: Annotation[];
  active: string | null;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  onOpen: (a: Annotation) => void;
  onSelection: (s: ReturnType<typeof captureSelection>) => void;
  onLoad: (pages: number, sections: Section[], embedded: boolean) => void;
  onReady: () => void;
  renderPageLayer?: (page: number, near: boolean, height: number) => ReactNode;
  onMetadata?: (labels: string[] | null, outline: OutlineSection[]) => void;
  onLocated?: (
    locations: { id: string; page: number; rects: Rect[] }[],
  ) => void;
};
async function readOutline(pdf: PDFDocumentProxy): Promise<OutlineSection[]> {
  const outline = await pdf.getOutline();
  if (!outline?.length) return [];
  const sections: OutlineSection[] = [];
  type OutlineItem = NonNullable<
    Awaited<ReturnType<PDFDocumentProxy["getOutline"]>>
  >[number];
  async function visit(items: OutlineItem[], depth = 0) {
    for (const item of items) {
      try {
        const dest =
          typeof item.dest === "string"
            ? await pdf.getDestination(item.dest)
            : item.dest;
        if (dest) {
          const index =
            typeof dest[0] === "number"
              ? dest[0]
              : await pdf.getPageIndex(dest[0]);
          if (index >= 0 && index < pdf.numPages) {
            const page = await pdf.getPage(index + 1);
            const viewport = page.getViewport({ scale: 1 });
            const top =
              dest[1]?.name === "XYZ"
                ? dest[3]
                : dest[1]?.name === "FitH"
                  ? dest[2]
                  : null;
            const y =
              typeof top === "number"
                ? Math.max(0, Math.min(1, 1 - top / viewport.height))
                : 0;
            sections.push({ title: item.title, page: index + 1, depth, y });
          }
        }
      } catch {
        /* Ignore broken destinations, but still inspect their children. */
      }
      if (item.items.length) await visit(item.items, depth + 1);
    }
  }
  await visit(outline);
  return sections.sort((a, b) => a.page - b.page);
}
// Page dimensions are cheap metadata. Read them in small batches to reserve
// exact space for portrait/landscape pages without mounting their canvases.
async function pageRatios(pdf: PDFDocumentProxy) {
  const ratios: number[] = [];
  for (let start = 1; start <= pdf.numPages; start += 8) {
    const batch = await Promise.all(
      Array.from(
        { length: Math.min(8, pdf.numPages - start + 1) },
        async (_, i) => {
          const p = await pdf.getPage(start + i);
          const v = p.getViewport({ scale: 1 });
          return v.height / v.width;
        },
      ),
    );
    ratios.push(...batch);
  }
  return ratios;
}
function LazyPage({
  page,
  width,
  ratio,
  scrollRoot,
  annotations,
  active,
  onOpen,
  onSelection,
  annotationsEnabled = true,
  renderPageLayer,
}: Omit<Props, "study" | "onLoad" | "onReady"> & {
  page: number;
  ratio: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { root: scrollRoot.current, rootMargin: "900px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);
  function select() {
    requestAnimationFrame(() => {
      const textLayer = container.current?.querySelector(
        ".react-pdf__Page__textContent",
      );
      const selection = window.getSelection();
      if (
        container.current &&
        selection &&
        textLayer?.contains(selection.anchorNode) &&
        textLayer.contains(selection.focusNode)
      )
        onSelection(captureSelection(container.current, page));
    });
  }
  return (
    <div
      className="paper continuous-page"
      ref={container}
      style={{ width, height: Math.round(width * ratio) }}
      onMouseUp={annotationsEnabled ? select : undefined}
      onKeyUp={annotationsEnabled ? select : undefined}
      data-page={page}
      aria-label={`PDF page ${page}`}
    >
      {near ? (
        <Page
          key={`${page}-${retry}`}
          pageNumber={page}
          width={width}
          devicePixelRatio={Math.min(window.devicePixelRatio || 1, 2)}
          renderTextLayer
          renderAnnotationLayer
          loading={<div className="page-placeholder">Loading page {page}…</div>}
          onRenderError={() => setError(true)}
          error={
            <div className="page-placeholder" role="alert">
              <span>Page {page} couldn’t render.</span>
              <button
                onClick={() => {
                  setError(false);
                  setRetry((n) => n + 1);
                }}
              >
                Retry page
              </button>
            </div>
          }
        />
      ) : (
        <div className="page-placeholder" aria-hidden="true">
          {page}
        </div>
      )}
      {error && (
        <span className="sr-only" role="alert">
          Page {page} could not render.
        </span>
      )}
      {annotationsEnabled && !renderPageLayer && (
        <div className="passages" aria-label={`Annotations on page ${page}`}>
          {annotations
            .filter((a) => a.page === page)
            .map((a) => (
              <div key={a.id}>
                {mergeRects(a.rects).map((r, i) => (
                  <span
                    key={i}
                    className={`passage ${a.kind} ${active === a.id ? "active" : ""}`}
                    style={{
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: `${r.width * 100}%`,
                      height: `${r.height * 100}%`,
                    }}
                  />
                ))}
                <button
                  className={`passage-marker ${a.kind} ${active === a.id ? "active" : ""}`}
                  data-annotation={a.id}
                  style={{
                    left: `max(6px, calc(${a.rects[0].x * 100}% - 30px))`,
                    top: `calc(${a.rects[0].y * 100}% - 5px)`,
                  }}
                  onClick={() => onOpen(a)}
                  aria-label={`Open ${a.kind}: ${a.quote.slice(0, 90)}`}
                  title={`${a.kind} · ${a.understanding}`}
                >
                  <span />
                </button>
              </div>
            ))}
        </div>
      )}
      {renderPageLayer?.(page, near, Math.round(width * ratio))}
    </div>
  );
}
export default function PdfView({
  study,
  annotationsEnabled = true,
  width,
  annotations,
  active,
  scrollRoot,
  onOpen,
  onSelection,
  onLoad,
  onReady,
  renderPageLayer,
  onMetadata,
  onLocated,
}: Props) {
  const [ratios, setRatios] = useState<number[]>([]);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (ratios.length) onReady();
  }, [ratios, onReady]);
  const failure = (
    <div className="pdf-message" role="alert">
      <strong>This PDF couldn’t open.</strong>
      <p>{error || "Check the PDF and try again."}</p>
      <button
        onClick={() => {
          setError("");
          setRatios([]);
          setRetry((n) => n + 1);
        }}
      >
        Try again
      </button>
    </div>
  );
  return (
    <Document
      key={retry}
      file={study.url}
      externalLinkTarget="_blank"
      externalLinkRel="noopener noreferrer"
      options={options}
      loading={<div className="pdf-message">Opening the original paper…</div>}
      error={failure}
      onLoadError={(e) => setError(e.message)}
      onLoadSuccess={async (pdf) => {
        try {
          const [dimensions, outline, labels] = await Promise.all([
            pageRatios(pdf),
            readOutline(pdf).catch(() => []),
            pdf.getPageLabels().catch(() => null),
          ]);
          onLoad(
            pdf.numPages,
            outline.length
              ? outline
              : study.sections.length
                ? study.sections
                : [{ title: "Document", page: 1 }],
            outline.length > 0,
          );
          onMetadata?.(labels, outline);
          setRatios(dimensions);
          if (onLocated) {
            const textCache = new Map<
              number,
              { items: QuoteTextItem[]; width: number; height: number }
            >();
            const locations: { id: string; page: number; rects: Rect[] }[] = [];
            for (const annotation of annotations.filter(
              (a) => !a.rects.length,
            )) {
              for (const candidate of [
                annotation.page,
                annotation.page - 1,
                annotation.page + 1,
              ]) {
                if (candidate < 1 || candidate > pdf.numPages) continue;
                let data = textCache.get(candidate);
                if (!data) {
                  const page = await pdf.getPage(candidate);
                  const content = await page.getTextContent();
                  const viewport = page.getViewport({ scale: 1 });
                  data = {
                    items: content.items.filter((item) => "str" in item),
                    width: viewport.width,
                    height: viewport.height,
                  };
                  textCache.set(candidate, data);
                }
                const rects = locateQuote(
                  data.items,
                  annotation.quote,
                  data.width,
                  data.height,
                );
                if (rects.length) {
                  locations.push({ id: annotation.id, page: candidate, rects });
                  break;
                }
              }
            }
            onLocated(locations);
          }
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Could not prepare PDF pages.",
          );
        }
      }}
      onItemClick={({ pageNumber }) => {
        if (pageNumber)
          window.dispatchEvent(
            new CustomEvent("margin:page", { detail: pageNumber }),
          );
      }}
    >
      {error ? (
        failure
      ) : !ratios.length ? (
        <div className="pdf-message">Preparing page navigation…</div>
      ) : (
        ratios.map((ratio, i) => (
          <LazyPage
            renderPageLayer={renderPageLayer}
            annotationsEnabled={annotationsEnabled}
            key={i}
            page={i + 1}
            ratio={ratio}
            width={width}
            annotations={annotations}
            active={active}
            scrollRoot={scrollRoot}
            onOpen={onOpen}
            onSelection={onSelection}
          />
        ))
      )}
    </Document>
  );
}
