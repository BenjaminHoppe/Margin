"use client";
import { readerPageLayout } from "@/lib/reader-zoom";
import { usePreferences } from "./preferences";
import type { Study } from "@/lib/study";
import Link from "next/link";
import { flushSync } from "react-dom";
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
  inferAnnotationKind,
  isDraftDirty,
  type Annotation,
  type Draft,
  type Kind,
  type Rect,
} from "@/lib/annotations";
import { exportAnnotations } from "@/lib/reader-export";
import {
  fallbackSections,
  normalizeOutline,
  paper as neptunePaper,
  readReaderState,
  resetSessionAnnotations,
  readerKey,
  sortedAnnotations,
  type AnnotationMode,
  type OutlineSection,
} from "@/lib/reader-model";
import { AnnotationPageLayer, EmptyAnnotations } from "./annotation-layers";
import { AnnotationList } from "./annotation-list";
import { SelectionToolbar, type TextSelection } from "./annotating";
import { Navigation } from "./navigation";
import { copyExport, ExportMenu, ViewMenu } from "./menus";
import { Presence, Segmented, Shortcuts, Toast } from "./ui";
export default function Reader({ study: paper }: { study: Study }) {
  const preferences = usePreferences();
  const neptune = paper.id === neptunePaper.id;
  const storageKey = readerKey(paper);
  const [initial] = useState(() => {
    const loaded = readReaderState(localStorage, paper);
    return { ...loaded, state: resetSessionAnnotations(loaded.state, paper) };
  });
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
  const manualDraftType = useRef<Kind | null>(null);
  const editorFocusFrame = useRef<number | null>(null);
  const [toast, setToast] = useState("");
  const [pageFilter, setPageFilter] = useState<number | null>(null);
  const [screenWidth, setScreenWidth] = useState(() => innerWidth);
  const [visibleAnnotationIds, setVisibleAnnotationIds] = useState<string[]>(
    [],
  );
  const [ready, setReady] = useState(false);
  const [animateProgress, setAnimateProgress] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const scrollFrame = useRef<number | null>(null);
  const jumpEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingJump = useRef<{
    page: number;
    fraction: number;
    top: number;
  } | null>(null);
  const pageGeometry = useRef<{ page: number; top: number; height: number }[]>(
    [],
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(saved);
  const focusButton = useRef<HTMLButtonElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const lastWidth = useRef(0);
  const mode: AnnotationMode =
    screenWidth < 1100 && saved.mode === "margin" ? "hidden" : saved.mode;
  const layout = readerPageLayout(screenWidth, preferences.studyZoomPercent, {
    margin:
      (!focus && mode === "margin") ||
      (mode !== "list" && Boolean(saved.draft || peek)),
    list: !focus && mode === "list",
    contents: saved.minimap === "contents",
    focus,
  });
  const { width } = layout;
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
      if (jumpEndTimer.current) clearTimeout(jumpEndTimer.current);
      if (scrollFrame.current !== null)
        cancelAnimationFrame(scrollFrame.current);
      if (editorFocusFrame.current !== null)
        cancelAnimationFrame(editorFocusFrame.current);
    };
  }, []);
  useEffect(() => {
    if (initial.error) return;
    const write = () => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(resetSessionAnnotations(savedRef.current, paper)),
        );
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
  }, [initial.error, storageKey, paper]);
  useEffect(() => {
    if (initial.error) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(resetSessionAnnotations(saved, paper)),
        );
      } catch {
        setStorageError(
          "Browser storage is unavailable. Keep this tab open and export your annotations.",
        );
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [saved, initial.error, storageKey, paper]);
  const finishJump = useCallback(() => {
    const target = pendingJump.current;
    const root = viewport.current;
    // Native smooth scrolling can settle just shy of an exact fractional
    // heading. Keep the requested outline coordinate on arrival, not the
    // preceding section selected by subpixel rounding.
    if (target && root && Math.abs(root.scrollTop - target.top) <= 2) {
      setSaved((old) => ({
        ...old,
        position: { page: target.page, fraction: target.fraction },
      }));
    }
    pendingJump.current = null;
    setAnimateProgress(false);
  }, []);
  const interruptJump = useCallback(() => {
    pendingJump.current = null;
    if (jumpEndTimer.current) clearTimeout(jumpEndTimer.current);
    setAnimateProgress(false);
  }, []);
  function changeStudyZoom(percent: number) {
    interruptJump();
    if (scrollFrame.current !== null) cancelAnimationFrame(scrollFrame.current);
    scrollFrame.current = null;
    const root = viewport.current;
    if (root) {
      const top = root.scrollTop + 84;
      const anchor = pageGeometry.current.find(
        (page) => page.top + page.height > top,
      );
      if (anchor)
        setSaved((old) => ({
          ...old,
          position: {
            page: anchor.page,
            fraction: Math.max(
              0,
              Math.min(1, (top - anchor.top) / anchor.height),
            ),
          },
        }));
    }
    clearSelection();
    preferences.setStudyZoomPercent(percent);
  }
  const jump = useCallback(
    (page: number, fraction = 0, smooth = true) => {
      const root = viewport.current;
      if (!root) return;
      const target = Math.max(1, Math.min(paper.pageCount, page));
      const el = root.querySelector<HTMLElement>(`[data-page="${target}"]`);
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const animated =
        smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches;
      setAnimateProgress(animated);
      if (jumpEndTimer.current) clearTimeout(jumpEndTimer.current);
      // Also settle clicks that are already at their destination and emit no scroll.
      const top = Math.max(
        0,
        Math.min(
          root.scrollHeight - root.clientHeight,
          root.scrollTop +
            rect.top -
            root.getBoundingClientRect().top -
            84 +
            fraction * rect.height,
        ),
      );
      pendingJump.current = animated ? { page: target, fraction, top } : null;
      jumpEndTimer.current = setTimeout(finishJump, 200);
      root.scrollTo({ top, behavior: animated ? "smooth" : "instant" });
      setSelection(null);
    },
    [paper.pageCount, finishJump],
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
          : paper.sections.length > 1
            ? paper.sections
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
  const refreshVisibleAnnotations = useCallback(() => {
    const root = viewport.current;
    if (!root || !restored.current) return;
    const top = root.scrollTop + 84;
    const bottom = root.scrollTop + root.clientHeight;
    const visible = savedRef.current.annotations
      .filter((annotation) => {
        const geometry = pageGeometry.current.find(
          (p) => p.page === annotation.page,
        );
        return (
          geometry &&
          annotation.rects.some((rect) => {
            const passageTop = geometry.top + rect.y * geometry.height;
            return (
              passageTop + rect.height * geometry.height > top &&
              passageTop < bottom
            );
          })
        );
      })
      .map((annotation) => annotation.id);
    setVisibleAnnotationIds((previous) =>
      previous.join(",") === visible.join(",") ? previous : visible,
    );
  }, []);
  const changeDisplayMode = useCallback(
    (next: AnnotationMode) => {
      if (editorFocusFrame.current !== null)
        cancelAnimationFrame(editorFocusFrame.current);
      editorFocusFrame.current = null;
      // Commit the display handoff in the triggering event, before a browser paint.
      flushSync(() => {
        setSaved((old) => ({ ...old, mode: next }));
        setPeek(null);
        setSelection(null);
        setPageFilter(null);
      });
      window.getSelection()?.removeAllRanges();
      refreshVisibleAnnotations();
    },
    [refreshVisibleAnnotations],
  );
  // Page boxes have stable dimensions between layout changes. Cache document
  // coordinates rather than measuring every page on every animation frame.
  useLayoutEffect(() => {
    const root = viewport.current;
    if (!ready || !root) return;
    const elements = Array.from(
      root.querySelectorAll<HTMLElement>("[data-page]"),
    );
    const measure = () => {
      const origin = root.getBoundingClientRect().top - root.scrollTop;
      pageGeometry.current = elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          page: Number(element.dataset.page),
          top: rect.top - origin,
          height: rect.height,
        };
      });
      refreshVisibleAnnotations();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [ready, width, paper.id, refreshVisibleAnnotations]);
  useLayoutEffect(() => {
    refreshVisibleAnnotations();
  }, [ready, width, mode, saved.annotations, refreshVisibleAnnotations]);
  function scroll() {
    if (jumpEndTimer.current) clearTimeout(jumpEndTimer.current);
    jumpEndTimer.current = setTimeout(finishJump, 120);
    setSelection(null);
    if (scrollFrame.current !== null) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = null;
      const root = viewport.current;
      if (!root || !restored.current) return;
      const top = root.scrollTop + 84;
      const pages = pageGeometry.current;
      refreshVisibleAnnotations();
      const anchor = pages.find((p) => p.top + p.height > top) ?? pages.at(-1);
      if (!anchor) return;
      const fraction =
        root.scrollTop + root.clientHeight >= root.scrollHeight - 3
          ? 1
          : Math.max(0, Math.min(1, (top - anchor.top) / anchor.height));
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
  const openSidebarAnnotation = useCallback(
    (annotation: Annotation) => {
      // Sidebar previews already expose the card. Preserve the chosen display
      // mode instead of creating a temporary margin card in Hidden mode.
      setSaved((old) => ({ ...old, active: annotation.id }));
      setPeek(null);
      jump(annotation.page, annotation.rects[0]?.y ?? 0);
    },
    [jump],
  );
  function clearSelection() {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }
  const startAnnotation = useCallback(
    (selected: TextSelection | null) => {
      if (!selected) return;
      if (isDraftDirty(savedRef.current.draft, savedRef.current.annotations)) {
        announce(
          "Save or cancel your current annotation before selecting another passage.",
        );
        return;
      }
      manualDraftType.current = null;
      const now = new Date().toISOString();
      const annotation: Annotation = {
        id: crypto.randomUUID(),
        page: selected.page,
        quote: selected.quote,
        rects: selected.rects,
        kind: "highlight",
        understanding: "unmarked",
        body: "",
        resolved: false,
        createdAt: now,
        updatedAt: now,
      };
      setSelection(selected);
      setPeek(null);
      setSaved((old) => ({
        ...old,
        annotations: [...old.annotations, annotation],
        active: annotation.id,
        draft: null,
      }));
      if (editorFocusFrame.current !== null)
        cancelAnimationFrame(editorFocusFrame.current);
      editorFocusFrame.current = requestAnimationFrame(() => {
        editorFocusFrame.current = null;
        window.getSelection()?.removeAllRanges();
        document
          .querySelector<HTMLButtonElement>(".selection-toolbar button")
          ?.focus({ preventScroll: true });
      });
    },
    [announce],
  );
  const begin = useCallback((kind: Kind) => {
    // Every explicit choice remains authoritative over text inference.
    manualDraftType.current = kind;
    setSaved((old) => ({
      ...old,
      draft: old.draft ? { ...old.draft, kind } : null,
    }));
    if (kind !== "highlight")
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLTextAreaElement>(".inline-composer textarea")
          ?.focus({ preventScroll: true }),
      );
  }, []);
  const changeDraft = useCallback((draft: Draft) => {
    setSaved((old) => ({
      ...old,
      draft: {
        ...draft,
        kind: inferAnnotationKind(draft.body, manualDraftType.current),
      },
    }));
  }, []);
  const cancelDraft = useCallback(() => {
    if (editorFocusFrame.current !== null)
      cancelAnimationFrame(editorFocusFrame.current);
    editorFocusFrame.current = null;
    manualDraftType.current = null;
    flushSync(() => {
      setSaved((old) => ({ ...old, draft: null, active: null }));
      setPeek(null);
      setSelection(null);
    });
    window.getSelection()?.removeAllRanges();
    viewport.current?.focus({ preventScroll: true });
  }, []);
  const focusEditor = useCallback(
    (annotation: Pick<Annotation, "page" | "rects">) => {
      if (mode !== "list")
        jump(
          annotation.page,
          Math.max(0, (annotation.rects[0]?.y ?? 0) - 0.15),
          false,
        );
      if (editorFocusFrame.current !== null)
        cancelAnimationFrame(editorFocusFrame.current);
      let attempts = 0;
      const focusWhenMounted = () => {
        editorFocusFrame.current = null;
        const textarea =
          mode === "list"
            ? document.querySelector<HTMLTextAreaElement>(
                ".annotation-list-panel .inline-composer textarea",
              )
            : viewport.current?.querySelector<HTMLTextAreaElement>(
                `[data-page="${annotation.page}"] .inline-composer textarea`,
              );
        if (!textarea) {
          if (++attempts < 30)
            editorFocusFrame.current = requestAnimationFrame(focusWhenMounted);
          return;
        }
        const root =
          mode === "list"
            ? document.querySelector<HTMLElement>(".list-scroll")
            : viewport.current;
        const form = textarea.form;
        if (root && form) {
          const bounds = form.getBoundingClientRect();
          const viewportBounds = root.getBoundingClientRect();
          const minimumTop = viewportBounds.top + 96;
          const maximumBottom = viewportBounds.bottom - 24;
          const offset =
            bounds.top < minimumTop
              ? bounds.top - minimumTop
              : bounds.bottom > maximumBottom
                ? bounds.bottom - maximumBottom
                : 0;
          if (offset) root.scrollBy({ top: offset, behavior: "instant" });
        }
        textarea.focus({ preventScroll: true });
      };
      editorFocusFrame.current = requestAnimationFrame(focusWhenMounted);
    },
    [jump, mode],
  );
  const editAnnotation = useCallback(
    (annotation: Annotation) => {
      if (isDraftDirty(savedRef.current.draft, savedRef.current.annotations)) {
        announce(
          "Save or cancel your current annotation before editing another.",
        );
        return;
      }
      manualDraftType.current =
        annotation.kind === "highlight" ? null : annotation.kind;
      clearSelection();
      setPeek(null);
      setSaved((old) => ({
        ...old,
        active: annotation.id,
        draft: { ...annotation },
      }));
      focusEditor(annotation);
    },
    [announce, focusEditor],
  );
  const deleteAnnotation = useCallback(
    (annotation: Annotation) => {
      if (editorFocusFrame.current !== null)
        cancelAnimationFrame(editorFocusFrame.current);
      editorFocusFrame.current = null;
      window.getSelection()?.removeAllRanges();
      flushSync(() => {
        setSelection(null);
        setSaved((old) => ({
          ...old,
          annotations: old.annotations.filter(
            (item) => item.id !== annotation.id,
          ),
          active: old.active === annotation.id ? null : old.active,
          draft: old.draft?.id === annotation.id ? null : old.draft,
        }));
        setPeek((old) => (old === annotation.id ? null : old));
      });
      announce(
        `${annotation.kind[0].toUpperCase() + annotation.kind.slice(1)} deleted`,
      );
      viewport.current?.focus({ preventScroll: true });
    },
    [announce],
  );
  const saveDraft = useCallback(() => {
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
      createdAt:
        savedRef.current.annotations.find(
          (original) => original.id === draft.id,
        )?.createdAt ?? now,
      updatedAt: now,
    };
    setSaved((old) => ({
      ...old,
      annotations: [...old.annotations.filter((n) => n.id !== a.id), a],
      draft: null,
      active: a.id,
    }));
    setPeek(null);
    announce(
      `${a.kind === "question" ? "Question" : a.kind === "note" ? "Note" : "Highlight"} saved`,
    );
    clearSelection();
    viewport.current?.focus({ preventScroll: true });
  }, [saved.draft, announce]);
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
    if (!selection) return;
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Element &&
        event.target.closest(".selection-toolbar")
      )
        return;
      setSelection(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [selection]);
  useEffect(() => {
    const event = (e: CustomEvent<number>) => jump(e.detail);
    const listener = (e: Event) => event(e as CustomEvent<number>);
    window.addEventListener("margin:page", listener);
    return () => window.removeEventListener("margin:page", listener);
  }, [jump]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.isComposing ||
        document.querySelector("dialog[open]")
      )
        return;
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
      if (key === "/" && !cmd && !e.altKey) {
        if (saved.draft) {
          e.preventDefault();
          focusEditor(saved.draft);
          return;
        }
        const annotation = saved.annotations.find(
          (item) => item.id === saved.active,
        );
        if (annotation) {
          e.preventDefault();
          editAnnotation(annotation);
          return;
        }
      }
      if (cmd && e.key === "Enter" && saved.draft) {
        e.preventDefault();
        saveDraft();
        return;
      }
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
      if (saved.draft) return;
      if (window.getSelection()?.toString()) return;
      if (key === "f") {
        e.preventDefault();
        toggleFocus();
      } else if (key === "m" || key === "l") {
        e.preventDefault();
        changeDisplayMode(key === "m" ? "margin" : "list");
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
        onSelection={startAnnotation}
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
            onDraftChange={changeDraft}
            onDraftTypeChange={begin}
            onDraftCancel={cancelDraft}
            onDraftSave={saveDraft}
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
            onEdit={editAnnotation}
            onDelete={deleteAnnotation}
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
      startAnnotation,
      changeDraft,
      begin,
      cancelDraft,
      saveDraft,
      onLoad,
      onReady,
      onMetadata,
      onLocated,
      mode,
      focus,
      peek,
      labels,
      screenWidth,
      editAnnotation,
      deleteAnnotation,
    ],
  );
  return (
    <div
      className={`production-reader ${focus ? "is-focused" : ""} mode-${mode}`}
      style={
        {
          "--page-width": `${width}px`,
          "--navigation-page-width": `${layout.baseWidth}px`,
          "--page-left": `${layout.left}px`,
          "--document-width": `${layout.contentWidth}px`,
          "--reader-panel-inset": `${layout.panelInset}px`,
        } as CSSProperties
      }
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
            onChange={changeDisplayMode}
          />
        </section>
      )}
      <Navigation
        animateProgress={animateProgress}
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
        onOpenAnnotation={openSidebarAnnotation}
      />
      <main
        className="paper-viewport"
        ref={viewport}
        tabIndex={0}
        aria-label="Continuous PDF document"
        onScroll={scroll}
        onWheelCapture={interruptJump}
        onTouchStartCapture={interruptJump}
        onPointerDownCapture={interruptJump}
        onKeyDownCapture={(event) => {
          if (
            [
              "ArrowUp",
              "ArrowDown",
              "PageUp",
              "PageDown",
              "Home",
              "End",
              " ",
            ].includes(event.key)
          )
            interruptJump();
        }}
      >
        {documentView}
      </main>
      {!focus && mode === "list" && (
        <AnnotationList
          annotations={saved.annotations}
          sections={sections}
          labels={labels}
          visibleAnnotationIds={visibleAnnotationIds}
          draft={saved.draft}
          onDraftChange={changeDraft}
          onDraftTypeChange={begin}
          onDraftCancel={cancelDraft}
          onDraftSave={saveDraft}
          onEdit={editAnnotation}
          onDelete={deleteAnnotation}
          page={saved.position.page}
          active={saved.active}
          pageFilter={pageFilter}
          onClearPageFilter={() => setPageFilter(null)}
          onOpen={openAnnotation}
        />
      )}
      {!focus && mode === "margin" && saved.annotations.length === 0 && (
        <aside className="empty-margin">
          <EmptyAnnotations />
        </aside>
      )}
      <Presence open={menu === "view"}>
        <ViewMenu
          studyZoom={{
            percent: preferences.studyZoomPercent,
            onChange: changeStudyZoom,
            overflowing: layout.overflowing,
          }}
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
            changeDisplayMode(saved.mode === "list" ? "hidden" : "list")
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
      {selection && (
        <SelectionToolbar
          selection={selection}
          onChoose={(kind) => {
            if (kind === "highlight") return;
            const annotation = saved.annotations.find(
              (a) => a.id === saved.active,
            );
            if (annotation) editAnnotation({ ...annotation, kind });
          }}
        />
      )}
      <Toast message={toast} />
    </div>
  );
}
