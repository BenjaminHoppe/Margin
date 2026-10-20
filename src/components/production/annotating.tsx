"use client";
import { useLayoutEffect, useRef } from "react";
import {
  Command,
  CornerDownLeft,
  Highlighter,
  MessageSquare,
  CircleHelp,
} from "lucide-react";
import { type Draft, type Kind } from "@/lib/annotations";
import { kindLabel } from "@/lib/reader-model";
import type { captureSelection } from "@/lib/selection";
import { Segmented } from "./ui";
export type TextSelection = NonNullable<ReturnType<typeof captureSelection>>;
export function SelectionToolbar({
  selection,
  onChoose,
}: {
  selection: TextSelection;
  onChoose: (kind: Kind) => void;
}) {
  const toolbar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const page = document.querySelector<HTMLElement>(
      `[data-page="${selection.page}"]`,
    );
    if (!page || !toolbar.current) return;
    const box = page.getBoundingClientRect();
    const first = selection.rects[0];
    const width = toolbar.current.offsetWidth;
    toolbar.current.style.left = `${Math.max(12, Math.min(innerWidth - width - 12, box.left + (first.x + first.width / 2) * box.width - width / 2))}px`;
    toolbar.current.style.top = `${Math.max(80, Math.min(innerHeight - 60, box.top + first.y * box.height - 52))}px`;
  }, [selection]);
  return (
    <div
      ref={toolbar}
      className="selection-toolbar"
      role="group"
      aria-label="Annotation type"
      style={{ left: selection.left, top: selection.top }}
    >
      {(
        [
          { kind: "highlight", label: "Highlight", Icon: Highlighter },
          { kind: "note", label: "Note", Icon: MessageSquare },
          { kind: "question", label: "Question", Icon: CircleHelp },
        ] as const
      ).map(({ kind, label, Icon }) => (
        <button
          key={kind}
          aria-pressed={kind === "highlight"}
          className={kind === "highlight" ? "selected-type highlight" : kind}
          onClick={() => onChoose(kind)}
        >
          <Icon size={14} className={`icon-signal ${kind}`} />
          {label}
        </button>
      ))}
    </div>
  );
}
export function Composer({
  draft,
  onChange,
  onTypeChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onTypeChange: (kind: Kind) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const mac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  const savedHighlight = draft.kind === "highlight" && !draft.body.trim();
  useLayoutEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = "auto";
      textarea.current.style.height = `${Math.min(200, Math.max(64, textarea.current.scrollHeight))}px`;
    }
  }, [draft.body]);
  return (
    <form
      className={`composer inline-composer ${draft.kind}`}
      data-card-id="draft"
      tabIndex={0}
      aria-label="Annotation composer"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (
          e.target === e.currentTarget &&
          e.key.length === 1 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.altKey
        ) {
          e.preventDefault();
          e.stopPropagation();
          onChange({ ...draft, body: draft.body + e.key });
          textarea.current?.focus({ preventScroll: true });
          return;
        }
        if (e.key === "Escape") {
          e.stopPropagation();
          e.preventDefault();
          onCancel();
        }
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          onSave();
        }
      }}
    >
      <div className="composer-controls">
        <Segmented<Kind>
          label="Annotation type"
          value={draft.kind}
          options={(["highlight", "note", "question"] as const).map(
            (value) => ({
              value,
              label: value[0].toUpperCase() + value.slice(1),
            }),
          )}
          onChange={onTypeChange}
        />
      </div>
      <textarea
        ref={textarea}
        aria-label={draft.kind === "question" ? "Your question" : "Your note"}
        placeholder="Type a note or a question…"
        value={draft.body}
        onChange={(e) => onChange({ ...draft, body: e.target.value })}
      />
      <footer>
        <span
          className="composer-hint"
          aria-label={
            savedHighlight
              ? undefined
              : `${mac ? "Command" : "Control"} Enter to save`
          }
        >
          {savedHighlight ? (
            "Highlight saved"
          ) : (
            <>
              <span className="composer-key-combo" aria-hidden="true">
                {mac ? <Command size={13} /> : <span>Ctrl</span>}
                <CornerDownLeft size={13} />
              </span>
              <span>Save</span>
            </>
          )}
        </span>
        <button type="button" className="text-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="pill primary">
          {draft.kind === "highlight" && !draft.body.trim()
            ? "Done"
            : `Save ${kindLabel[draft.kind]}`}
        </button>
      </footer>
    </form>
  );
}
