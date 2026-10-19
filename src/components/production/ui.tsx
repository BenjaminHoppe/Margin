"use client";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
// Keep closing surfaces mounted briefly so exits can finish. Reopening cancels
// the pending removal, and inert prevents interaction during the exit.
export function Presence({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const [present, setPresent] = useState(open);
  useEffect(() => {
    const duration =
      open || matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 160;
    const timer = setTimeout(() => setPresent(open), duration);
    return () => clearTimeout(timer);
  }, [open]);
  if (!open && !present) return null;
  return (
    <div
      className="presence"
      data-presence={open ? "open" : "closing"}
      inert={!open}
    >
      {children}
    </div>
  );
}
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; disabled?: boolean }[];
  onChange: (value: T) => void;
}) {
  const index = options.findIndex((o) => o.value === value);
  return (
    <div
      className="segmented"
      role="radiogroup"
      aria-label={label}
      style={
        {
          "--segments": options.length,
          "--segment-index": Math.max(0, index),
        } as CSSProperties
      }
    >
      <span className="segment-indicator" aria-hidden="true" />
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              const step = e.key === "ArrowLeft" ? -1 : 1;
              let next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? options.length - 1
                    : (i + step + options.length) % options.length;
              while (options[next].disabled)
                next = (next + step + options.length) % options.length;
              onChange(options[next].value);
              (
                e.currentTarget.parentElement?.children[
                  next + 1
                ] as HTMLButtonElement
              )?.focus();
            }
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function Popover({
  label,
  children,
  onClose,
  className = "",
}: {
  label: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button,input,select")?.focus();
    const outside = (e: PointerEvent) => {
      if (
        !ref.current?.contains(e.target as Node) &&
        !(e.target as Element).closest("[data-menu-trigger]")
      )
        close.current();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close.current();
      }
      if (e.key === "Tab") {
        const els = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,[tabindex="0"]',
          ) ?? [],
        );
        const next =
          els.indexOf(document.activeElement as HTMLElement) +
          (e.shiftKey ? -1 : 1);
        if (next < 0 || next >= els.length) {
          e.preventDefault();
          els[(next + els.length) % els.length]?.focus();
        }
      }
    };
    document.addEventListener("pointerdown", outside);
    ref.current?.addEventListener("keydown", key);
    const el = ref.current;
    return () => {
      document.removeEventListener("pointerdown", outside);
      el?.removeEventListener("keydown", key);
      if (
        previous?.isConnected &&
        (el?.contains(document.activeElement) ||
          document.activeElement === document.body)
      )
        previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      ref={ref}
      className={`popover ${className}`}
      role="dialog"
      aria-label={label}
    >
      {children}
    </div>
  );
}
export function Shortcuts({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => prior?.focus({ preventScroll: true });
  }, []);
  const mac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform);
  const cmd = mac ? "⌘" : "Ctrl";
  const groups = [
    [
      "View",
      [
        ["Focus mode", "F"],
        ["Exit focus · close", "Esc"],
        ["Annotations beside the page", "M"],
        ["Annotations as a list", "L"],
        ["Contents ↔ minimap", "\\"],
      ],
    ],
    [
      "Annotate",
      [
        ["Highlight selection", "H"],
        ["Add a note", "N"],
        ["Ask a question", "Q"],
        ["Mark understanding", "U"],
        ["Save", `${cmd} ↵`],
      ],
    ],
    [
      "Move",
      [
        ["Previous page", "←"],
        ["Next page", "→"],
        ["Previous annotation", "Alt ↑"],
        ["Next annotation", "Alt ↓"],
        ["Go to page · coming soon", `${cmd} G`],
      ],
    ],
    [
      "General",
      [
        ["Search the paper · coming soon", `${cmd} F`],
        ["Export annotations", `${cmd} E`],
        ["Copy as Markdown", `${cmd} Shift C`],
        ["Undo · coming soon", `${cmd} Z`],
        ["Show keyboard shortcuts", "?"],
      ],
    ],
  ] as [string, string[][]][];
  return (
    <dialog
      className="shortcuts-dialog"
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="shortcuts-title"
    >
      <div className="shortcuts-heading">
        <div>
          <h2 id="shortcuts-title">Keyboard shortcuts</h2>
          <p>
            Press ? anywhere to open this. Shortcuts never fire while you’re
            typing.
          </p>
        </div>
        <button
          className="icon-button subtle"
          aria-label="Close keyboard shortcuts"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <div className="shortcut-grid">
        {groups.map(([title, rows]) => (
          <section key={title}>
            <h3 className="eyebrow">{title}</h3>
            {rows.map(([label, key]) => (
              <div className="shortcut-row" key={label}>
                <span>{label}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </section>
        ))}
      </div>
    </dialog>
  );
}
export function Toast({ message }: { message: string }) {
  return (
    <div
      className={`toast ${message ? "visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
