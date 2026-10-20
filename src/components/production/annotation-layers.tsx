"use client";
import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  MoreHorizontal,
  X,
  Highlighter,
  MessageSquare,
  CircleHelp,
} from "lucide-react";
import { mergeRects } from "@/lib/selection";
import type { Annotation, Draft, Understanding } from "@/lib/annotations";
import {
  kindLabel,
  pageLabel,
  sortedAnnotations,
  understandingLabel,
  type AnnotationMode,
  type ShowOnPage,
} from "@/lib/reader-model";
export function UnderstandingStatus({
  value,
  question = false,
  resolved = false,
}: {
  value: Understanding;
  question?: boolean;
  resolved?: boolean;
}) {
  return (
    <span className="understanding-status">
      <i
        className={`understanding-dot ${value.replaceAll(" ", "-")}`}
        aria-hidden="true"
      />
      {question ? `${resolved ? "Resolved" : "Open question"} · ` : ""}
      {understandingLabel[value]}
    </span>
  );
}
export function EmptyAnnotations() {
  return (
    <div className="empty-annotations">
      <div className="mini-toolbar" aria-hidden="true">
        <Highlighter size={15} />
        <MessageSquare size={15} />
        <CircleHelp size={15} />
      </div>
      <h3>Start by selecting text</h3>
      <p>
        Highlight what matters, add a note in your own words, or ask a question.
        Each one is pinned beside its passage.
      </p>
      <div>
        <kbd>H</kbd> Highlight <kbd>N</kbd> Note <kbd>Q</kbd> Question
      </div>
    </div>
  );
}
export function AnnotationCard({
  annotation,
  active = false,
  labels,
  onOpen,
  onStub,
  preview = false,
}: {
  annotation: Annotation;
  active?: boolean;
  labels: string[] | null;
  onOpen?: (a: Annotation) => void;
  onStub?: () => void;
  preview?: boolean;
}) {
  const Main = preview && !onOpen ? "div" : "button";
  return (
    <article
      className={`annotation-card ${annotation.kind} ${active ? "active" : ""}`}
      data-card-id={preview ? undefined : annotation.id}
    >
      <Main
        className="card-main"
        onClick={onOpen ? () => onOpen(annotation) : undefined}
        aria-label={`Open ${annotation.kind} on page ${pageLabel(annotation.page, labels)}: ${annotation.body || annotation.quote}`}
        aria-pressed={onOpen ? active : undefined}
      >
        <span className="card-meta">
          <span className="type-pill">
            <i />
            {kindLabel[annotation.kind]}
          </span>
          <span>Page {pageLabel(annotation.page, labels)}</span>
        </span>
        {annotation.body && (
          <span className="card-body">{annotation.body}</span>
        )}
        <UnderstandingStatus
          value={annotation.understanding}
          question={annotation.kind === "question"}
          resolved={annotation.resolved}
        />
      </Main>
      {!preview && (
        <button
          className="card-more"
          aria-label="More annotation options · coming soon"
          title="Coming soon"
          onClick={onStub}
        >
          <MoreHorizontal size={16} />
        </button>
      )}
    </article>
  );
}
export function AnnotationPageLayer({
  annotations,
  page,
  height,
  near,
  mode,
  focus,
  peek,
  active,
  show,
  labels,
  draft,
  onOpen,
  onClosePeek,
  onShowMargin,
  onOverflow,
  onStub,
}: {
  annotations: Annotation[];
  page: number;
  height: number;
  near: boolean;
  mode: AnnotationMode;
  focus: boolean;
  peek: string | null;
  active: string | null;
  show: ShowOnPage;
  labels: string[] | null;
  draft: Draft | null;
  onOpen: (a: Annotation) => void;
  onClosePeek: () => void;
  onShowMargin: () => void;
  onOverflow: (page: number) => void;
  onStub: () => void;
}) {
  const column = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const located = sortedAnnotations(
    annotations
      .filter((a) => a.page === page && a.rects.length && show[a.kind])
      .map((a) => ({ ...a, rects: mergeRects(a.rects) })),
  );
  const allCards =
    focus || mode === "hidden"
      ? located.filter((a) => a.id === peek)
      : mode === "margin"
        ? located
        : [];
  const cards = allCards.length > 4 ? allCards.slice(0, 3) : allCards;
  const ids = cards.map((a) => a.id).join("|");
  useLayoutEffect(() => {
    if (!column.current || !near) return;
    const observer = new ResizeObserver((entries) => {
      setHeights((previous) => {
        const next = { ...previous };
        let changed = false;
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.cardId!;
          const h =
            entry.borderBoxSize[0]?.blockSize ??
            entry.target.getBoundingClientRect().height;
          if (Math.abs((next[id] ?? 0) - h) > 0.5) {
            next[id] = h;
            changed = true;
          }
        }
        return changed ? next : previous;
      });
    });
    column.current
      .querySelectorAll<HTMLElement>("[data-card-id]")
      .forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids, near]);
  if (!near) return null;
  const placements: {
    annotation: Annotation;
    top: number;
    source: number;
    bottom: number;
  }[] = [];
  for (const a of cards) {
    const passageTop = Math.min(...a.rects.map((r) => r.y)) * height;
    const passageBottom =
      Math.max(...a.rects.map((r) => r.y + r.height)) * height;
    const previous = placements.at(-1);
    const top = Math.max(
      0,
      passageTop - 8,
      previous ? previous.bottom + 10 : 0,
    );
    placements.push({
      annotation: a,
      top,
      source: (passageTop + passageBottom) / 2,
      bottom: top + (heights[a.id] ?? 120),
    });
  }
  const bottom = placements.at(-1)?.bottom ?? 0;
  return (
    <>
      <div
        className="passages"
        aria-label={`Annotations on page ${pageLabel(page, labels)}`}
      >
        {located.map((a) => {
          const top = Math.min(...a.rects.map((r) => r.y));
          const end = Math.max(...a.rects.map((r) => r.y + r.height));
          return (
            <div key={a.id}>
              {a.rects.map((r, i) => (
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
                className={`range-tick ${a.kind} ${mode === "hidden" || focus ? "thick" : ""}`}
                data-annotation={a.id}
                style={{
                  top: `${top * 100}%`,
                  height: `${(end - top) * 100}%`,
                }}
                onClick={() => onOpen(a)}
                aria-label={`${kindLabel[a.kind]} on page ${pageLabel(page, labels)}: ${a.body || a.quote}`}
                aria-pressed={active === a.id}
              />
              {show.understanding && a.understanding !== "unmarked" && (
                <i
                  className={`page-understanding understanding-dot ${a.understanding.replaceAll(" ", "-")}`}
                  style={{ top: `${top * 100}%` }}
                />
              )}
            </div>
          );
        })}
        {draft?.page === page &&
          draft.rects.map((r, i) => (
            <span
              className="draft-passage"
              key={i}
              style={{
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.width * 100}%`,
                height: `${r.height * 100}%`,
              }}
            />
          ))}
      </div>
      <div className="margin-column" ref={column}>
        {placements.map(({ annotation, top, source }) => (
          <div
            key={annotation.id}
            className="anchored-card"
            style={{ top } as CSSProperties}
          >
            <svg
              className={`connector ${annotation.kind}`}
              width="40"
              height={Math.max(height, bottom)}
              style={{ top: -top }}
              aria-hidden="true"
            >
              <path
                d={`M 2 ${source} C 22.9 ${source} 19.1 ${top + 22} 40 ${top + 22}`}
                pathLength="1"
              />
            </svg>
            <AnnotationCard
              annotation={annotation}
              active={active === annotation.id}
              labels={labels}
              onOpen={onOpen}
              onStub={onStub}
            />
            {(focus || mode === "hidden") && (
              <div className="peek-actions">
                <button onClick={onShowMargin}>Show all in margin</button>
                <button aria-label="Close annotation" onClick={onClosePeek}>
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        ))}
        {allCards.length > 4 && (
          <button
            className="overflow-chip pill subtle"
            style={{ top: bottom + 10 }}
            onClick={() => onOverflow(page)}
          >
            +{allCards.length - 3} here
          </button>
        )}
      </div>
    </>
  );
}
