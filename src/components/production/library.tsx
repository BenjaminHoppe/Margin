"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowUpRight,
  Highlighter,
  MessageCircle,
  Search,
  SlidersHorizontal,
  StickyNote,
  Upload,
  X,
} from "lucide-react";
import {
  initialReaderState,
  readReaderState,
  type ReaderState,
} from "@/lib/reader-model";
import { studies } from "@/lib/catalog";
import { ViewMenu } from "./menus";
import { Presence, Shortcuts } from "./ui";
import styles from "./library.module.css";
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
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  function clearSearch() {
    setQuery("");
    searchInput.current?.focus();
  }
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
  const filtered = studies.filter((study) =>
    `${study.title} ${study.shortTitle} ${study.subtitle}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <div
      className={styles.page}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => event.preventDefault()}
    >
      <header className={styles.header}>
        <span className="wordmark">Margin</span>
        <div className={styles.headerActions}>
          <button
            className={`pill ${styles.upload}`}
            disabled
            title="PDF uploads are coming later"
          >
            <Upload size={14} /> Upload PDF <span>Soon</span>
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
      <main className={styles.main}>
        <div className={styles.heading}>
          <div className={styles.title}>
            <h1>Library</h1>
          </div>
          <div className={styles.search}>
            <Search size={15} aria-hidden="true" />
            <input
              ref={searchInput}
              aria-label="Search papers"
              placeholder="Search papers…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query && (
              <button aria-label="Clear search" onClick={clearSearch}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className={styles.collectionLabel}>
          <span>{query.trim() ? "Search results" : "All papers"}</span>
          <span role="status">
            {filtered.length} {filtered.length === 1 ? "paper" : "papers"}
          </span>
        </div>
        <div className={styles.grid}>
          {filtered.map((study) => {
            const state = library[study.id];
            const progress = Math.min(
              100,
              Math.max(
                0,
                Math.round(
                  ((state.position.page - 1 + state.position.fraction) /
                    study.pageCount) *
                    100,
                ),
              ),
            );
            const counts = {
              highlight: state.annotations.filter((a) => a.kind === "highlight")
                .length,
              note: state.annotations.filter((a) => a.kind === "note").length,
              question: state.annotations.filter(
                (a) => a.kind === "question" && !a.resolved,
              ).length,
            };
            return (
              <Link
                className={styles.card}
                href={`/read/${study.slug}`}
                key={study.id}
              >
                <div className={styles.preview} aria-hidden="true">
                  <Thumbnail url={study.url} title={study.shortTitle} />
                  <span className={styles.pageCount}>
                    {study.pageCount} {study.pageCount === 1 ? "page" : "pages"}
                  </span>
                  {initialReaderState(study).annotations.length > 0 && (
                    <span className={styles.sample}>Sample notes</span>
                  )}
                </div>
                <div className={styles.content}>
                  <h2 title={study.title}>{study.shortTitle}</h2>
                  <p className={styles.metadata}>{study.subtitle}</p>
                  <div className={styles.activity}>
                    {state.annotations.length ? (
                      <div className={styles.signals}>
                        <span
                          title={`${counts.highlight} highlight${counts.highlight === 1 ? "" : "s"}`}
                          aria-label={`${counts.highlight} highlight${counts.highlight === 1 ? "" : "s"}`}
                        >
                          <Highlighter
                            size={12}
                            className={styles.highlight}
                            aria-hidden="true"
                          />
                          {counts.highlight}
                        </span>
                        <span
                          title={`${counts.note} note${counts.note === 1 ? "" : "s"}`}
                          aria-label={`${counts.note} note${counts.note === 1 ? "" : "s"}`}
                        >
                          <StickyNote
                            size={12}
                            className={styles.note}
                            aria-hidden="true"
                          />
                          {counts.note}
                        </span>
                        <span
                          title={`${counts.question} open question${counts.question === 1 ? "" : "s"}`}
                          aria-label={`${counts.question} open question${counts.question === 1 ? "" : "s"}`}
                        >
                          <MessageCircle
                            size={12}
                            className={styles.question}
                            aria-hidden="true"
                          />
                          {counts.question}
                        </span>
                      </div>
                    ) : (
                      <span>No annotations yet</span>
                    )}
                  </div>
                  <div className={styles.footer}>
                    <div className={styles.reading}>
                      <span>
                        {progress === 100
                          ? "Finished"
                          : progress
                            ? `${progress}% read`
                            : "Not started"}
                      </span>
                      <div className={styles.progress} aria-hidden="true">
                        <i style={{ width: `${progress}%` }} />
                      </div>
                    </div>
                    <span className={styles.open} aria-hidden="true">
                      <ArrowUpRight size={16} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        {filtered.length === 0 && (
          <div className={styles.empty}>
            <Search size={22} aria-hidden="true" />
            <h2>No papers found</h2>
            <p>Try another title, author, or year.</p>
            <button className="pill" onClick={clearSearch}>
              Clear search
            </button>
          </div>
        )}
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
    </div>
  );
}
