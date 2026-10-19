"use client";
import { useEffect, useRef } from "react";
import {
  Check,
  CircleAlert,
  CircleHelp,
  Highlighter,
  MessageSquare,
} from "lucide-react";
import {
  UNDERSTANDINGS,
  type Draft,
  type Kind,
  type Understanding,
} from "@/lib/annotations";
import { understandingLabel } from "@/lib/reader-model";
import type { captureSelection } from "@/lib/selection";
import { Segmented } from "./ui";
export type TextSelection = NonNullable<ReturnType<typeof captureSelection>>;
export function SelectionToolbar({
  selection,
  onCreate,
}: {
  selection: TextSelection;
  onCreate: (kind: Kind, understanding?: Understanding) => void;
}) {
  const x = Math.max(
    12,
    Math.min(innerWidth - 450, selection.left + 145 - 225),
  );
  return (
    <div
      className="selection-toolbar"
      role="toolbar"
      aria-label="Annotate selected text"
      style={{ left: x, top: selection.top }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {(
        [
          {
            label: "Highlight",
            kind: "highlight",
            Icon: Highlighter,
            color: "highlight",
          },
          { label: "Note", kind: "note", Icon: MessageSquare, color: "note" },
          {
            label: "Question",
            kind: "question",
            Icon: CircleHelp,
            color: "question",
          },
          {
            label: "Got it",
            kind: "highlight",
            Icon: Check,
            color: "understood",
            understanding: "understood",
          },
          {
            label: "Unclear",
            kind: "highlight",
            Icon: CircleAlert,
            color: "unclear",
            understanding: "unclear",
          },
        ] as const
      ).map((action, i) => (
        <button
          key={action.label}
          className={i === 3 ? "after-divider" : ""}
          onClick={() =>
            onCreate(
              action.kind,
              "understanding" in action ? action.understanding : undefined,
            )
          }
        >
          <action.Icon size={14} className={`icon-signal ${action.color}`} />
          {action.label}
        </button>
      ))}
    </div>
  );
}
export function Composer({
  draft,
  onChange,
  onCancel,
  onSave,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    textarea.current?.focus();
  }, []);
  useEffect(() => {
    if (textarea.current) {
      textarea.current.style.height = "auto";
      textarea.current.style.height = `${Math.min(200, Math.max(64, textarea.current.scrollHeight))}px`;
    }
  }, [draft.body]);
  return (
    <form
      className="composer"
      aria-label="Annotation composer"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      onKeyDown={(e) => {
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
          onChange={(kind) => onChange({ ...draft, kind })}
        />
        <label className="understanding-picker">
          <span
            className={`understanding-dot ${draft.understanding.replaceAll(" ", "-")}`}
          />
          <select
            aria-label="Understanding"
            value={draft.understanding}
            onChange={(e) =>
              onChange({
                ...draft,
                understanding: e.target.value as Understanding,
              })
            }
          >
            {UNDERSTANDINGS.map((value) => (
              <option key={value} value={value}>
                {understandingLabel[value]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <blockquote>“{draft.quote}”</blockquote>
      <textarea
        ref={textarea}
        aria-label={draft.kind === "question" ? "Your question" : "Your note"}
        placeholder={
          draft.kind === "question" ? "Ask a question…" : "Add a note…"
        }
        value={draft.body}
        onChange={(e) => onChange({ ...draft, body: e.target.value })}
      />
      <footer>
        <span className="composer-hint">⌘↵ save · esc cancel</span>
        <button type="button" className="text-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="pill primary">
          Save {draft.kind}
        </button>
      </footer>
    </form>
  );
}
