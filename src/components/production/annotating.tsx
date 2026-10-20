"use client";
import { useEffect, useRef, useState } from "react";
import { CircleHelp, Highlighter, MessageSquare } from "lucide-react";
import { UNDERSTANDINGS, type Draft, type Kind } from "@/lib/annotations";
import { kindLabel, understandingLabel } from "@/lib/reader-model";
import type { captureSelection } from "@/lib/selection";
import { Segmented } from "./ui";
export type TextSelection = NonNullable<ReturnType<typeof captureSelection>>;
export function SelectionToolbar({
  selection,
  kind,
  onCreate,
  onSave,
}: {
  selection: TextSelection;
  kind: Kind;
  onCreate: (kind: Kind) => void;
  onSave: () => void;
}) {
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      const page = document.querySelector<HTMLElement>(
        `[data-page="${selection.page}"]`,
      );
      if (!page || !toolbar.current) return;
      const box = page.getBoundingClientRect();
      const first = selection.rects[0];
      const width = toolbar.current.offsetWidth;
      toolbar.current.style.left = `${Math.max(12, Math.min(innerWidth - width - 12, box.left + (first.x + first.width / 2) * box.width - width / 2))}px`;
      toolbar.current.style.top = `${Math.max(80, Math.min(innerHeight - 60, box.top + first.y * box.height - 52))}px`;
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [selection]);
  return (
    <div
      ref={toolbar}
      className="selection-toolbar"
      role="toolbar"
      aria-label="Annotation type"
      style={{ left: selection.left, top: selection.top }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {(
        [
          {
            kind: "highlight",
            label: "Highlight",
            Icon: Highlighter,
            key: "H",
          },
          { kind: "note", label: "Note", Icon: MessageSquare, key: "N" },
          { kind: "question", label: "Question", Icon: CircleHelp, key: "Q" },
        ] as const
      ).map((action) => (
        <button
          key={action.kind}
          aria-pressed={kind === action.kind}
          className={
            kind === action.kind ? `selected-type ${action.kind}` : action.kind
          }
          title={`${action.label} (${action.key}, outside the text field)`}
          onClick={() => onCreate(action.kind)}
        >
          <action.Icon size={14} className={`icon-signal ${action.kind}`} />
          {action.label}
        </button>
      ))}
      <button className="after-divider" onClick={onSave}>
        Save
      </button>
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
  const [understandingOpen, setUnderstandingOpen] = useState<boolean | null>(
    null,
  );
  const [editing, setEditing] = useState(false);
  const showUnderstanding =
    understandingOpen ?? draft.understanding !== "unmarked";
  useEffect(() => {
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
      aria-describedby="annotation-keyboard-hint"
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
        <div className="composer-understanding">
          <button
            type="button"
            className="understanding-toggle"
            aria-expanded={showUnderstanding}
            onClick={() => setUnderstandingOpen(!showUnderstanding)}
          >
            <span>
              {showUnderstanding
                ? "Understanding"
                : draft.understanding !== "unmarked"
                  ? understandingLabel[draft.understanding]
                  : "Mark understanding"}
              <span className="optional-label">Optional</span>
            </span>
            <kbd>↑ ↓</kbd>
          </button>
          {showUnderstanding && (
            <>
              <div
                className="understanding-tabs"
                role="group"
                aria-label="Understanding"
              >
                {UNDERSTANDINGS.filter((value) => value !== "unmarked").map(
                  (value) => (
                    <button
                      type="button"
                      key={value}
                      aria-pressed={draft.understanding === value}
                      onClick={() =>
                        onChange({ ...draft, understanding: value })
                      }
                    >
                      <i
                        className={`understanding-dot ${value.replaceAll(" ", "-")}`}
                        aria-hidden="true"
                      />
                      {value === "partly understood"
                        ? "Partly"
                        : understandingLabel[value]}
                    </button>
                  ),
                )}
              </div>
              {draft.understanding !== "unmarked" && (
                <button
                  type="button"
                  className="understanding-clear"
                  onClick={() =>
                    onChange({ ...draft, understanding: "unmarked" })
                  }
                >
                  Clear understanding
                </button>
              )}
            </>
          )}
        </div>
      </div>
      <p
        id="annotation-keyboard-hint"
        className="annotation-keyboard-hint"
        aria-live="polite"
      >
        {editing ? (
          <>
            Arrows move the cursor <span>·</span> <kbd>Esc</kbd> for controls
          </>
        ) : (
          <>
            <kbd>← →</kbd> type <span>·</span> <kbd>↑ ↓</kbd> understanding
            <br />
            Start typing to write
          </>
        )}
      </p>
      <textarea
        ref={textarea}
        aria-label={draft.kind === "question" ? "Your question" : "Your note"}
        placeholder="Type a note or a question…"
        value={draft.body}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={(e) => onChange({ ...draft, body: e.target.value })}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            event.currentTarget.form?.focus({ preventScroll: true });
          }
        }}
      />
      <footer>
        <span className="composer-hint">⌘↵ save</span>
        <button type="button" className="text-button" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="pill primary">
          Save {kindLabel[draft.kind]}
        </button>
      </footer>
    </form>
  );
}
