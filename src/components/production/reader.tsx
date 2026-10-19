"use client";
import type { Study } from "@/lib/study";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronLeft, Download, Focus, SlidersHorizontal } from "lucide-react";
import PdfView from "../pdf-view";
import {
  UNDERSTANDINGS,
  type Annotation,
  type Draft,
  type Kind,
  type Rect,
  type Understanding,
} from "@/lib/annotations";
import { exportAnnotations } from "@/lib/reader-export";
import {
  fallbackSections,
  normalizeOutline,
  paper as neptunePaper,
  readReaderState,
  readerKey,
  sortedAnnotations,
  type AnnotationMode,
  type OutlineSection,
} from "@/lib/reader-model";
import { AnnotationPageLayer, EmptyAnnotations } from "./annotation-layers";
import { AnnotationList } from "./annotation-list";
import { Composer, SelectionToolbar, type TextSelection } from "./annotating";
import { Navigation } from "./navigation";
import { copyExport, ExportMenu, ViewMenu } from "./menus";
import { Presence, Segmented, Shortcuts, Toast } from "./ui";
export default function Reader({ study: paper }: { study: Study }) {
  const neptune = paper.id === neptunePaper.id;
  const storageKey = readerKey(paper);
  const [initial] = useState(() => readReaderState(localStorage, paper));
  const [saved, setSaved] = useState(initial.state);
  const [storageError, setStorageError] = useState(initial.error);
  const [sections, setSections] = useState<OutlineSection[]>(
    neptune ? fallbackSections : paper.sections,
  );
  const [labels, setLabels] = useState<string[] | null>(
    neptune
      ? null
      : Array.from({ length: paper.pageCount }, (_, i) => String(i + 1)),
  );
  const [focus, setFocus] = useState(false);
  const [peek, setPeek] = useState<string | null>(null);
  const [menu, setMenu] = useState<"view" | "export" | null>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const [selection, setSelection] = useState<TextSelection | null>(null);
  const [toast, setToast] = useState("");
  const [pageFilter, setPageFilter] = useState<number | null>(null);
  const [screenWidth, setScreenWidth] = useState(() => innerWidth);
  const [visiblePages, setVisiblePages] = useState([saved.position.page]);
  const [ready, setReady] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const scrollFrame = useRef<number | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(saved);
  const focusButton = useRef<HTMLButtonElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const lastWidth = useRef(0);
  const width = Math.round(
    screenWidth < 1100
      ? Math.min(600, screenWidth - 48)
      : Math.max(520, Math.min(760, (screenWidth * 5) / 12)),
  );
  const mode: AnnotationMode =
    screenWidth < 1100 && saved.mode === "margin" ? "hidden" : saved.mode;
  useLayoutEffect(() => {
    savedRef.current = saved;
  }, [saved]);
  const announce = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);
  useEffect(() => {
    const resize = () => setScreenWidth(innerWidth);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (scrollFrame.current !== null)
        cancelAnimationFrame(scrollFrame.current);
    };
  }, []);
  useEffect(() => {
    if (initial.error) return;
    const write = () => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(savedRef.current));
      } catch {
        setStorageError(
          "Browser storage is unavailable. Keep this tab open and export your annotations.",
        );
      }
    };
    window.addEventListener("pagehide", write);
    return () => {
      write();
      window.removeEventListener("pagehide", write);
    };
  }, [initial.error, storageKey]);
  useEffect(() => {
    if (initial.error) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(saved));
      } catch {
        setStorageError(
          "Browser storage is unavailable. Keep this tab open and export your annotations.",
        );
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [saved, initial.error, storageKey]);
  const jump = useCallback(
    (page: number, fraction = 0, smooth = true) => {
      const root = viewport.current;
      if (!root) return;
      const target = Math.max(1, Math.min(paper.pageCount, page));
      const el = root.querySelector<HTMLElement>(`[data-page="${target}"]`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      root.scrollTo({
        top:
          root.scrollTop +
          rect.top -
          root.getBoundingClientRect().top -
          84 +
          fraction * rect.height,
        behavior:
          smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "smooth"
            : "instant",
      });
      setSelection(null);
    },
    [paper.pageCount],
  );
  useLayoutEffect(() => {
    if (!ready) return;
    if (!restored.current || lastWidth.current !== width) {
      const position = restored.current
        ? savedRef.current.position
        : initial.state.position;
      jump(position.page, position.fraction, false);
      restored.current = true;
      lastWidth.current = width;
    }
  }, [ready, width, jump, initial.state.position]);
  const onReady = useCallback(() => setReady(true), []);
  const onLoad = useCallback(() => {}, []);
  const onMetadata = useCallback(
    (nextLabels: string[] | null, outline: OutlineSection[]) => {
      setLabels(
        nextLabels ??
          (neptune
            ? null
            : Array.from({ length: paper.pageCount }, (_, i) => String(i + 1))),
      );
      setSections(
        neptune
          ? normalizeOutline(outline)
          : outline.length
            ? outline
            : paper.sections,
      );
    },
    [neptune, paper],
  );
  const onLocated = useCallback(
    (locations: { id: string; page: number; rects: Rect[] }[]) => {
      setSaved((old) => ({
        ...old,
        annotations: old.annotations.map((a) => {
          const found = locations.find((l) => l.id === a.id);
          return found ? { ...a, page: found.page, rects: found.rects } : a;
        }),
      }));
    },
    [],
  );
  function scroll() {
    setSelection(null);
    if (scrollFrame.current !== null) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      const root = viewport.current;
      if (!root || !restored.current) return;
      const top = root.getBoundingClientRect().top + 84;
      const bottom = root.getBoundingClientRect().bottom;
      const pages = Array.from(
        root.querySelectorAll<HTMLElement>("[data-page]"),
      ).map((el) => ({
        page: Number(el.dataset.page),
        rect: el.getBoundingClientRect(),
      }));
      const visible = pages
        .filter((p) => p.rect.bottom > top && p.rect.top < bottom)
        .map((p) => p.page);
      setVisiblePages((previous) =>
        previous.join(",") === visible.join(",") ? previous : visible,
      );
      const anchor = pages.find((p) => p.rect.bottom > top) ?? pages.at(-1);
      if (!anchor) return;
      const fraction =
        root.scrollTop + root.clientHeight >= root.scrollHeight - 3
          ? 1
          : Math.max(
              0,
              Math.min(1, (top - anchor.rect.top) / anchor.rect.height),
            );
      setSaved((old) =>
        old.position.page === anchor.page &&
        Math.abs(old.position.fraction - fraction) < 0.0001
          ? old
          : { ...old, position: { page: anchor.page, fraction } },
      );
    });
  }
  const openAnnotation = useCallback(
    (annotation: Annotation) => {
      setSaved((old) => ({ ...old, active: annotation.id }));
      if (focus || mode === "hidden") setPeek(annotation.id);
      const root = viewport.current;
      const node = root?.querySelector<HTMLElement>(
        `[data-page="${annotation.page}"]`,
      );
      if (!root || !node) return;
      const rect = node.getBoundingClientRect();
      const passageTop = rect.top + (annotation.rects[0]?.y ?? 0) * rect.height;
      const passageBottom =
        rect.top +
        Math.max(...annotation.rects.map((r) => r.y + r.height), 0.1) *
          rect.height;
      if (passageTop < 160 || passageBottom > root.clientHeight - 100)
        jump(
          annotation.page,
          Math.max(0, (annotation.rects[0]?.y ?? 0) - 0.18),
        );
    },
    [focus, mode, jump],
  );
  function clearSelection() {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }
  function begin(kind: Kind, understanding: Understanding = "unmarked") {
    if (!selection) return;
    const { page, quote, rects } = selection;
    if (kind === "highlight") {
      const now = new Date().toISOString();
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        page,
        quote,
        rects,
        kind,
        understanding,
        body: "",
        resolved: false,
        createdAt: now,
        updatedAt: now,
      };
      setSaved((old) => ({
        ...old,
        annotations: [...old.annotations, annotation],
        active: annotation.id,
      }));
      if (focus || mode === "hidden") setPeek(annotation.id);
      clearSelection();
      announce("Highlight saved");
    } else {
      setSaved((old) => ({
        ...old,
        draft: {
          page,
          quote,
          rects,
          kind,
          understanding,
          body: "",
          resolved: false,
        },
      }));
      clearSelection();
    }
  }
  function cancelDraft() {
    setSaved((old) => ({ ...old, draft: null }));
    clearSelection();
    viewport.current?.focus({ preventScroll: true });
  }
  function saveDraft() {
    const draft = saved.draft;
    if (!draft) return;
    if (draft.kind !== "highlight" && !draft.body.trim()) {
      announce(
        draft.kind === "question"
          ? "Write your question before saving."
          : "Write a note before saving.",
      );
      return;
    }
    const now = new Date().toISOString();
    const a: Annotation = {
      ...draft,
      body: draft.body.trim(),
      id: draft.id ?? crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    setSaved((old) => ({
      ...old,
      annotations: [...old.annotations.filter((n) => n.id !== a.id), a],
      draft: null,
      active: a.id,
    }));
    if (focus || mode === "hidden") setPeek(a.id);
    announce(
      `${a.kind === "question" ? "Question" : a.kind === "note" ? "Note" : "Highlight"} saved`,
    );
    viewport.current?.focus({ preventScroll: true });
  }
  function toggleFocus() {
    setMenu(null);
    setSelection(null);
    setPeek(null);
    setFocus((old) => !old);
  }
  useEffect(() => {
    if (focus) exitButton.current?.focus({ preventScroll: true });
  }, [focus]);
  useEffect(() => {
    const selected = () => {
      if (window.getSelection()?.isCollapsed) setSelection(null);
    };
    document.addEventListener("selectionchange", selected);
    return () => document.removeEventListener("selectionchange", selected);
  }, []);
  useEffect(() => {
    const event = (e: CustomEvent<number>) => jump(e.detail);
    const listener = (e: Event) => event(e as CustomEvent<number>);
    window.addEventListener("margin:page", listener);
    return () => window.removeEventListener("margin:page", listener);
  }, [jump]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.defaultPrevented || document.querySelector("dialog[open]")) return;
      const typing = (e.target as HTMLElement).closest(
        'input,textarea,select,[contenteditable="true"]',
      );
      if (e.key === "Escape") {
        if (menu) setMenu(null);
        else if (saved.draft) cancelDraft();
        else if (selection) clearSelection();
        else if (peek) setPeek(null);
        else if (focus) {
          setFocus(false);
          requestAnimationFrame(() => focusButton.current?.focus());
        }
        return;
      }
      if (typing) return;
      const key = e.key.toLowerCase();
      const cmd = e.metaKey || e.ctrlKey;
      if (cmd) {
        if (key === "e") {
          e.preventDefault();
          setMenu("export");
        } else if (key === "c" && e.shiftKey) {
          e.preventDefault();
          void copyExport(
            exportAnnotations(
              saved.annotations,
              "md",
              true,
              sections,
              labels,
              new Date(),
              paper,
            ),
            announce,
            saved.annotations.length,
          );
        } else if (["g", "f", "z"].includes(key)) {
          e.preventDefault();
          announce("Coming soon in this demo");
        }
        return;
      }
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const all = sortedAnnotations(saved.annotations);
        const index = all.findIndex((a) => a.id === saved.active);
        const next =
          all[
            Math.max(
              0,
              Math.min(all.length - 1, index + (e.key === "ArrowUp" ? -1 : 1)),
            )
          ];
        if (next) openAnnotation(next);
        return;
      }
      if (e.altKey) return;
      if (selection && ["h", "n", "q", "u"].includes(key)) {
        e.preventDefault();
        begin(
          key === "n" ? "note" : key === "q" ? "question" : "highlight",
          key === "u" ? "understood" : "unmarked",
        );
        return;
      }
      if (key === "u" && saved.draft) {
        e.preventDefault();
        setSaved((old) => ({
          ...old,
          draft: old.draft
            ? {
                ...old.draft,
                understanding:
                  UNDERSTANDINGS[
                    (UNDERSTANDINGS.indexOf(old.draft.understanding) + 1) % 4
                  ],
              }
            : null,
        }));
        return;
      }
      if (window.getSelection()?.toString()) return;
      if (key === "f") {
        e.preventDefault();
        toggleFocus();
      } else if (key === "m" || key === "l") {
        e.preventDefault();
        setSaved((old) => ({ ...old, mode: key === "m" ? "margin" : "list" }));
        setPageFilter(null);
      } else if (key === "\\") {
        e.preventDefault();
        setSaved((old) => ({
          ...old,
          minimap: old.minimap === "map" ? "contents" : "map",
        }));
      } else if (e.key === "?") {
        e.preventDefault();
        setShortcuts(true);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        jump(saved.position.page + (e.key === "ArrowRight" ? 1 : -1));
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  const stub = useCallback(
    () => announce("Coming soon in this demo"),
    [announce],
  );
  // Reading-position updates should move the rail, not reconcile 116 PDF pages.
  const documentView = useMemo(
    () => (
      <PdfView
        study={paper}
        width={width}
        annotations={saved.annotations}
        active={saved.active}
        scrollRoot={viewport}
        onOpen={openAnnotation}
        onSelection={setSelection}
        onLoad={onLoad}
        onReady={onReady}
        onMetadata={onMetadata}
        onLocated={onLocated}
        renderPageLayer={(page, near, height) => (
          <AnnotationPageLayer
            annotations={saved.annotations}
            page={page}
            height={height}
            near={near}
            mode={mode}
            focus={focus}
            peek={peek}
            active={saved.active}
            show={saved.showOnPage}
            labels={labels}
            draft={saved.draft}
            onOpen={openAnnotation}
            onClosePeek={() => setPeek(null)}
            onShowMargin={() => {
              setFocus(false);
              setSaved((old) => ({
                ...old,
                mode: screenWidth < 1100 ? "list" : "margin",
              }));
              setPeek(null);
            }}
            onOverflow={(page) => {
              setSaved((old) => ({ ...old, mode: "list" }));
              setPageFilter(page);
            }}
            onStub={stub}
          />
        )}
      />
    ),
    [
      paper,
      width,
      saved.annotations,
      saved.active,
      saved.showOnPage,
      saved.draft,
      openAnnotation,
      onLoad,
      onReady,
      onMetadata,
      onLocated,
      mode,
      focus,
      peek,
      labels,
      screenWidth,
      stub,
    ],
  );
  return (
    <div
      className={`production-reader ${focus ? "is-focused" : ""} mode-${mode}`}
      style={{ "--page-width": `${width}px` } as CSSProperties}
    >
      <header className="reader-header">
        <div className="header-start chrome">
          <Link className="pill library-back" href="/">
            <ChevronLeft size={14} />
            Library
          </Link>
          <span className="wordmark">Margin</span>
        </div>
        <h1 title={paper.title}>{paper.title}</h1>
        <div className="header-end">
          {focus ? (
            <button
              ref={exitButton}
              className="pill"
              onClick={() => {
                setFocus(false);
                setPeek(null);
                requestAnimationFrame(() => focusButton.current?.focus());
              }}
            >
              Exit focus <kbd className="plain-key">esc</kbd>
            </button>
          ) : (
            <>
              <button
                ref={focusButton}
                className="pill focus-button"
                onClick={toggleFocus}
                aria-pressed={focus}
              >
                <Focus size={16} />
                Focus
              </button>
              <button
                className={`pill view-button ${menu === "view" ? "pressed" : ""}`}
                data-menu-trigger
                aria-expanded={menu === "view"}
                aria-haspopup="dialog"
                onClick={() => setMenu(menu === "view" ? null : "view")}
              >
                <SlidersHorizontal size={16} />
                View
              </button>
              <button
                className={`icon-button ${menu === "export" ? "pressed" : ""}`}
                aria-label="Download"
                title="Export annotations"
                data-menu-trigger
                aria-haspopup="dialog"
                aria-expanded={menu === "export"}
                onClick={() => setMenu(menu === "export" ? null : "export")}
              >
                <Download size={16} />
              </button>
            </>
          )}
        </div>
      </header>
      {!focus && (
        <section
          className="annotations-control"
          aria-label="Annotation display"
        >
          <h2>
            Annotations <span>{saved.annotations.length}</span>
          </h2>
          <Segmented<AnnotationMode>
            label="Annotations display"
            value={mode}
            options={[
              {
                value: "margin",
                label: "Margin",
                disabled: screenWidth < 1100,
              },
              { value: "list", label: "List" },
              { value: "hidden", label: "Hidden" },
            ]}
            onChange={(next) => {
              setSaved((old) => ({ ...old, mode: next }));
              setPeek(null);
              setPageFilter(null);
            }}
          />
        </section>
      )}
      <Navigation
        pageCount={paper.pageCount}
        neptune={neptune}
        mode={saved.minimap}
        focus={focus}
        page={saved.position.page}
        fraction={saved.position.fraction}
        annotations={saved.annotations}
        sections={sections}
        labels={labels}
        show={saved.showOnPage}
        onMode={(minimap) => setSaved((old) => ({ ...old, minimap }))}
        onJump={jump}
      />
      <main
        className="paper-viewport"
        ref={viewport}
        tabIndex={0}
        aria-label="Continuous PDF document"
        onScroll={scroll}
      >
        {documentView}
      </main>
      <Presence open={!focus && mode === "list"}>
        <AnnotationList
          annotations={saved.annotations}
          sections={sections}
          labels={labels}
          visiblePages={visiblePages}
          page={saved.position.page}
          active={saved.active}
          pageFilter={pageFilter}
          onClearPageFilter={() => setPageFilter(null)}
          onOpen={openAnnotation}
        />
      </Presence>
      {!focus && mode === "margin" && saved.annotations.length === 0 && (
        <aside className="empty-margin">
          <EmptyAnnotations />
        </aside>
      )}
      {selection && !saved.draft && (
        <SelectionToolbar selection={selection} onCreate={begin} />
      )}
      {saved.draft && (
        <Composer
          draft={saved.draft}
          onChange={(draft: Draft) => setSaved((old) => ({ ...old, draft }))}
          onCancel={cancelDraft}
          onSave={saveDraft}
        />
      )}
      <Presence open={menu === "view"}>
        <ViewMenu
          showOnPage={saved.showOnPage}
          onShowChange={(showOnPage) =>
            setSaved((old) => ({ ...old, showOnPage }))
          }
          onClose={() => setMenu(null)}
          onShortcuts={() => {
            setMenu(null);
            setShortcuts(true);
          }}
        />
      </Presence>
      <Presence open={menu === "export"}>
        <ExportMenu
          study={paper}
          annotations={saved.annotations}
          sections={sections}
          labels={labels}
          onClose={() => setMenu(null)}
          onToast={announce}
        />
      </Presence>
      <Presence open={shortcuts}>
        <Shortcuts onClose={() => setShortcuts(false)} />
      </Presence>
      <div className="mobile-reader-bar">
        <span>Best on a larger screen</span>
        <button
          className="pill"
          onClick={() =>
            setSaved((old) => ({
              ...old,
              minimap: old.minimap === "contents" ? "map" : "contents",
            }))
          }
        >
          Contents
        </button>
        <button
          className="pill"
          onClick={() =>
            setSaved((old) => ({
              ...old,
              mode: old.mode === "list" ? "hidden" : "list",
            }))
          }
        >
          Annotations
        </button>
      </div>
      {storageError && (
        <div className="storage-notice" role="alert">
          {storageError}
        </div>
      )}
      <Toast message={toast} />
    </div>
  );
}
