"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  ArrowLeftToLine,
  ChevronDown,
  ChevronRight,
  PanelLeft,
} from "lucide-react";
import { Presence } from "./ui";
import type { Annotation } from "@/lib/annotations";
import {
  chaptersFromOutline,
  pageLabel,
  sectionForPage,
  type Chapter,
  type MinimapMode,
  type OutlineSection,
  type ShowOnPage,
} from "@/lib/reader-model";
function RowSignals({
  annotations,
  show,
}: {
  annotations: Annotation[];
  show: ShowOnPage;
}) {
  return (
    <span className="row-signals" aria-hidden="true">
      {(["highlight", "note", "question"] as const).map(
        (kind) =>
          show[kind] &&
          annotations.some((a) => a.kind === kind) && (
            <i key={kind} className={`signal ${kind}`} />
          ),
      )}
    </span>
  );
}
export function Navigation({
  pageCount = 116,
  neptune = true,
  mode,
  focus,
  page,
  fraction,
  annotations,
  sections,
  labels,
  show,
  onMode,
  onJump,
}: {
  mode: MinimapMode;
  focus: boolean;
  page: number;
  fraction: number;
  annotations: Annotation[];
  sections: OutlineSection[];
  labels: string[] | null;
  show: ShowOnPage;
  onMode: (mode: MinimapMode) => void;
  pageCount?: number;
  neptune?: boolean;
  onJump: (page: number, fraction?: number, smooth?: boolean) => void;
}) {
  const chapters = useMemo(
    () => chaptersFromOutline(sections, pageCount, neptune),
    [sections, pageCount, neptune],
  );
  const [hover, setHover] = useState<{ chapter: Chapter; top: number } | null>(
    null,
  );
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["1. Scientific Objectives", "Science Closure"]),
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const flyoutScroll = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const dragging = useRef(false);
  // One indicator travels across chapter boundaries instead of remounting in each segment.
  useEffect(() => {
    if (mode !== "map" || focus) return;
    const update = () => {
      const track = rail.current?.querySelector<HTMLElement>(
        ".chapter-segment.current .chapter-track",
      );
      const ring = indicator.current;
      if (!track || !ring || !rail.current) return;
      const chapter = chapters.find((c) => page >= c.start && page <= c.end);
      if (!chapter) return;
      const position = Math.max(
        0,
        Math.min(
          1,
          (page - chapter.start + fraction) / (chapter.end - chapter.start + 1),
        ),
      );
      const offset =
        track.getBoundingClientRect().top -
        rail.current.getBoundingClientRect().top;
      const y = offset + 10 + position * Math.max(0, track.clientHeight - 20);
      ring.style.transform = `translateY(${y - 9}px)`;
    };
    update();
    const observer = new ResizeObserver(update);
    if (rail.current) observer.observe(rail.current);
    return () => observer.disconnect();
  }, [page, fraction, chapters, mode, focus]);
  useEffect(() => {
    const scroller = flyoutScroll.current;
    const group = scroller?.querySelector<HTMLElement>(
      `[data-chapter="${hover?.chapter.id}"]`,
    );
    if (scroller && group) scroller.scrollTop = group.offsetTop;
  }, [hover?.chapter.id]);
  function scrub(clientY: number, smooth: boolean) {
    const elements =
      rail.current?.querySelectorAll<HTMLElement>(".chapter-segment");
    if (!elements?.length) return;
    let index = Array.from(elements).findIndex(
      (el) => clientY <= el.getBoundingClientRect().bottom,
    );
    if (index < 0) index = elements.length - 1;
    const r = elements[index].getBoundingClientRect();
    const chapter = chapters[index];
    const value =
      Math.max(0, Math.min(0.9999, (clientY - r.top) / r.height)) *
      (chapter.end - chapter.start + 1);
    onJump(chapter.start + Math.floor(value), value % 1, smooth);
  }
  const progress = Math.round(((page - 1 + fraction) / pageCount) * 100);
  const current = sectionForPage(page, sections);
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHover(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  function keep() {
    if (timer.current) clearTimeout(timer.current);
  }
  function leave() {
    keep();
    timer.current = setTimeout(() => setHover(null), 150);
  }
  function reveal(chapter: Chapter, el: HTMLElement) {
    keep();
    setHover({
      chapter,
      top: Math.max(
        80,
        Math.min(innerHeight - 504, el.getBoundingClientRect().top - 18),
      ),
    });
  }
  const rows = sections.filter((s, index) => {
    for (let i = index - 1; i >= 0; i--) {
      if ((sections[i].depth ?? 0) < (s.depth ?? 0)) {
        if (!expanded.has(sections[i].title)) return false;
        s = sections[i];
      }
    }
    return true;
  });
  if (focus)
    return (
      <div className="focus-progress" aria-label={`${progress}% read`}>
        <span>
          <i style={{ height: `${progress}%` }} />
        </span>
        <small>{progress}%</small>
      </div>
    );
  return (
    <>
      <nav
        className={`document-navigation is-${mode}`}
        aria-label="Document navigation"
        onMouseEnter={keep}
        onMouseLeave={leave}
      >
        <Presence open={mode === "map"}>
          <div className="minimap-rail" ref={rail} inert={mode !== "map"}>
            {chapters.map((chapter, index) => {
              const count = chapter.end - chapter.start + 1;
              const position = Math.max(
                0,
                Math.min(1, (page - chapter.start + fraction) / count),
              );
              const isCurrent = page >= chapter.start && page <= chapter.end;
              return (
                <button
                  key={chapter.id}
                  className={`chapter-segment ${isCurrent ? "current" : ""}`}
                  style={{ flexGrow: count } as CSSProperties}
                  aria-label={`${chapter.title}, pages ${pageLabel(chapter.start, labels)} to ${pageLabel(chapter.end, labels)}`}
                  aria-current={isCurrent ? "location" : undefined}
                  onMouseEnter={(e) => reveal(chapter, e.currentTarget)}
                  onFocus={(e) => reveal(chapter, e.currentTarget)}
                  onBlur={(e) => {
                    if (
                      !e.currentTarget.parentElement?.parentElement?.contains(
                        e.relatedTarget as Node,
                      )
                    )
                      leave();
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragging.current = true;
                    rail.current?.classList.add("is-dragging");
                    scrub(e.clientY, true);
                  }}
                  onPointerMove={(e) => {
                    if (
                      !dragging.current ||
                      !e.currentTarget.hasPointerCapture(e.pointerId) ||
                      !(e.buttons & 1)
                    )
                      return;
                    scrub(e.clientY, false);
                  }}
                  onLostPointerCapture={() => {
                    dragging.current = false;
                    rail.current?.classList.remove("is-dragging");
                  }}
                  onClick={(e) => {
                    if (e.detail === 0) onJump(chapter.start);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                      e.preventDefault();
                      rail.current
                        ?.querySelectorAll<HTMLButtonElement>(
                          ".chapter-segment",
                        )
                        [
                          (index +
                            (e.key === "ArrowDown" ? 1 : -1) +
                            chapters.length) %
                            chapters.length
                        ]?.focus();
                    }
                  }}
                  onWheel={(e) =>
                    onJump(
                      Math.max(
                        1,
                        Math.min(pageCount, page + (e.deltaY > 0 ? 1 : -1)),
                      ),
                    )
                  }
                >
                  <span className="chapter-label">{chapter.id}</span>
                  <span className="chapter-track">
                    <i style={{ height: `${position * 100}%` }} />
                  </span>
                  {annotations
                    .filter(
                      (a) =>
                        a.page >= chapter.start &&
                        a.page <= chapter.end &&
                        show[a.kind],
                    )
                    .map((a) => (
                      <span
                        key={a.id}
                        className={`rail-marker ${a.kind}`}
                        style={{
                          top: `clamp(7px, ${((a.page - chapter.start + (a.rects[0]?.y ?? 0.5)) / count) * 100}%, calc(100% - 7px))`,
                        }}
                      />
                    ))}
                  {show.understanding &&
                    annotations
                      .filter(
                        (a) =>
                          a.page >= chapter.start &&
                          a.page <= chapter.end &&
                          a.understanding !== "unmarked" &&
                          show[a.kind],
                      )
                      .map((a) => (
                        <span
                          key={`u-${a.id}`}
                          className={`rail-understanding understanding-dot ${a.understanding.replaceAll(" ", "-")}`}
                          style={{
                            top: `clamp(7px, ${((a.page - chapter.start + 0.5) / count) * 100}%, calc(100% - 7px))`,
                          }}
                        />
                      ))}
                </button>
              );
            })}
            <span
              ref={indicator}
              className="viewport-ring rail-position"
              aria-hidden="true"
            />
          </div>
        </Presence>
        <Presence open={mode === "contents"}>
          <div className="contents-surface" inert={mode !== "contents"}>
            <div className="contents-scroll">
              {sections.map((s) => {
                const sourceIndex = sections.indexOf(s);
                const children =
                  (sections[sourceIndex + 1]?.depth ?? 0) > (s.depth ?? 0);
                const next =
                  sections.slice(sourceIndex + 1).find((n) => n.page > s.page)
                    ?.page ?? pageCount + 1;
                const isCurrent = s === current;
                return (
                  <div
                    key={`${s.title}-${sourceIndex}`}
                    className="contents-item"
                    data-visible={rows.includes(s)}
                    inert={!rows.includes(s)}
                    aria-hidden={!rows.includes(s)}
                  >
                    <div className="contents-item-inner">
                      <>
                        {s.title.startsWith("A.") && (
                          <h3 className="appendices-label eyebrow">
                            Appendices
                          </h3>
                        )}
                      </>
                      <div
                        className={`contents-row ${isCurrent ? "current" : ""} ${s.page < page ? "read" : ""}`}
                        style={{ "--depth": s.depth ?? 0 } as CSSProperties}
                      >
                        <span className="contents-spine">
                          <i
                            style={{
                              height: `${Math.max(0, Math.min(1, (page - s.page + fraction) / Math.max(1, next - s.page))) * 100}%`,
                            }}
                          />
                          {isCurrent && <span className="viewport-ring" />}
                        </span>
                        {children && (
                          <button
                            className="tree-toggle"
                            aria-label={`${expanded.has(s.title) ? "Collapse" : "Expand"} ${s.title}`}
                            aria-expanded={expanded.has(s.title)}
                            onClick={() =>
                              setExpanded((old) => {
                                const set = new Set(old);
                                if (set.has(s.title)) set.delete(s.title);
                                else set.add(s.title);
                                return set;
                              })
                            }
                          >
                            {expanded.has(s.title) ? (
                              <ChevronDown size={11} />
                            ) : (
                              <ChevronRight size={11} />
                            )}
                          </button>
                        )}
                        <button
                          className="contents-jump"
                          aria-current={isCurrent ? "location" : undefined}
                          onClick={() => onJump(s.page)}
                        >
                          <span className="contents-title">{s.title}</span>
                          <RowSignals
                            annotations={annotations.filter(
                              (a) => a.page >= s.page && a.page < next,
                            )}
                            show={show}
                          />
                          <span className="contents-page">
                            {pageLabel(s.page, labels)}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Presence>
        {mode === "map" && hover && (
          <div
            key={hover.chapter.id}
            className="section-flyout"
            style={
              {
                top: hover.top,
                "--flyout-top": `${hover.top}px`,
              } as CSSProperties
            }
            onMouseEnter={keep}
            onMouseLeave={leave}
            onFocus={keep}
          >
            <div
              className="flyout-scroll"
              ref={flyoutScroll}
              role="region"
              aria-label="Document sections"
            >
              {chapters.map((chapter) => (
                <section
                  key={chapter.id}
                  data-chapter={chapter.id}
                  className="flyout-chapter"
                >
                  <header>
                    <span className="eyebrow">
                      {chapter.id === "FM"
                        ? "Front matter"
                        : `Chapter ${chapter.id}`}
                    </span>
                    <span>
                      Pages {pageLabel(chapter.start, labels)}–
                      {pageLabel(chapter.end, labels)}
                    </span>
                  </header>
                  <h2>{chapter.title}</h2>
                  {chapter.sections
                    .filter(
                      (s) =>
                        s.title !== chapter.title &&
                        s.title !== `${chapter.id}. ${chapter.title}`,
                    )
                    .map((s, index) => {
                      const next =
                        chapter.sections
                          .slice(chapter.sections.indexOf(s) + 1)
                          .find((n) => n.page > s.page)?.page ??
                        chapter.end + 1;
                      return (
                        <button
                          key={`${s.title}-${index}`}
                          className={`flyout-row ${s === current ? "current" : ""} ${s.page < page ? "read" : ""}`}
                          style={
                            {
                              "--depth": Math.max(0, (s.depth ?? 0) - 1),
                            } as CSSProperties
                          }
                          onClick={() => {
                            onJump(s.page);
                            setHover(null);
                          }}
                        >
                          <span>{s.title}</span>
                          <RowSignals
                            annotations={annotations.filter(
                              (a) => a.page >= s.page && a.page < next,
                            )}
                            show={show}
                          />
                          <small>{pageLabel(s.page, labels)}</small>
                        </button>
                      );
                    })}
                  {!chapter.sections.some(
                    (s) =>
                      s.title !== chapter.title &&
                      s.title !== `${chapter.id}. ${chapter.title}`,
                  ) && (
                    <button
                      className="flyout-row"
                      onClick={() => {
                        onJump(chapter.start);
                        setHover(null);
                      }}
                    >
                      Open {chapter.title}
                    </button>
                  )}
                </section>
              ))}
            </div>
          </div>
        )}
      </nav>
      <div className="navigation-footer">
        <span>{progress}%</span>
        <button
          className="icon-button"
          aria-label={mode === "map" ? "Open contents" : "Collapse contents"}
          title={
            mode === "map" ? "Open contents (\\)" : "Collapse contents (\\)"
          }
          onClick={() => {
            setHover(null);
            onMode(mode === "map" ? "contents" : "map");
          }}
        >
          {mode === "map" ? (
            <PanelLeft size={14} />
          ) : (
            <ArrowLeftToLine size={14} />
          )}
        </button>
      </div>
    </>
  );
}
