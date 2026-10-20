"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Annotation, Kind } from "@/lib/annotations";
import {
  kindLabel,
  pageLabel,
  sectionForAnnotation,
  sortedAnnotations,
  type OutlineSection,
} from "@/lib/reader-model";
import { EmptyAnnotations } from "./annotation-layers";
export function AnnotationList({
  annotations,
  sections,
  labels,
  visiblePages,
  page,
  active,
  pageFilter,
  onClearPageFilter,
  onOpen,
}: {
  annotations: Annotation[];
  sections: OutlineSection[];
  labels: string[] | null;
  visiblePages: number[];
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
            (filter === "all" || a.kind === filter) &&
            (pageFilter === null || a.page === pageFilter),
        ),
      ),
    [annotations, filter, pageFilter],
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
  const visibleKey = visiblePages.join(",");
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
      const top = Math.min(...rows.map((r) => r.offsetTop)) - 6;
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
    if (!el || !bounds) return;
    const padding = 24;
    if (bounds.bottom > el.scrollTop + el.clientHeight - padding)
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
  }, [bounds]);
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
            >
              <span>IN VIEW</span>
            </div>
          )}
          {groups.map((group, i) => (
            <section className="annotation-group" key={`${group.title}-${i}`}>
              <h3
                className={`list-section ${group.annotations.some((a) => visiblePages.includes(a.page)) ? "current" : ""}`}
                data-in-view={visiblePages.includes(group.annotations[0].page)}
              >
                {group.title}
              </h3>
              {group.annotations.map((a) => (
                <button
                  key={a.id}
                  className={`list-row ${a.kind} ${a.id === active ? "active" : ""}`}
                  data-in-view={visiblePages.includes(a.page)}
                  onClick={() => onOpen(a)}
                  aria-label={`${kindLabel[a.kind]} on page ${pageLabel(a.page, labels)}: ${a.body || a.quote}`}
                  aria-pressed={a.id === active}
                >
                  <i className={`signal ${a.kind}`} />
                  <span className="list-page">
                    p. {pageLabel(a.page, labels)}
                  </span>
                  <span className="list-quote">“{a.quote}”</span>
                  {a.body && <span className="list-body">{a.body}</span>}
                  {!a.rects.length && (
                    <small className="location-note">Location not found</small>
                  )}
                </button>
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
