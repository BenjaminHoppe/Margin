"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeftToLine, ChevronRight, PanelLeft } from "lucide-react";
import type { Annotation } from "@/lib/annotations";
import {
  chaptersFromOutline,
  annotationsForSection,
  pageLabel,
  sectionForPosition,
  sectionProgress,
  sortedAnnotations,
  type Chapter,
  type MinimapMode,
  type OutlineSection,
  type ShowOnPage,
} from "@/lib/reader-model";
import { AnnotationCard } from "./annotation-layers";
function RowSignals({
  annotations,
  show,
  preview = false,
  labels = null,
  onOpen,
  onPreviewEnter,
  onPreviewLeave,
}: {
  annotations: Annotation[];
  show: ShowOnPage;
  preview?: boolean;
  labels?: string[] | null;
  onOpen?: (annotation: Annotation) => void;
  onPreviewEnter?: () => void;
  onPreviewLeave?: () => void;
}) {
  const [hover, setHover] = useState<{
    kind: Annotation["kind"];
    items: Annotation[];
    left: number;
    top: number;
  } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function leavePreview() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setHover(null), 180);
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (!hover) return;
    const dismiss = (event?: Event) => {
      if (
        event?.target instanceof Node &&
        panel.current?.contains(event.target)
      )
        return;
      // The source marker stays fixed while the paper scrolls, including
      // after opening a card. Only moving the sidebar invalidates its anchor.
      if (
        event?.type === "scroll" &&
        !(
          event.target instanceof HTMLElement &&
          event.target.classList.contains("contents-scroll")
        )
      )
        return;
      if (timer.current) clearTimeout(timer.current);
      setHover(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("keydown", escape);
    };
  }, [hover]);
  return (
    <span className="row-signals">
      {(["highlight", "note", "question"] as const).map((kind) => {
        const items = sortedAnnotations(
          annotations.filter((a) => a.kind === kind),
        );
        if (!show[kind] || !items.length) return null;
        const label = `${items.length} ${kind}${items.length === 1 ? "" : "s"}`;
        return (
          <span
            key={kind}
            className={preview ? "signal-preview-target" : undefined}
            data-preview-open={hover?.kind === kind}
            role="img"
            aria-label={label}
            onMouseEnter={
              preview
                ? (event) => {
                    onPreviewEnter?.();
                    if (timer.current) clearTimeout(timer.current);
                    const rect = event.currentTarget.getBoundingClientRect();
                    const left =
                      rect.right + 12 + 320 <= innerWidth - 12
                        ? rect.right + 12
                        : Math.max(12, rect.left - 332);
                    const top = Math.max(
                      12,
                      Math.min(innerHeight - 320, rect.top - 16),
                    );
                    timer.current = setTimeout(
                      () => setHover({ kind, items, left, top }),
                      140,
                    );
                  }
                : undefined
            }
            onMouseLeave={preview ? leavePreview : undefined}
            onClick={
              preview
                ? (event) => {
                    event.stopPropagation();
                    event.preventDefault();
                  }
                : undefined
            }
          >
            <i className={`signal ${kind}`} aria-hidden="true" />
          </span>
        );
      })}
      {hover &&
        createPortal(
          <div
            ref={panel}
            className={`signal-preview ${hover.items.length > 1 ? "is-grouped" : ""}`}
            role="region"
            aria-label={`${hover.kind} previews`}
            style={{
              left: hover.left,
              top: hover.top,
              maxHeight: `calc(100dvh - ${hover.top + 24}px)`,
            }}
            onMouseEnter={() => {
              onPreviewEnter?.();
              if (timer.current) clearTimeout(timer.current);
            }}
            onMouseLeave={() => {
              leavePreview();
              onPreviewLeave?.();
            }}
            onFocus={() => {
              onPreviewEnter?.();
              if (timer.current) clearTimeout(timer.current);
            }}
            onClick={(event) => event.stopPropagation()}
            onWheel={(event) => event.stopPropagation()}
          >
            {hover.items.map((annotation) => (
              <AnnotationCard
                key={annotation.id}
                annotation={annotation}
                labels={labels}
                onOpen={onOpen}
                preview
              />
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}
export function Navigation({
  animateProgress = false,
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
  onOpenAnnotation,
}: {
  animateProgress?: boolean;
  mode: MinimapMode;
  focus: boolean;
  page: number;
  fraction: number;
  annotations: Annotation[];
  sections: OutlineSection[];
  labels: string[] | null;
  show: ShowOnPage;
  onMode: (mode: MinimapMode) => void;
  onOpenAnnotation: (annotation: Annotation) => void;
  pageCount?: number;
  neptune?: boolean;
  onJump: (page: number, fraction?: number, smooth?: boolean) => void;
}) {
  const chapters = useMemo(
    () => chaptersFromOutline(sections, pageCount, neptune),
    [sections, pageCount, neptune],
  );
  const [hover, setHover] = useState<{
    chapter: Chapter;
    top: number;
  } | null>(null);
  const flyout = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(["1. Scientific Objectives", "Science Closure"]),
  );
  const [destination, setDestination] = useState<OutlineSection | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const contentsScroll = useRef<HTMLDivElement>(null);
  const contentsGeometry = useRef<
    {
      start: number;
      end: number;
      top: number;
      height: number;
    }[]
  >([]);
  const readingPosition = useRef(page + fraction);
  const updateContentsFill = useCallback(() => {
    const position = readingPosition.current;
    let target = 0;
    for (const segment of contentsGeometry.current) {
      if (position + 0.005 >= segment.end)
        target = segment.top + segment.height;
      else if (position >= segment.start)
        target =
          segment.top +
          segment.height *
            Math.max(
              0,
              Math.min(
                1,
                (position - segment.start) /
                  Math.max(0.0001, segment.end - segment.start),
              ),
            );
    }
    contentsScroll.current?.style.setProperty(
      "--contents-read-y",
      `${target}px`,
    );
  }, []);
  useLayoutEffect(() => {
    readingPosition.current = page + fraction;
    updateContentsFill();
  }, [page, fraction, updateContentsFill]);
  const [grabbed, setGrabbed] = useState(false);
  const grabOffset = useRef(0);
  const pointerStart = useRef<number | null>(null);
  const dragging = useRef(false);
  // One indicator travels across chapter boundaries instead of remounting in each segment.
  useLayoutEffect(() => {
    if (mode !== "map" || focus) return;
    const update = () => {
      const track = rail.current?.querySelector<HTMLElement>(
        '.chapter-segment[data-reading="true"] .chapter-track',
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
      const y =
        offset +
        Math.max(
          10,
          Math.min(track.clientHeight - 10, position * track.clientHeight),
        );
      ring.style.transform = `translateY(${y - 10}px)`;
    };
    update();
    const observer = new ResizeObserver(update);
    if (rail.current) observer.observe(rail.current);
    return () => observer.disconnect();
  }, [page, fraction, chapters, mode, focus]);
  // Condense neighboring annotations of the same type before packing the
  // remaining markers into lanes. The chapter preview retains every card.
  useLayoutEffect(() => {
    const root = rail.current;
    if (!root || mode !== "map" || focus) return;
    const pack = () => {
      const edges: { element: HTMLElement; right: number }[] = [];
      const placements: {
        element: HTMLElement;
        visible: boolean;
        left: number;
        offset: number;
        count: number;
      }[] = [];
      root
        .querySelectorAll<HTMLElement>(".chapter-markers")
        .forEach((group) => {
          const clusters: {
            element: HTMLElement;
            center: number;
            height: number;
            origin: number;
            count: number;
          }[] = [];
          for (const kind of ["highlight", "note", "question"] as const) {
            const markers = Array.from(
              group.querySelectorAll<HTMLElement>(`.rail-marker.${kind}`),
            )
              .map((element) => ({
                element,
                center: element.offsetTop,
                height: element.offsetHeight,
              }))
              .sort((a, b) => a.center - b.center);
            let index = 0;
            while (index < markers.length) {
              const first = markers[index];
              let count = 1;
              index++;
              while (
                index < markers.length &&
                markers[index].center - first.center <
                  (first.height + markers[index].height) / 2
              ) {
                const overlapping = markers[index++];
                placements.push({
                  element: overlapping.element,
                  visible: false,
                  left: 40,
                  offset: 0,
                  count: 1,
                });
                count++;
              }
              clusters.push({
                element: first.element,
                center: first.center,
                height: first.height,
                origin: first.center,
                count,
              });
            }
          }
          clusters.sort((a, b) => a.center - b.center);
          let right = 42;
          const laneBottoms = [-Infinity, -Infinity, -Infinity];
          for (const cluster of clusters) {
            const top = cluster.center - cluster.height / 2;
            let lane = laneBottoms.findIndex((bottom) => bottom + 4 <= top);
            if (lane < 0) lane = laneBottoms.indexOf(Math.min(...laneBottoms));
            laneBottoms[lane] = cluster.center + cluster.height / 2;
            const left = [42, 52, 60][lane];
            right = Math.max(
              right,
              left +
                (cluster.element.classList.contains("highlight") ? 4 : 6) +
                6,
            );
            placements.push({
              element: cluster.element,
              visible: true,
              left,
              offset: cluster.center - cluster.origin,
              count: cluster.count,
            });
          }
          if (group.parentElement)
            edges.push({ element: group.parentElement, right });
        });
      const widestEdge = Math.max(42, ...edges.map(({ right }) => right));
      root.style.setProperty("--marker-edge", `${widestEdge}px`);
      root.parentElement?.style.setProperty("--rail-edge", `${widestEdge}px`);
      for (const { element, visible, left, offset, count } of placements) {
        element.style.visibility = visible ? "visible" : "hidden";
        element.style.left = `${left}px`;
        element.style.translate = `0 ${offset}px`;
        element.dataset.count = String(count);
      }
    };
    pack();
    const observer = new ResizeObserver(pack);
    root
      .querySelectorAll<HTMLElement>(".chapter-markers")
      .forEach((group) => observer.observe(group));
    return () => observer.disconnect();
  }, [annotations, show, chapters, mode, focus]);
  // Every visible segment clips the same animated fill front. There is no
  // per-section easing, so the motion carries through gaps and reverses cleanly.
  useLayoutEffect(() => {
    const scroller = contentsScroll.current;
    if (!scroller || focus || mode !== "contents") return;
    const update = () => {
      const items = Array.from(
        scroller.querySelectorAll<HTMLElement>(
          '.contents-item[data-visible="true"]',
        ),
      ).filter(
        (item) =>
          item.dataset.sectionStart !== undefined &&
          Number.isFinite(Number(item.dataset.sectionStart)),
      );
      const origin = scroller.getBoundingClientRect().top - scroller.scrollTop;
      const geometry: typeof contentsGeometry.current = [];
      const spinePositions: { element: HTMLElement; top: number }[] = [];
      items.forEach((item, index) => {
        const spine = item.querySelector<HTMLElement>(".contents-spine");
        if (!spine) return;
        // Read coordinates from the same rendered rows as the geometry. The
        // PDF outline can replace the fallback while a resize is queued.
        const start = Number(item.dataset.sectionStart);
        const following = items[index + 1];
        const end = following
          ? Number(following.dataset.sectionStart)
          : pageCount + 1;
        const rect = spine.getBoundingClientRect();
        const top = rect.top - origin;
        spinePositions.push({ element: spine, top });
        geometry.push({ start, end, top, height: rect.height });
      });
      // Finish all geometry reads before writing styles; interleaving these
      // forces repeated layout during the tree's expansion animation.
      spinePositions.forEach(({ element, top }) => {
        element.style.setProperty("--spine-top", `${top}px`);
      });
      contentsGeometry.current = geometry;
      updateContentsFill();
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    scroller
      .querySelectorAll('.contents-item[data-visible="true"]')
      .forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [sections, pageCount, expanded, mode, focus, updateContentsFill]);
  useLayoutEffect(() => {
    const panel = flyout.current;
    const scroller = panel?.querySelector<HTMLElement>(".flyout-scroll");
    const content = scroller?.querySelector<HTMLElement>(".flyout-chapter");
    if (!hover || !panel || !scroller || !content || mode !== "map") return;
    // Keep one floating shell and measure natural content so shorter chapters
    // can shrink after long ones without changing the text layout.
    const measure = () => {
      const panelStyle = getComputedStyle(panel);
      const scrollStyle = getComputedStyle(scroller);
      const extra = [
        panelStyle.paddingTop,
        panelStyle.paddingBottom,
        panelStyle.borderTopWidth,
        panelStyle.borderBottomWidth,
        scrollStyle.paddingTop,
        scrollStyle.paddingBottom,
      ].reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
      panel.style.height = `${Math.min(content.getBoundingClientRect().height + extra, innerHeight - hover.top - 24)}px`;
    };
    scroller.scrollTop = 0;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [hover, mode]);
  function scrub(clientY: number, smooth: boolean) {
    const elements =
      rail.current?.querySelectorAll<HTMLElement>(".chapter-segment");
    if (!elements?.length) return;
    let index = Array.from(elements).findIndex(
      (el) => clientY <= el.getBoundingClientRect().bottom,
    );
    if (index < 0) index = elements.length - 1;
    const r = (
      elements[index].querySelector<HTMLElement>(".chapter-track") ??
      elements[index]
    ).getBoundingClientRect();
    const chapter = chapters[index];
    const value =
      Math.max(0, Math.min(0.9999, (clientY - r.top) / r.height)) *
      (chapter.end - chapter.start + 1);
    const targetPage = chapter.start + Math.floor(value);
    setDestination(sectionForPosition(targetPage, value % 1, sections));
    onJump(targetPage, value % 1, smooth);
  }
  const progress = Math.round(((page - 1 + fraction) / pageCount) * 100);
  const current =
    destination &&
    (animateProgress ||
      Math.abs(page + fraction - destination.page - (destination.y ?? 0)) <
        0.001)
      ? destination
      : sectionForPosition(page, fraction, sections);
  const activePage = animateProgress && destination ? destination.page : page;
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHover(null);
      if (
        [
          "ArrowLeft",
          "ArrowRight",
          "PageUp",
          "PageDown",
          "Home",
          "End",
        ].includes(e.key)
      )
        setDestination(null);
    };
    const resize = () => setHover(null);
    window.addEventListener("keydown", close);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", resize);
    };
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
    const rect = el.getBoundingClientRect();
    setHover({
      chapter,
      top: Math.max(24, Math.min(innerHeight - 320, rect.top - 16)),
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
  // A click selects its destination immediately, without flashing the active
  // state through every intermediate heading during the smooth scroll. Preserve
  // it on arrival too when a parent and child share the same coordinates.
  const visibleCurrent =
    destination &&
    rows.includes(destination) &&
    (animateProgress ||
      Math.abs(page + fraction - destination.page - (destination.y ?? 0)) <
        0.001)
      ? destination
      : sectionForPosition(page, fraction, rows);
  if (focus) return null;
  return (
    <>
      <nav
        className={`document-navigation is-${mode}`}
        style={
          {
            "--minimap-natural-height": `${Math.max(pageCount * 40, chapters.length * 52 + 12)}px`,
          } as CSSProperties
        }
        aria-label="Document navigation"
        onMouseEnter={keep}
        onMouseLeave={leave}
      >
        <div
          className="minimap-rail"
          ref={rail}
          inert={mode !== "map"}
          data-grabbed={grabbed}
        >
          {chapters.map((chapter, index) => {
            const chapterAnnotations = annotations.filter(
              (a) =>
                a.page >= chapter.start &&
                a.page <= chapter.end &&
                show[a.kind],
            );
            const count = chapter.end - chapter.start + 1;
            const position = Math.max(
              0,
              Math.min(1, (page - chapter.start + fraction) / count),
            );
            const isReading = page >= chapter.start && page <= chapter.end;
            const isCurrent =
              activePage >= chapter.start && activePage <= chapter.end;
            return (
              <button
                key={chapter.id}
                className={`chapter-segment ${isCurrent ? "current" : ""}`}
                data-reading={isReading}
                data-flyout-open={hover?.chapter.id === chapter.id}
                style={{ flexGrow: count } as CSSProperties}
                aria-label={`${chapter.title}, pages ${pageLabel(chapter.start, labels)} to ${pageLabel(chapter.end, labels)}`}
                aria-current={isCurrent ? "location" : undefined}
                onMouseEnter={(e) => {
                  if (!grabbed) reveal(chapter, e.currentTarget);
                }}
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
                  pointerStart.current = e.clientY;
                  dragging.current = false;
                  scrub(e.clientY, true);
                }}
                onPointerMove={(e) => {
                  if (
                    pointerStart.current === null ||
                    !e.currentTarget.hasPointerCapture(e.pointerId) ||
                    !(e.buttons & 1)
                  )
                    return;
                  if (
                    !dragging.current &&
                    Math.abs(e.clientY - pointerStart.current!) < 4
                  )
                    return;
                  dragging.current = true;
                  scrub(e.clientY, false);
                }}
                onLostPointerCapture={() => {
                  dragging.current = false;
                  pointerStart.current = null;
                }}
                onClick={(e) => {
                  if (e.detail === 0) {
                    setDestination(
                      sectionForPosition(chapter.start, 0, sections),
                    );
                    onJump(chapter.start);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    rail.current
                      ?.querySelectorAll<HTMLButtonElement>(".chapter-segment")
                      [
                        (index +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          chapters.length) %
                          chapters.length
                      ]?.focus();
                  }
                }}
                onWheel={(e) => {
                  const target = Math.max(
                    1,
                    Math.min(pageCount, page + (e.deltaY > 0 ? 1 : -1)),
                  );
                  setDestination(sectionForPosition(target, 0, sections));
                  onJump(target);
                }}
              >
                <span className="chapter-label">{chapter.id}</span>
                <span className="chapter-track">
                  <i
                    style={{
                      height: "100%",
                      transform: `translateY(${(position - 1) * 100}%)`,
                    }}
                  />
                </span>
                <span className="chapter-markers" aria-hidden="true">
                  {chapterAnnotations.map((a) => (
                    <span
                      key={a.id}
                      className={`rail-marker ${a.kind}`}
                      style={{
                        top: `clamp(7px, ${((a.page - chapter.start + (a.rects[0]?.y ?? 0.5)) / count) * 100}%, calc(100% - 7px))`,
                      }}
                    />
                  ))}
                </span>
              </button>
            );
          })}
          <span
            ref={indicator}
            className="viewport-ring rail-position"
            role="slider"
            tabIndex={0}
            aria-label="Reading position"
            aria-orientation="vertical"
            aria-valuemin={1}
            aria-valuemax={pageCount + 1}
            aria-valuenow={page + fraction}
            aria-valuetext={`Page ${pageLabel(page, labels)}, ${Math.round(fraction * 100)}% through page`}
            data-grabbed={grabbed}
            onPointerDown={(event) => {
              if (event.button !== 0) return;
              event.preventDefault();
              event.stopPropagation();
              keep();
              setHover(null);
              const track = rail.current?.querySelector<HTMLElement>(
                '.chapter-segment[data-reading="true"] .chapter-track',
              );
              const chapter = chapters.find(
                (c) => page >= c.start && page <= c.end,
              );
              if (!track || !chapter) return;
              const rect = track.getBoundingClientRect();
              const position =
                (page - chapter.start + fraction) /
                (chapter.end - chapter.start + 1);
              // Preserve the grabbed point, including when the handle is inset
              // at the track's ends, rather than snapping the page on pickup.
              grabOffset.current =
                event.clientY - (rect.top + position * rect.height);
              pointerStart.current = event.clientY;
              dragging.current = false;
              event.currentTarget.setPointerCapture(event.pointerId);
              setGrabbed(true);
              onJump(page, fraction, false);
            }}
            onPointerMove={(event) => {
              if (
                !event.currentTarget.hasPointerCapture(event.pointerId) ||
                pointerStart.current === null
              )
                return;
              if (
                !dragging.current &&
                Math.abs(event.clientY - pointerStart.current) < 2
              )
                return;
              dragging.current = true;
              scrub(event.clientY - grabOffset.current, false);
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onPointerCancel={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId))
                event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onLostPointerCapture={() => {
              setGrabbed(false);
              dragging.current = false;
              pointerStart.current = null;
            }}
            onKeyDown={(event) => {
              const step =
                event.key === "PageDown"
                  ? 5
                  : event.key === "PageUp"
                    ? -5
                    : event.key === "ArrowDown" || event.key === "ArrowRight"
                      ? 1
                      : event.key === "ArrowUp" || event.key === "ArrowLeft"
                        ? -1
                        : 0;
              if (!step && event.key !== "Home" && event.key !== "End") return;
              event.preventDefault();
              event.stopPropagation();
              const target =
                event.key === "Home"
                  ? 1
                  : event.key === "End"
                    ? pageCount
                    : Math.max(1, Math.min(pageCount, page + step));
              setDestination(sectionForPosition(target, 0, sections));
              onJump(target);
            }}
          />
        </div>

        <div className="contents-surface" inert={mode !== "contents"}>
          <div
            className="contents-scroll"
            ref={contentsScroll}
            data-animate-progress={animateProgress}
          >
            {sections.map((s) => {
              const sourceIndex = sections.indexOf(s);
              const children =
                (sections[sourceIndex + 1]?.depth ?? 0) > (s.depth ?? 0);
              const titleBreak = s.title.lastIndexOf(" ") + 1;
              const isCurrent = s === visibleCurrent;
              const progress = sectionProgress(
                sourceIndex,
                page,
                fraction,
                sections,
                pageCount,
              );
              return (
                <div
                  key={`${s.title}-${sourceIndex}`}
                  className="contents-item"
                  data-visible={rows.includes(s)}
                  data-depth={s.depth ?? 0}
                  data-section-start={s.page + (s.y ?? 0)}
                  inert={!rows.includes(s)}
                  aria-hidden={!rows.includes(s)}
                >
                  <div className="contents-item-inner">
                    <div
                      className={`contents-row ${isCurrent ? "current" : ""} ${progress === 1 ? "read" : ""}`}
                      style={{ "--depth": s.depth ?? 0 } as CSSProperties}
                    >
                      <span className="contents-spine">
                        <i />
                      </span>
                      <button
                        className="contents-jump"
                        aria-current={isCurrent ? "location" : undefined}
                        aria-expanded={
                          children ? expanded.has(s.title) : undefined
                        }
                        onClick={() => {
                          if (
                            children &&
                            expanded.has(s.title) &&
                            isCurrent &&
                            !animateProgress
                          ) {
                            setExpanded((old) => {
                              const next = new Set(old);
                              next.delete(s.title);
                              return next;
                            });
                            return;
                          }
                          if (children)
                            setExpanded((old) => new Set(old).add(s.title));
                          setDestination(s);
                          onJump(s.page, s.y ?? 0);
                        }}
                      >
                        <span className="contents-title">
                          {children ? (
                            <>
                              {s.title.slice(0, titleBreak)}
                              <span className="contents-title-ending">
                                {s.title.slice(titleBreak)}
                                <ChevronRight
                                  className="contents-chevron"
                                  size={16}
                                  aria-hidden="true"
                                  data-expanded={expanded.has(s.title)}
                                />
                              </span>
                            </>
                          ) : (
                            s.title
                          )}
                        </span>
                        <RowSignals
                          labels={labels}
                          onOpen={(annotation) => {
                            setDestination(
                              sectionForPosition(
                                annotation.page,
                                annotation.rects[0]?.y ?? 0,
                                rows,
                              ),
                            );
                            onOpenAnnotation(annotation);
                          }}
                          preview
                          annotations={annotationsForSection(
                            s,
                            sections,
                            annotations,
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

        {mode === "map" && hover && (
          <div
            ref={flyout}
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
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) leave();
            }}
          >
            <div
              className="flyout-scroll"
              role="region"
              aria-label={`${hover.chapter.title} sections`}
              tabIndex={0}
            >
              {[hover.chapter].map((chapter) => (
                <section
                  key={chapter.id}
                  data-chapter={chapter.id}
                  className="flyout-chapter"
                >
                  <header>
                    <span className="eyebrow">
                      {chapter.id === "FM"
                        ? "Front matter"
                        : /^[ABC]$/.test(chapter.id)
                          ? `Appendix ${chapter.id}`
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
                      const read =
                        sectionProgress(
                          sections.indexOf(s),
                          page,
                          fraction,
                          sections,
                          pageCount,
                        ) === 1;
                      return (
                        <button
                          key={`${s.title}-${index}`}
                          className={`flyout-row ${s === current ? "current" : ""} ${read ? "read" : ""}`}
                          aria-current={s === current ? "location" : undefined}
                          style={
                            {
                              "--depth": Math.max(0, (s.depth ?? 0) - 1),
                            } as CSSProperties
                          }
                          onClick={() => {
                            setDestination(s);
                            onJump(s.page, s.y ?? 0);
                          }}
                        >
                          <span>{s.title}</span>
                          <RowSignals
                            preview
                            labels={labels}
                            onPreviewEnter={keep}
                            onPreviewLeave={leave}
                            onOpen={(annotation) => {
                              setDestination(
                                sectionForPosition(
                                  annotation.page,
                                  annotation.rects[0]?.y ?? 0,
                                  sections,
                                ),
                              );
                              onOpenAnnotation(annotation);
                            }}
                            annotations={annotationsForSection(
                              s,
                              sections,
                              annotations,
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
          className="icon-button navigation-toggle"
          aria-expanded={mode === "contents"}
          aria-label={mode === "map" ? "Open contents" : "Collapse contents"}
          title={
            mode === "map" ? "Open contents (\\)" : "Collapse contents (\\)"
          }
          onClick={() => {
            setHover(null);
            onMode(mode === "map" ? "contents" : "map");
          }}
        >
          <span
            className="navigation-toggle-state"
            data-visible={mode === "map"}
            aria-hidden="true"
          >
            <PanelLeft size={14} />
          </span>
          <span
            className="navigation-toggle-state"
            data-visible={mode === "contents"}
            aria-hidden="true"
          >
            <ArrowLeftToLine size={14} />
          </span>
        </button>
      </div>
    </>
  );
}
