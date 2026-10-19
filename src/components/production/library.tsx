"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { SlidersHorizontal, Upload } from "lucide-react";
import {
  initialReaderState,
  readReaderState,
  type ReaderState,
} from "@/lib/reader-model";
import { studies } from "@/lib/catalog";
import { ViewMenu } from "./menus";
import { Presence, Shortcuts, Toast } from "./ui";
const Thumbnail = dynamic(() => import("./thumbnail"), {
  ssr: false,
  loading: () => (
    <span className="thumbnail-placeholder">Loading preview…</span>
  ),
});
export default function Library() {
  const [saved, setSaved] = useState<ReaderState>(initialReaderState);
  const [library, setLibrary] = useState<Record<string, ReaderState>>(() =>
    Object.fromEntries(
      studies.map((study) => [study.id, initialReaderState(study)]),
    ),
  );
  const [view, setView] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [toast, setToast] = useState("");
  useEffect(() => {
    setSaved(readReaderState(localStorage).state);
    setLibrary(
      Object.fromEntries(
        studies.map((study) => [
          study.id,
          readReaderState(localStorage, study).state,
        ]),
      ),
    );
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  const stub = () => setToast("Uploads aren’t available in this demo yet");
  return (
    <div className="library">
      <header className="library-header">
        <span className="wordmark">Margin</span>
        <div>
          <button className="pill primary" title="Coming soon" onClick={stub}>
            <Upload size={15} />
            Upload PDF
          </button>
          <button
            className="icon-button"
            aria-label="View settings"
            data-menu-trigger
            aria-expanded={view}
            aria-haspopup="dialog"
            onClick={() => setView(!view)}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>
      </header>
      <main>
        <h1>Library</h1>
        <p className="library-subtitle">
          {studies.length} papers · Your study collection
        </p>
        <button
          className="drop-zone"
          onClick={stub}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            stub();
          }}
        >
          <Upload size={23} />
          <strong>Drop a PDF to add it to your library</strong>
          <span>Upload is coming soon in this demo</span>
        </button>
        <div className="library-grid">
          {studies.map((study) => {
            const state = library[study.id];
            const progress =
              state.position.page === 1 && state.position.fraction === 0
                ? 0
                : Math.round(
                    ((state.position.page - 1 + state.position.fraction) /
                      study.pageCount) *
                      100,
                  );
            const questions = state.annotations.filter(
              (a) => a.kind === "question" && !a.resolved,
            ).length;
            return (
              <Link
                className="paper-card"
                href={`/read/${study.slug}`}
                key={study.id}
              >
                <div className="paper-thumbnail">
                  <Thumbnail url={study.url} title={study.shortTitle} />
                  {study.slug === "neptune-odyssey" && (
                    <span className="sample-tag">Sample notes</span>
                  )}
                </div>
                <div className="paper-card-content">
                  <h2 title={study.title}>{study.title}</h2>
                  <p>
                    {study.subtitle} · {study.pageCount} pages
                  </p>
                  <div className="paper-progress">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                  <span className="read-percentage">
                    {progress ? `${progress}% read` : "Not started"}
                  </span>
                  <p className="paper-stats">
                    {state.annotations.length
                      ? `${state.annotations.length} annotations · ${questions} open questions`
                      : "Ready for your first note"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
      <Presence open={view}>
        <ViewMenu
          showOnPage={saved.showOnPage}
          onShowChange={(showOnPage) =>
            setSaved((old) => ({ ...old, showOnPage }))
          }
          onClose={() => setView(false)}
          onShortcuts={() => {
            setView(false);
            setShortcuts(true);
          }}
        />
      </Presence>
      <Presence open={shortcuts}>
        <Shortcuts onClose={() => setShortcuts(false)} />
      </Presence>
      <Toast message={toast} />
    </div>
  );
}
