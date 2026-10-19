"use client";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowDownToLine,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Highlighter,
  MessageCircle,
  Minus,
  Plus,
  Settings2,
  StickyNote,
  X,
  Sun,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Trash2,
  ArrowUpRight,
  BookOpen,
} from "lucide-react";
import PdfView from "./pdf-view";
import {
  type Annotation,
  type Draft,
  type Kind,
  type SavedState,
  UNDERSTANDINGS,
  storageKey,
  readState,
  isDraftDirty,
  toMarkdown,
} from "@/lib/annotations";
import { type Section, type Study } from "@/lib/study";
import { captureSelection } from "@/lib/selection";

const kindIcon = {
  highlight: Highlighter,
  note: StickyNote,
  question: MessageCircle,
};
type Selection = NonNullable<ReturnType<typeof captureSelection>>;
export default function Reader({
  study,
  focused = false,
}: {
  study: Study;
  focused?: boolean;
}) {
  const [initial] = useState(() => readState(study.id, study.pageCount));
  const [saved, setSaved] = useState<SavedState>(initial.state);
  const [storageError, setStorageError] = useState(initial.error);
  const [storageBlocked, setStorageBlocked] = useState(!!initial.error);
  const [pages, setPages] = useState(study.pageCount);
  const [sections, setSections] = useState<Section[]>(
    study.sections.length ? study.sections : [{ title: "Document", page: 1 }],
  );
  const [embedded, setEmbedded] = useState(false);
  const [outline, setOutline] = useState(false);
  const [notes, setNotes] = useState(true);
  const [settings, setSettings] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [zoom, setZoom] = useState(1);
  const [available, setAvailable] = useState(900);
  const [pageInput, setPageInput] = useState(String(saved.page));
  const [documentReady, setDocumentReady] = useState(false);
  const restoredPosition = useRef(false);
  const [toast, setToast] = useState("");
  const [deleted, setDeleted] = useState<Annotation | null>(null);
  const [scrollFraction, setScrollFraction] = useState(0);
  const viewport = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const readingPosition = useRef({ page: initial.state.page, fraction: 0 });
  const textarea = useRef<HTMLTextAreaElement>(null);
  const { annotations, draft, page, appearance } = saved;
  const dirtyDraft = isDraftDirty(draft, annotations);
  const width = Math.round(
    Math.max(360, Math.min(focused ? 860 : 800, available - 100)) * zoom,
  );
  // Resizing or zooming changes every reserved page height. Restore the
  // current page's relative offset before paint instead of drifting pages.
  useLayoutEffect(() => {
    const root = viewport.current;
    const position = readingPosition.current;
    const target = root?.querySelector<HTMLElement>(
      `[data-page="${position.page}"]`,
    );
    if (!root || !target) return;
    const bounds = target.getBoundingClientRect();
    const correction =
      bounds.top -
      root.getBoundingClientRect().top +
      position.fraction * bounds.height;
    if (Math.abs(correction) > 0.5) {
      root.scrollTop += correction;
    }
  }, [width]);
  const activeSection =
    [...sections].reverse().find((s) => s.page <= page) ?? sections[0];
  const sorted = [...annotations].sort(
    (a, b) => a.page - b.page || a.rects[0].y - b.rects[0].y,
  );
  const filtered = sorted.filter(
    (a) =>
      filter === "all" ||
      (filter === "questions"
        ? a.kind === "question"
        : a.understanding === "unclear"),
  );
  const position = Math.round(((page - 1 + scrollFraction) / pages) * 100);

  useEffect(() => {
    if (storageBlocked) return;
    try {
      localStorage.setItem(storageKey(study.id), JSON.stringify(saved));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable. Keep this tab open and export your annotations.",
      );
    }
  }, [saved, storageBlocked, study.id]);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(([e]) =>
      setAvailable(e.contentRect.width),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    setPageInput(String(page));
    map.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", behavior: "instant" });
    setSelection(null);
  }, [page]);
  const draftPassage = draft
    ? `${draft.id ?? "new"}:${draft.page}:${draft.quote}`
    : "";
  useEffect(() => {
    if (draftPassage) textarea.current?.focus();
  }, [draftPassage]); // Focus only when opening a different passage.
  useEffect(() => {
    const listener = (e: BeforeUnloadEvent) => {
      if (!focused && dirtyDraft) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", listener);
    return () => window.removeEventListener("beforeunload", listener);
  }, [dirtyDraft, focused]);
  const go = useCallback(
    (n: number) => {
      if (!Number.isFinite(n)) return;
      const target = Math.min(pages, Math.max(1, Math.round(n)));
      readingPosition.current = { page: target, fraction: 0 };
      setSaved((s) => ({ ...s, page: target }));
      const root = viewport.current;
      root
        ?.querySelector(`[data-page="${target}"]`)
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    },
    [pages],
  );
  useEffect(() => {
    const listener = (e: Event) => go((e as CustomEvent<number>).detail);
    window.addEventListener("margin:page", listener);
    return () => window.removeEventListener("margin:page", listener);
  }, [go]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection(null);
        setSettings(false);
      }
      const target = e.target as HTMLElement;
      if (target.closest("input,textarea,select,[contenteditable]")) return;
      if (
        e.shiftKey ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        window.getSelection()?.toString()
      )
        return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(page + 1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(page - 1);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [go, page]);
  useEffect(() => {
    if (!active || !documentReady) return;
    const marker = viewport.current?.querySelector(
      `[data-annotation="${active}"]`,
    );
    marker?.scrollIntoView({ block: "center", behavior: "instant" });
  }, [active, documentReady, width]);
  function announce(message: string) {
    setToast(message);
  }
  function openAnnotation(a: Annotation) {
    if (draft && draft.id !== a.id && dirtyDraft) {
      announce(
        "Save or discard your current draft before opening another annotation.",
      );
      return;
    }
    setActive(a.id);
    setNotes(true);
    go(a.page);
    if (draft?.id !== a.id) setSaved((s) => ({ ...s, draft: { ...a } }));
  }
  function start(kind: Kind) {
    if (focused || !selection) return;
    if (kind === "highlight") {
      save({
        page: selection.page,
        quote: selection.quote,
        rects: selection.rects,
        kind,
        body: "",
        understanding: "unmarked",
        resolved: false,
      });
      return;
    }
    if (dirtyDraft) {
      announce("Save or discard your current draft first.");
      return;
    }
    setSaved((s) => ({
      ...s,
      draft: {
        page: selection.page,
        quote: selection.quote,
        rects: selection.rects,
        kind,
        body: "",
        understanding: "unmarked",
        resolved: false,
      },
    }));
    setNotes(true);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }
  function save(value: Draft) {
    if (value.kind !== "highlight" && !value.body.trim()) return;
    const now = new Date().toISOString();
    const existing = annotations.find((a) => a.id === value.id);
    const annotation: Annotation = {
      ...value,
      id: value.id ?? crypto.randomUUID(),
      body: value.body.trim(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    setSaved((s) => ({
      ...s,
      annotations: [
        ...s.annotations.filter((a) => a.id !== annotation.id),
        annotation,
      ],
      draft: (value.id ? s.draft?.id === value.id : s.draft === value)
        ? null
        : s.draft,
    }));
    setActive(annotation.id);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    announce(existing ? "Annotation updated" : "Annotation added");
  }
  function updateDraft(update: Partial<Draft>) {
    setSaved((s) => ({
      ...s,
      draft: s.draft ? { ...s.draft, ...update } : null,
    }));
  }
  function remove(a: Annotation) {
    setDeleted(a);
    setSaved((s) => ({
      ...s,
      annotations: s.annotations.filter((x) => x.id !== a.id),
      draft: s.draft?.id === a.id ? null : s.draft,
    }));
    setActive(null);
    announce("Annotation deleted");
  }
  function exportNotes() {
    const blob = new Blob([toMarkdown(annotations, study)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${study.fileName.replace(/\.pdf$/i, "")}-notes.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    announce("Markdown exported");
  }
  const load = useCallback(
    (count: number, outline: Section[], hasOutline: boolean) => {
      setPages(count);
      setSections(outline);
      setEmbedded(hasOutline);
    },
    [],
  );
  const onReady = useCallback(() => setDocumentReady(true), []);
  useEffect(() => {
    if (documentReady && !restoredPosition.current) {
      restoredPosition.current = true;
      go(initial.state.page);
    }
  }, [documentReady, go, initial.state.page]);
  function scroll() {
    setSelection(null);
    const el = viewport.current;
    if (!el) return;
    setHasScrolled(el.scrollTop > 16);
    const top = el.getBoundingClientRect().top;
    const probe = top + el.clientHeight / 2;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>("[data-page]"));
    const current =
      nodes.find((node) => node.getBoundingClientRect().bottom > probe) ??
      nodes.at(-1);
    if (!current) return;
    const currentPage = Number(current.dataset.page);
    const bounds = current.getBoundingClientRect();
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 3;
    const fraction = atEnd
      ? 1
      : Math.max(0, Math.min(1, (top - bounds.top) / bounds.height));
    readingPosition.current = { page: currentPage, fraction };
    setScrollFraction(fraction);
    setSaved((s) => (s.page === currentPage ? s : { ...s, page: currentPage }));
  }
  return (
    <div className={`reader ${focused ? "light focused-view" : appearance}`}>
      <header className="topbar">
        <div className="brand" aria-label="Margin">
          Margin
        </div>
        {!focused && (
          <div className="header-actions">
            <button
              className="icon-button"
              title="View settings"
              aria-label="View settings"
              aria-expanded={settings}
              onClick={() => setSettings(!settings)}
            >
              <Settings2 size={17} />
            </button>
            <button
              className={`secondary ${notes ? "selected" : ""}`}
              onClick={() => setNotes(!notes)}
              aria-expanded={notes}
            >
              {notes ? (
                <PanelRightClose size={15} />
              ) : (
                <PanelRightOpen size={15} />
              )}
              Notes <span className="count">{annotations.length}</span>
            </button>
            <button
              className="primary"
              onClick={exportNotes}
              disabled={!annotations.length}
            >
              <ArrowDownToLine size={14} />
              Export
            </button>
          </div>
        )}
      </header>
      {storageError && (
        <div className="storage-error" role="alert">
          {storageError}
          <button
            onClick={() => {
              if (storageBlocked) {
                const result = readState(study.id, study.pageCount);
                if (!result.error) {
                  setSaved(result.state);
                  setStorageBlocked(false);
                  setStorageError("");
                }
              } else setSaved((s) => ({ ...s }));
            }}
          >
            Retry storage
          </button>
        </div>
      )}
      <div className="workspace">
        {!focused && (
          <aside
            className={`outline ${outline ? "expanded" : ""}`}
            aria-label="Paper outline and annotation activity"
          >
            <div className="outline-head">
              {outline && <strong>Outline</strong>}
              <button
                className="icon-button"
                aria-label={outline ? "Collapse outline" : "Expand outline"}
                title={outline ? "Collapse outline" : "Expand outline"}
                onClick={() => setOutline(!outline)}
              >
                {outline ? (
                  <ChevronsLeft size={17} />
                ) : (
                  <ChevronsRight size={17} />
                )}
              </button>
            </div>
            {outline ? (
              <>
                <div className="eyebrow outline-source">
                  {embedded
                    ? "From PDF outline"
                    : study.sections.length
                      ? "Prepared for this paper"
                      : "Page navigation"}
                </div>
                <nav className="section-list">
                  {sections.map((s) => {
                    const count = annotations.filter(
                      (a) =>
                        a.page >= s.page &&
                        a.page <
                          (sections[sections.indexOf(s) + 1]?.page ??
                            pages + 1),
                    ).length;
                    return (
                      <button
                        key={`${s.page}-${s.title}`}
                        onClick={() => go(s.page)}
                        className={activeSection === s ? "current" : ""}
                      >
                        <span className="section-dot" />
                        <span>{s.title}</span>
                        {count > 0 && (
                          <span className="activity-count">{count}</span>
                        )}
                        <small>{s.page}</small>
                      </button>
                    );
                  })}
                </nav>
                <div className="outline-foot">
                  <BookOpen size={13} />
                  <span>{pages} pages</span>
                </div>
              </>
            ) : (
              <div
                ref={map}
                className={`page-map ${pages > 60 ? "long-document" : ""}`}
              >
                {Array.from({ length: pages }, (_, i) => {
                  const activity = annotations.filter((a) => a.page === i + 1);
                  return (
                    <button
                      key={i}
                      title={`Page ${i + 1}${activity.length ? ` · ${activity.length} annotations` : ""}`}
                      aria-label={`Go to page ${i + 1}${activity.length ? `, ${activity.length} annotations` : ""}`}
                      aria-current={page === i + 1 ? "page" : undefined}
                      className={page === i + 1 ? "current" : ""}
                      onClick={() => go(i + 1)}
                    >
                      <span className="map-segment" />
                      {activity.slice(0, 3).map((a) => (
                        <i key={a.id} className={a.kind} />
                      ))}
                    </button>
                  );
                })}
              </div>
            )}
          </aside>
        )}
        <main className="reading-area" aria-label="Study reader">
          <header
            className={`study-heading ${hasScrolled ? "scrolled" : ""}`}
          >
            <h1>{study.title}</h1>
            {focused ? (
              <form
                className="viewing-page-navigation"
                onSubmit={(e) => {
                  e.preventDefault();
                  go(Number(pageInput));
                }}
              >
                <label htmlFor="viewing-page">
                  Page{" "}
                  <input
                    id="viewing-page"
                    aria-label="Page number"
                    inputMode="numeric"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={() => {
                      if (pageInput.trim() && Number(pageInput) !== page)
                        go(Number(pageInput));
                      else setPageInput(String(page));
                    }}
                  />
                </label>
                <span>of {pages}</span>
              </form>
            ) : (
              <p>
                Page {page} of {pages}
                <span> · </span>
                {activeSection.title}
              </p>
            )}
          </header>
          <div
            className="paper-viewport"
            ref={viewport}
            tabIndex={focused ? 0 : undefined}
            aria-label={focused ? "Continuous PDF document" : undefined}
            onScroll={scroll}
            onMouseDown={() => setSettings(false)}
          >
            <PdfView
              study={study}
              annotationsEnabled={!focused}
              scrollRoot={viewport}
              width={width}
              annotations={annotations}
              active={active}
              onOpen={openAnnotation}
              onSelection={setSelection}
              onLoad={load}
              onReady={onReady}
            />
            {!focused && (
              <div className="page-end">
                <button disabled={page === pages} onClick={() => go(page + 1)}>
                  {page === pages ? "End of paper" : "Next page"}
                  {page < pages && <ChevronRight size={14} />}
                </button>
              </div>
            )}
          </div>
          {!focused && (
            <footer className="reader-controls">
              <div className="page-control">
                <button
                  className="icon-button"
                  aria-label="Previous page"
                  disabled={page === 1}
                  onClick={() => go(page - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    go(Number(pageInput));
                  }}
                >
                  <label className="sr-only" htmlFor="page-number">
                    Page number
                  </label>
                  <input
                    id="page-number"
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    onBlur={() => {
                      if (pageInput.trim()) go(Number(pageInput));
                      else setPageInput(String(page));
                    }}
                    inputMode="numeric"
                  />
                  <span>/ {pages}</span>
                </form>
                <button
                  className="icon-button"
                  aria-label="Next page"
                  disabled={page === pages}
                  onClick={() => go(page + 1)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <span
                className="reading-position"
                title="Position in the paper, separate from understanding"
              >
                {position}% <span>through paper</span>
              </span>
              <div className="zoom-control">
                <button
                  className="icon-button"
                  aria-label="Zoom out"
                  disabled={zoom <= 0.7}
                  onClick={() => {
                    setZoom((z) => Math.max(0.7, +(z - 0.1).toFixed(1)));
                    setSelection(null);
                  }}
                >
                  <Minus size={14} />
                </button>
                <button
                  className="zoom-value"
                  title="Fit width"
                  onClick={() => {
                    setZoom(1);
                    setSelection(null);
                  }}
                >
                  {zoom === 1 ? "Fit width" : `${Math.round(zoom * 100)}%`}
                </button>
                <button
                  className="icon-button"
                  aria-label="Zoom in"
                  disabled={zoom >= 1.6}
                  onClick={() => {
                    setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(1)));
                    setSelection(null);
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>
            </footer>
          )}
        </main>
        {!focused && notes && (
          <aside className="notes-panel" aria-label="Annotations">
            <div className={`notes-browser ${draft ? "with-composer" : ""}`}>
              <div className="notes-heading">
                <div>
                  <strong>Your margins</strong>
                  <span>
                    {annotations.length}{" "}
                    {annotations.length === 1 ? "annotation" : "annotations"}
                  </span>
                </div>
                <button
                  className="icon-button"
                  aria-label="Hide notes"
                  onClick={() => setNotes(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div
                className="filters"
                role="group"
                aria-label="Filter annotations"
              >
                {[
                  ["all", "All"],
                  ["questions", "Questions"],
                  ["unclear", "Unclear"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                    className={filter === key ? "current" : ""}
                  >
                    {label}
                    {key === "questions" && (
                      <span>
                        {
                          annotations.filter((a) => a.kind === "question")
                            .length
                        }
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="annotation-list">
                {!filtered.length && (
                  <div className="empty-notes">
                    <span className="empty-illustration">
                      <StickyNote size={24} strokeWidth={1.2} />
                      <i />
                    </span>
                    <h2>
                      {annotations.length
                        ? "Nothing here yet"
                        : "Make room for a thought."}
                    </h2>
                    <p>
                      {annotations.length
                        ? "Your annotations will appear here when they match this filter."
                        : "Select a passage in the paper to highlight it, leave a note, or keep a question."}
                    </p>
                    <span className="local-hint">
                      Your notes stay in this browser.
                    </span>
                  </div>
                )}
                {filtered.map((a) => {
                  const Icon = kindIcon[a.kind];
                  return (
                    <article
                      key={a.id}
                      className={`annotation-card ${active === a.id ? "active" : ""}`}
                    >
                      <button
                        className="annotation-open"
                        onClick={() => openAnnotation(a)}
                      >
                        <div className="card-top">
                          <span className={`kind-label ${a.kind}`}>
                            <Icon size={11} />
                            {a.kind}
                          </span>
                          <span>
                            p. {a.page}
                            <ArrowUpRight size={12} />
                          </span>
                        </div>
                        <blockquote>{a.quote}</blockquote>
                        {a.body && <p className="annotation-body">{a.body}</p>}
                        <div className="card-foot">
                          <span
                            className={`understanding ${a.understanding.replace(" ", "-")}`}
                          >
                            <i />
                            {a.understanding === "unmarked"
                              ? "Understanding unmarked"
                              : a.understanding}
                          </span>
                          {a.kind === "question" && (
                            <span>{a.resolved ? "Resolved" : "Open"}</span>
                          )}
                        </div>
                      </button>
                      <button
                        className="delete-annotation icon-button"
                        aria-label={`Delete ${a.kind}`}
                        onClick={() => remove(a)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
            {draft && (
              <form
                className={`composer ${draft.kind}`}
                aria-label="Annotation composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  save(draft);
                }}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    save(draft);
                  }
                }}
              >
                <div className="composer-top">
                  <span>
                    {draft.id ? "Edit annotation" : "New annotation"}{" "}
                    <small>· p. {draft.page}</small>
                  </span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label="Discard draft"
                    title="Discard draft"
                    onClick={() => {
                      setSaved((s) => ({ ...s, draft: null }));
                      setActive(null);
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <blockquote>{draft.quote}</blockquote>
                <textarea
                  ref={textarea}
                  aria-label={
                    draft.kind === "question" ? "Your question" : "Your note"
                  }
                  placeholder={
                    draft.kind === "question"
                      ? "What are you wondering?"
                      : "A thought in your own words…"
                  }
                  value={draft.body}
                  onChange={(e) => updateDraft({ body: e.target.value })}
                />
                <label className="understanding-label">
                  Understanding
                  <select
                    aria-label="Understanding"
                    value={draft.understanding}
                    onChange={(e) =>
                      updateDraft({
                        understanding: e.target.value as Draft["understanding"],
                      })
                    }
                  >
                    {UNDERSTANDINGS.map((u) => (
                      <option value={u} key={u}>
                        {u[0].toUpperCase() + u.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                {draft.kind === "question" && (
                  <label className="resolved-check">
                    <input
                      type="checkbox"
                      checked={draft.resolved}
                      onChange={(e) =>
                        updateDraft({ resolved: e.target.checked })
                      }
                    />
                    Question resolved
                  </label>
                )}
                <div className="composer-actions">
                  <div
                    className="kind-switch"
                    role="group"
                    aria-label="Annotation kind"
                  >
                    {(["highlight", "note", "question"] as Kind[]).map((k) => {
                      const Icon = kindIcon[k];
                      return (
                        <button
                          type="button"
                          key={k}
                          title={k}
                          aria-label={`Change to ${k}`}
                          aria-pressed={draft.kind === k}
                          onClick={() => updateDraft({ kind: k })}
                        >
                          <Icon size={14} />
                        </button>
                      );
                    })}
                  </div>
                  <span className="shortcut">⌘↵</span>
                  <button
                    type="submit"
                    className="primary"
                    disabled={draft.kind !== "highlight" && !draft.body.trim()}
                  >
                    <Check size={13} />
                    {draft.id ? "Update" : "Save"}
                  </button>
                </div>
              </form>
            )}
            {!draft && annotations.length > 0 && (
              <div className="notes-foot">
                Select a passage to add to your margins.
              </div>
            )}
          </aside>
        )}
      </div>
      {!focused && !notes && draft && (
        <button
          className="resume-draft secondary"
          onClick={() => setNotes(true)}
        >
          <StickyNote size={14} />
          Resume draft
        </button>
      )}
      {!focused && selection && (
        <div
          className="selection-toolbar"
          role="toolbar"
          aria-label="Annotate selection"
          style={{ left: selection.left, top: selection.top }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {(["highlight", "note", "question"] as Kind[]).map((k) => {
            const Icon = kindIcon[k];
            return (
              <button key={k} onClick={() => start(k)}>
                <Icon size={14} />
                {k[0].toUpperCase() + k.slice(1)}
              </button>
            );
          })}
        </div>
      )}
      {!focused && settings && (
        <div
          className="settings-popover"
          role="dialog"
          aria-label="View settings"
        >
          <div className="popover-title">
            <strong>Reading space</strong>
            <button
              className="icon-button"
              onClick={() => setSettings(false)}
              aria-label="Close settings"
            >
              <X size={14} />
            </button>
          </div>
          <span className="eyebrow">Appearance</span>
          <div className="appearance-options">
            {(["light", "dark"] as const).map((a) => (
              <button
                key={a}
                aria-pressed={appearance === a}
                className={appearance === a ? "current" : ""}
                onClick={() => setSaved((s) => ({ ...s, appearance: a }))}
              >
                {a === "light" ? <Sun size={16} /> : <Moon size={16} />}
                <span>{a === "light" ? "Light" : "Warm dark"}</span>
              </button>
            ))}
          </div>
          <label className="setting-toggle">
            <span>Show notes</span>
            <input
              type="checkbox"
              checked={notes}
              onChange={(e) => setNotes(e.target.checked)}
            />
          </label>
          <label className="setting-toggle">
            <span>Expanded outline</span>
            <input
              type="checkbox"
              checked={outline}
              onChange={(e) => setOutline(e.target.checked)}
            />
          </label>
          <p>The original paper stays white.</p>
        </div>
      )}
      {!focused && toast && (
        <div className="toast" role="status">
          <span>{toast}</span>
          {toast === "Annotation deleted" && deleted && (
            <button
              onClick={() => {
                setSaved((s) => ({
                  ...s,
                  annotations: [...s.annotations, deleted],
                }));
                setDeleted(null);
                announce("Annotation restored");
              }}
            >
              <RotateCcw size={13} />
              Undo
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
