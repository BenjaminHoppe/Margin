"use client";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  Highlighter,
  MessageSquare,
  CircleHelp,
} from "lucide-react";
import { createPortal } from "react-dom";
import { mergeRects } from "@/lib/selection";
import type { Annotation, Draft, Kind } from "@/lib/annotations";
import {
  kindLabel,
  pageLabel,
  sortedAnnotations,
  type AnnotationMode,
  type ShowOnPage,
} from "@/lib/reader-model";
import { Composer } from "./annotating";
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
    </div>
  );
}
export function AnnotationCard({
  annotation,
  active = false,
  labels,
  onOpen,
  onEdit,
  onDelete,
  preview = false,
}: {
  annotation: Annotation;
  active?: boolean;
  labels: string[] | null;
  onOpen?: (a: Annotation) => void;
  onEdit?: (annotation: Annotation) => void;
  onDelete?: (annotation: Annotation) => void;
  preview?: boolean;
}) {
  const [action, setAction] = useState<"menu" | "delete" | null>(null);
  const card = useRef<HTMLElement>(null);
  const more = useRef<HTMLButtonElement>(null);
  const actionPanel = useRef<HTMLDivElement>(null);
  const deletePanel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (action !== "menu" || !more.current || !actionPanel.current) return;
    const anchor = more.current.getBoundingClientRect();
    const panel = actionPanel.current;
    panel.style.left = `${Math.max(12, Math.min(innerWidth - panel.offsetWidth - 12, anchor.right - panel.offsetWidth))}px`;
    panel.style.top = `${Math.max(12, anchor.bottom + 6 + panel.offsetHeight <= innerHeight - 12 ? anchor.bottom + 6 : anchor.top - panel.offsetHeight - 6)}px`;
  }, [action]);
  useEffect(() => {
    if (!action) return;
    const panel =
      action === "delete" ? deletePanel.current : actionPanel.current;
    panel
      ?.querySelector<HTMLButtonElement>("button")
      ?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !card.current?.contains(event.target) &&
        !actionPanel.current?.contains(event.target)
      )
        setAction(null);
    };
    const dismissMovedAnchor = (event: Event) => {
      if (
        action === "menu" &&
        (event.type === "resize" ||
          (event.target instanceof HTMLElement &&
            event.target.classList.contains("paper-viewport")))
      )
        setAction(null);
    };
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", dismissMovedAnchor);
    window.addEventListener("scroll", dismissMovedAnchor, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", dismissMovedAnchor);
      window.removeEventListener("scroll", dismissMovedAnchor, true);
    };
  }, [action]);
  const clickable = preview && Boolean(onOpen);
  const Main = clickable ? "button" : "div";
  return (
    <article
      ref={card}
      onKeyDown={(event) => {
        if (action && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          setAction(null);
          more.current?.focus({ preventScroll: true });
        }
        if (action === "delete" && event.key.startsWith("Arrow"))
          event.stopPropagation();
        if (
          action === "menu" &&
          ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
        ) {
          event.preventDefault();
          event.stopPropagation();
          const buttons = Array.from(
            actionPanel.current?.querySelectorAll<HTMLButtonElement>(
              ".card-actions button",
            ) ?? [],
          );
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    buttons.length) %
                  buttons.length;
          buttons[next]?.focus();
        }
      }}
      className={`annotation-card ${annotation.kind} ${active ? "active" : ""}`}
      data-actions-open={action !== null}
      data-card-id={preview ? undefined : annotation.id}
    >
      <Main
        className="card-main"
        onClick={
          clickable && onOpen
            ? () => {
                setAction(null);
                onOpen(annotation);
              }
            : undefined
        }
        aria-label={
          clickable
            ? `Open ${annotation.kind} on page ${pageLabel(annotation.page, labels)}: ${annotation.body || annotation.quote}`
            : undefined
        }
        aria-pressed={clickable ? active : undefined}
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
      </Main>
      {!preview && onEdit && (
        <button
          className="card-add-note"
          onClick={() =>
            onEdit(
              annotation.kind === "highlight" && annotation.body.trim()
                ? { ...annotation, kind: "note" }
                : annotation,
            )
          }
        >
          {annotation.kind === "highlight" ? (
            <MessageSquare size={13} />
          ) : (
            <Pencil size={13} />
          )}
          {annotation.kind === "highlight" ? "Add note" : "Keep writing"}
          {active && <kbd>/</kbd>}
        </button>
      )}
      {!preview && onEdit && onDelete && (
        <>
          <button
            ref={more}
            className="card-more"
            aria-label="Annotation options"
            aria-expanded={action !== null}
            aria-haspopup="menu"
            onClick={() => setAction((old) => (old ? null : "menu"))}
          >
            <MoreHorizontal size={16} />
          </button>
          {action === "menu" &&
            createPortal(
              <div
                ref={actionPanel}
                className="annotation-action-popover"
                role="menu"
                aria-label="Annotation actions"
                onBlur={(event) => {
                  if (
                    event.relatedTarget &&
                    !event.currentTarget.contains(event.relatedTarget) &&
                    event.relatedTarget !== more.current
                  )
                    setAction(null);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
              >
                <div className="card-actions">
                  <button
                    role="menuitem"
                    onClick={() => {
                      setAction(null);
                      onEdit(annotation);
                    }}
                  >
                    <Pencil size={14} />
                    Edit
                  </button>
                  <button
                    role="menuitem"
                    className="delete-action"
                    onClick={() => setAction("delete")}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>,
              document.body,
            )}
          <div
            className="card-delete-section"
            data-open={action === "delete"}
            aria-hidden={action !== "delete"}
            inert={action !== "delete"}
          >
            <div className="card-delete-clip">
              <div
                ref={deletePanel}
                className="card-delete-confirm"
                role={action === "delete" ? "alertdialog" : undefined}
                aria-label={`Delete ${kindLabel[annotation.kind]}?`}
              >
                <p>Delete this {annotation.kind}?</p>
                <div>
                  <button
                    onClick={() => {
                      setAction(null);
                      more.current?.focus({ preventScroll: true });
                    }}
                  >
                    Keep
                  </button>
                  <button
                    className="delete-action"
                    onClick={() => onDelete(annotation)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
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
  onDraftChange,
  onDraftTypeChange,
  onDraftCancel,
  onDraftSave,
  onOpen,
  onClosePeek,
  onShowMargin,
  onEdit,
  onDelete,
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
  onDraftChange: (draft: Draft) => void;
  onDraftTypeChange: (kind: Kind) => void;
  onDraftCancel: () => void;
  onDraftSave: () => void;
  onOpen: (a: Annotation) => void;
  onClosePeek: () => void;
  onShowMargin: () => void;
  onEdit: (annotation: Annotation) => void;
  onDelete: (annotation: Annotation) => void;
}) {
  const column = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const surfaceLayouts = useRef(
    new Map<string, { height: number; editing: boolean }>(),
  );
  const surfaceAnimations = useRef(new Map<string, Animation>());
  useEffect(() => {
    const animations = surfaceAnimations.current;
    return () => {
      for (const animation of animations.values()) animation.cancel();
    };
  }, []);

  const located = sortedAnnotations(
    annotations
      .filter(
        (a) =>
          a.page === page &&
          a.rects.length &&
          show[a.kind] &&
          a.id !== draft?.id,
      )
      .map((a) => ({ ...a, rects: mergeRects(a.rects) })),
  );
  const allCards =
    focus || mode === "hidden"
      ? located.filter((a) => a.id === peek)
      : mode === "margin"
        ? located
        : [];
  const pageDraft = draft?.page === page && draft.rects.length ? draft : null;
  const cards = sortedAnnotations([
    ...allCards.filter((annotation) => annotation.id !== pageDraft?.id),
    ...(pageDraft
      ? [{ ...pageDraft, id: "draft", createdAt: "", updatedAt: "" }]
      : []),
  ]);
  const ids = cards.map((a) => a.id).join("|");
  useLayoutEffect(() => {
    if (!column.current || !near) return;
    const measured: Record<string, number> = {};
    for (const wrapper of column.current.querySelectorAll<HTMLElement>(
      ".anchored-card",
    )) {
      const key = wrapper.dataset.surfaceId!;
      const editing = wrapper.dataset.editing === "true";
      const surface = wrapper.querySelector<HTMLElement>(
        ":scope > [data-card-id]",
      );
      if (!surface) continue;
      const previous = surfaceLayouts.current.get(key);
      surfaceAnimations.current.get(key)?.cancel();
      surfaceAnimations.current.delete(key);
      const target = surface.getBoundingClientRect().height;
      const morph =
        previous &&
        previous.editing !== editing &&
        Math.abs(previous.height - target) > 1 &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches;
      measured[surface.dataset.cardId!] = morph ? previous.height : target;
      surfaceLayouts.current.set(key, { height: target, editing });
      if (morph) {
        const animation = surface.animate(
          [{ height: `${previous.height}px` }, { height: `${target}px` }],
          {
            duration: 180,
            easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          },
        );
        surfaceAnimations.current.set(key, animation);
        void animation.finished
          .then(() => {
            if (surfaceAnimations.current.get(key) === animation) {
              surfaceAnimations.current.delete(key);
              surfaceLayouts.current.set(key, { height: target, editing });
            }
          })
          .catch(() => {});
      }
    }
    setHeights((old) =>
      Object.entries(measured).some(
        ([id, height]) => Math.abs((old[id] ?? 0) - height) > 0.5,
      )
        ? { ...old, ...measured }
        : old,
    );
  }, [ids, near, pageDraft?.id]);
  useLayoutEffect(() => {
    if (!column.current || !near) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const wrapper = (entry.target as HTMLElement).parentElement;
        const key = wrapper?.dataset.surfaceId;
        if (key)
          surfaceLayouts.current.set(key, {
            height:
              entry.borderBoxSize[0]?.blockSize ??
              entry.target.getBoundingClientRect().height,
            editing: wrapper.dataset.editing === "true",
          });
      }
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
    const source = (passageTop + passageBottom) / 2;
    const previous = placements.at(-1);
    const top = Math.max(0, source - 22, previous ? previous.bottom + 10 : 0);
    placements.push({
      annotation: a,
      top,
      source,
      bottom: top + (heights[a.id] ?? 120),
    });
  }
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
            </div>
          );
        })}
        {draft?.page === page &&
          draft.rects.map((r, i) => (
            <span
              className={`draft-passage ${draft.kind}`}
              key={i}
              style={{
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.width * 100}%`,
                height: `${r.height * 100}%`,
              }}
            />
          ))}
        {pageDraft && pageDraft.rects.length > 0 && (
          <span
            className={`range-tick ${pageDraft.kind}`}
            aria-hidden="true"
            style={{
              top: `${Math.min(...pageDraft.rects.map((r) => r.y)) * 100}%`,
              height: `${(Math.max(...pageDraft.rects.map((r) => r.y + r.height)) - Math.min(...pageDraft.rects.map((r) => r.y))) * 100}%`,
            }}
          />
        )}
      </div>
      {placements.length > 0 && (
        <div
          className={`margin-column ${pageDraft ? "has-editor" : ""}`}
          ref={column}
        >
          {placements.map(({ annotation, top, source }) => {
            const target = top + 22;
            const connectorTop = Math.min(source, target) - 2;
            const from = source - connectorTop;
            const to = target - connectorTop;
            return (
              <div
                key={
                  annotation.id === "draft"
                    ? (pageDraft?.id ?? "draft")
                    : annotation.id
                }
                className={`anchored-card ${annotation.id === "draft" ? "draft-card" : ""}`}
                data-surface-id={
                  annotation.id === "draft"
                    ? (pageDraft?.id ?? "draft")
                    : annotation.id
                }
                data-editing={annotation.id === "draft"}
                style={{ top } as CSSProperties}
              >
                <svg
                  className={`connector ${annotation.kind}`}
                  width="40"
                  height={Math.abs(target - source) + 4}
                  style={{ top: connectorTop - top }}
                  aria-hidden="true"
                >
                  <path
                    d={
                      Math.abs(source - target) < 0.5
                        ? `M 2 ${from} L 40 ${from}`
                        : `M 2 ${from} C 22.9 ${from} 19.1 ${to} 40 ${to}`
                    }
                    pathLength="1"
                  />
                </svg>
                {annotation.id === "draft" && pageDraft ? (
                  <Composer
                    draft={pageDraft}
                    onChange={onDraftChange}
                    onTypeChange={onDraftTypeChange}
                    onCancel={onDraftCancel}
                    onSave={onDraftSave}
                  />
                ) : (
                  <AnnotationCard
                    annotation={annotation}
                    active={active === annotation.id}
                    labels={labels}
                    onOpen={onOpen}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                )}
                {annotation.id !== "draft" && (focus || mode === "hidden") && (
                  <div className="peek-actions">
                    <button onClick={onShowMargin}>Show all in margin</button>
                    <button aria-label="Close annotation" onClick={onClosePeek}>
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
