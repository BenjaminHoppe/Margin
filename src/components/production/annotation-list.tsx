"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Annotation, Draft, Kind } from "@/lib/annotations";
import {
  pageLabel,
  sectionForAnnotation,
  sortedAnnotations,
  type OutlineSection,
} from "@/lib/reader-model";
import { Composer } from "./annotating";
import { AnnotationCard, EmptyAnnotations } from "./annotation-layers";
export function AnnotationList({
  annotations,
  sections,
  labels,
  visibleAnnotationIds,
  draft,
  onDraftChange,
  onDraftTypeChange,
  onDraftCancel,
  onDraftSave,
  onEdit,
  onDelete,
  page,
  active,
  pageFilter,
  onClearPageFilter,
  onOpen,
}: {
  annotations: Annotation[];
  sections: OutlineSection[];
  labels: string[] | null;
  visibleAnnotationIds: string[];
  draft: Draft | null;
  onDraftChange: (draft: Draft) => void;
  onDraftTypeChange: (kind: Kind) => void;
  onDraftCancel: () => void;
  onDraftSave: () => void;
  onEdit: (annotation: Annotation) => void;
  onDelete: (annotation: Annotation) => void;
  page: number;
  active: string | null;
  pageFilter: number | null;
  onClearPageFilter: () => void;
  onOpen: (a: Annotation) => void;
}) {
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<{ top: number; bottom: number } | null>(
    null,
  );
  const filtered = useMemo(
    () =>
      sortedAnnotations(
        annotations.filter(
          (a) =>
            (filter === "all" || a.kind === filter || a.id === draft?.id) &&
            (pageFilter === null || a.page === pageFilter),
        ),
      ),
    [annotations, filter, pageFilter, draft?.id],
  );
  const groups = useMemo(() => {
    const result: { title: string; annotations: Annotation[] }[] = [];
    for (const a of filtered) {
      const title = sectionForAnnotation(a, sections).title;
      const last = result.at(-1);
      if (last?.title === title) last.annotations.push(a);
      else result.push({ title, annotations: [a] });
    }
    return result;
  }, [filtered, sections]);
  const visibleKey = visibleAnnotationIds.join(",");
  useLayoutEffect(() => {
    const el = content.current;
    if (!el) return;
    const measure = () => {
      const rows = Array.from(
        el.querySelectorAll<HTMLElement>('[data-in-view="true"]'),
      );
      if (!rows.length) {
        setBounds(null);
        return;
      }
      const top = Math.min(...rows.map((r) => r.offsetTop)) - 4;
      const bottom =
        Math.max(...rows.map((r) => r.offsetTop + r.offsetHeight)) + 6;
      setBounds((old) =>
        old?.top === top && old?.bottom === bottom ? old : { top, bottom },
      );
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    return () => resize.disconnect();
  }, [visibleKey, groups]);
  useEffect(() => {
    const el = scroller.current;
    if (!el || !bounds || draft) return;
    const padding = 24;
    if (bounds.bottom - bounds.top > el.clientHeight - padding * 2)
      el.scrollTo({
        top: Math.max(0, bounds.top - padding),
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    else if (bounds.bottom > el.scrollTop + el.clientHeight - padding)
      el.scrollTo({
        top: Math.max(0, bounds.bottom - el.clientHeight + padding),
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    else if (bounds.top < el.scrollTop + padding)
      el.scrollTo({
        top: Math.max(0, bounds.top - padding),
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [bounds, draft]);
  return (
    <aside className="annotation-list-panel" aria-label="Annotations list">
      <div className="list-filters">
        {(["all", "highlight", "note", "question"] as const).map((kind) => (
          <button
            key={kind}
            className={`filter-chip ${filter === kind ? "active" : ""}`}
            aria-pressed={filter === kind}
            onClick={() => setFilter(kind)}
          >
            {kind === "all"
              ? "All"
              : kind === "highlight"
                ? "Highlights"
                : kind === "note"
                  ? "Notes"
                  : "Questions"}{" "}
            <span>
              {
                annotations.filter((a) => kind === "all" || a.kind === kind)
                  .length
              }
            </span>
          </button>
        ))}
      </div>
      {pageFilter !== null && (
        <button className="page-filter" onClick={onClearPageFilter}>
          Page {pageLabel(pageFilter, labels)} · Show all pages ×
        </button>
      )}
      <div ref={scroller} className="list-scroll">
        <div className="list-content" ref={content}>
          {bounds && (
            <div
              className="in-view-wrapper"
              aria-hidden="true"
              style={{
                top: bounds.top,
                bottom: `calc(100% - ${bounds.bottom}px)`,
              }}
            ></div>
          )}
          {groups.map((group, i) => (
            <section className="annotation-group" key={`${group.title}-${i}`}>
              <h3
                className={`list-section ${group.annotations.some((a) => visibleAnnotationIds.includes(a.id)) ? "current" : ""}`}
              >
                {group.title}
              </h3>
              {group.annotations.map((a) => (
                <div
                  key={a.id}
                  className={`list-entry ${active === a.id ? "selected" : ""}`}
                  data-in-view={visibleAnnotationIds.includes(a.id)}
                >
                  {visibleAnnotationIds.includes(a.id) &&
                    !visibleAnnotationIds.includes(
                      filtered[filtered.indexOf(a) - 1]?.id,
                    ) && <div className="list-in-view-label">In view</div>}
                  {draft?.id === a.id ? (
                    <Composer
                      draft={draft}
                      onChange={onDraftChange}
                      onTypeChange={onDraftTypeChange}
                      onCancel={onDraftCancel}
                      onSave={onDraftSave}
                    />
                  ) : (
                    <AnnotationCard
                      annotation={a}
                      active={active === a.id}
                      labels={labels}
                      selectable
                      showQuote
                      onOpen={onOpen}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  )}
                </div>
              ))}
            </section>
          ))}
          {!bounds && annotations.length > 0 && (
            <div className="nothing-marked">
              You’re on p. {pageLabel(page, labels)} · nothing marked here
            </div>
          )}
          {annotations.length === 0 ? (
            <EmptyAnnotations />
          ) : (
            !filtered.length && (
              <p className="list-empty">
                No {filter === "all" ? "annotations" : `${filter}s`} here yet.
              </p>
            )
          )}
        </div>
      </div>
    </aside>
  );
}
