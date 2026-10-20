"use client";
import type { Study } from "@/lib/study";
import {
  MIN_STUDY_ZOOM,
  MAX_STUDY_ZOOM,
  STUDY_ZOOM_STEP,
} from "@/lib/reader-zoom";
import { paper } from "@/lib/reader-model";
import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  Minus,
  Plus,
  Monitor,
  SunMedium,
  Moon,
} from "lucide-react";
import type { Annotation } from "@/lib/annotations";
import {
  kinds,
  type OutlineSection,
  type ShowOnPage,
  type Theme,
} from "@/lib/reader-model";
import { exportAnnotations, type ExportFormat } from "@/lib/reader-export";
import { Popover, Segmented } from "./ui";
import { usePreferences } from "./preferences";
export function ViewMenu({
  showOnPage,
  onShowChange,
  onShortcuts,
  onClose,
  studyZoom,
}: {
  studyZoom?: {
    percent: number;
    onChange: (percent: number) => void;
    overflowing: boolean;
  };
  showOnPage: ShowOnPage;
  onShowChange: (show: ShowOnPage) => void;
  onShortcuts: () => void;
  onClose: () => void;
}) {
  const preferences = usePreferences();
  return (
    <Popover label="View settings" onClose={onClose} className="view-menu">
      <h2 className="eyebrow">Theme</h2>
      <Segmented<Theme>
        label="Theme"
        value={preferences.theme}
        onChange={preferences.setTheme}
        options={(["auto", "light", "dark"] as const).map((value) => ({
          value,
          label: (
            <>
              {value === "auto" ? (
                <Monitor size={14} aria-hidden="true" />
              ) : value === "light" ? (
                <SunMedium size={14} aria-hidden="true" />
              ) : (
                <Moon size={14} aria-hidden="true" />
              )}
              {value[0].toUpperCase() + value.slice(1)}
            </>
          ),
        }))}
      />
      <p className="helper">Auto follows your system setting</p>
      <hr />
      <h2 className="eyebrow">Reading</h2>
      {studyZoom && (
        <>
          <div className="setting-row">
            <span>Study zoom</span>
            <div
              className="stepper study-zoom-stepper"
              role="group"
              aria-label="Study zoom"
            >
              <button
                type="button"
                aria-label="Zoom out study"
                disabled={studyZoom.percent <= MIN_STUDY_ZOOM}
                onClick={() =>
                  studyZoom.onChange(studyZoom.percent - STUDY_ZOOM_STEP)
                }
              >
                <Minus size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="zoom-reset"
                aria-label="Reset study zoom to fit"
                title="Reset to fit"
                onClick={() => studyZoom.onChange(100)}
              >
                {studyZoom.percent}%
              </button>
              <button
                type="button"
                aria-label="Zoom in study"
                disabled={studyZoom.percent >= MAX_STUDY_ZOOM}
                onClick={() =>
                  studyZoom.onChange(studyZoom.percent + STUDY_ZOOM_STEP)
                }
              >
                <Plus size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
          <p className="helper zoom-helper">
            {studyZoom.overflowing
              ? "Scroll horizontally to explore the enlarged page."
              : "Select the percentage to return to the default fit."}
          </p>
        </>
      )}
      <p className="setting-label">Show on page</p>
      <div className="marker-chips">
        {kinds.map((kind) => (
          <button
            key={kind}
            className={`chip ${showOnPage[kind] ? "on" : ""}`}
            aria-pressed={showOnPage[kind]}
            onClick={() =>
              onShowChange({ ...showOnPage, [kind]: !showOnPage[kind] })
            }
          >
            <i className={`signal ${kind}`} />
            {kind === "highlight"
              ? "Highlights"
              : kind === "note"
                ? "Notes"
                : "Questions"}
          </button>
        ))}
      </div>
      <hr />
      <button className="shortcuts-link" onClick={onShortcuts}>
        Keyboard shortcuts <kbd>?</kbd>
      </button>
    </Popover>
  );
}
export async function copyExport(
  text: string,
  onToast: (message: string) => void,
  count: number,
) {
  try {
    await navigator.clipboard.writeText(text);
    onToast(`Copied ${count} annotations`);
  } catch {
    onToast("Clipboard unavailable. Use Download to save your annotations.");
  }
}
export function ExportMenu({
  study = paper,
  annotations,
  sections,
  labels,
  onClose,
  onToast,
}: {
  study?: Study;
  annotations: Annotation[];
  sections: OutlineSection[];
  labels: string[] | null;
  onClose: () => void;
  onToast: (message: string) => void;
}) {
  const [format, setFormat] = useState<ExportFormat>("md");
  const [quotes, setQuotes] = useState(true);
  const content = () =>
    exportAnnotations(
      annotations,
      format,
      quotes,
      sections,
      labels,
      new Date(),
      study,
    );
  function download() {
    const blob = new Blob([content()], {
      type:
        format === "json"
          ? "application/json"
          : format === "csv"
            ? "text/csv;charset=utf-8"
            : "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${study.id === paper.id ? "neptune-odyssey" : study.fileName.replace(/\.pdf$/i, "")}-annotations.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onToast(`Downloaded ${annotations.length} annotations`);
  }
  return (
    <Popover
      label="Export annotations"
      className="export-menu"
      onClose={onClose}
    >
      <h2>Export annotations</h2>
      <p className="helper">
        {annotations.length} annotations · with sections and pages
      </p>
      <hr />
      <div
        className="export-formats"
        role="radiogroup"
        aria-label="Export format"
      >
        {(
          [
            ["md", "Markdown", "notes apps, Obsidian"],
            ["json", "JSON", "scripts and other tools"],
            ["csv", "CSV", "spreadsheets"],
          ] as const
        ).map(([value, label, help]) => (
          <button
            key={value}
            role="radio"
            aria-checked={format === value}
            onClick={() => setFormat(value)}
            className={format === value ? "selected" : ""}
          >
            <span>
              <strong>{label}</strong>
              <small>
                .{value} · {help}
              </small>
            </span>
            {format === value && (
              <span className="check-circle">
                <Check size={11} />
              </span>
            )}
          </button>
        ))}
      </div>
      <hr />
      <label className="setting-row quote-toggle">
        Include quoted passages
        <input
          type="checkbox"
          checked={quotes}
          onChange={(e) => setQuotes(e.target.checked)}
        />
        <span className="switch" aria-hidden="true" />
      </label>
      <div className="export-actions">
        <button
          className="pill subtle"
          onClick={() =>
            void copyExport(content(), onToast, annotations.length)
          }
        >
          <Copy size={13} />
          Copy
        </button>
        <button className="pill primary" onClick={download}>
          <Download size={13} />
          Download .{format}
        </button>
      </div>
    </Popover>
  );
}
