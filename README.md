# Margin

A desktop research-paper reader built from the Margin Production Figma designs. Next.js App Router, strict TypeScript, Tailwind CSS, React-PDF and local browser storage.

## Run locally

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. The Library contains all 11 supplied studies, each with its own `/read/[paperId]` route. Node 20.16+ and pnpm 11.25.0 are required. `pnpm build` and `pnpm start` run the optimized app. The postinstall script copies matching PDF.js worker, CMap, font and WASM assets locally; rendering does not depend on a CDN.

## Reader

The complete 116-page Neptune Odyssey report opens at printed page 8 with sixteen sample annotations on first visit. Nearby pages mount canvases and text layers; all page dimensions reserve space for stable scrolling. The centered PDF keeps its position across Margin, List, Hidden, contents and Focus modes.

Select PDF text to highlight, write a note, ask a question or mark understanding. Selecting text opens an unsaved card beside the passage, even in Hidden or List mode. Empty text saves as a yellow highlight; typing infers Note or Question (ending in `?`) until you explicitly choose a type. The card starts with keyboard focus: left/right changes type, up/down changes optional understanding, and typing enters the text field. Inside the field, arrows edit text; Escape returns to controls, then Escape cancels. ⌘/Ctrl+Enter saves. Cards use straight connectors unless collision avoidance displaces them. Each margin card’s three-dot button opens a floating Edit/Delete menu without resizing the card. Edit reopens the inline composer; Delete asks for confirmation in the same anchored popup. Cancelling an edit preserves the original annotation. Added annotations and drafts are session-only: reload restores the original sample annotations (or an empty paper outside Neptune). Display settings and reading position persist per paper. Export Markdown, JSON or CSV, with optional quotes and printed page labels.

The map supports clicking, dragging, scrolling and keyboard navigation. The contents sidebar uses the PDF outline. View controls theme, note size and signals. Focus temporarily hides chrome and restores the previous layout on exit. The shortcuts sheet lists all supported keys.

## Assets

Controls and body UI use the supplied 00 Hypertext family through `next/font/local`; the wordmark, reader title, and large chapter headings use the locally supplied Wagram font. Small sidebar rows retain Hypertext. Wagram is excluded from version control; provide the licensed font file locally before building. The 25 supplied font files live in `src/app/fonts`; only six used faces load. See that directory's README for the non-commercial license notice. The full supplied PDF is `public/papers/neptune-odyssey.pdf`. These files are present and eligible for version control; no commits were made.

## Checks

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Tests cover geometry, persistence and migration, corrupted data, section boundaries, exports, and locating all sixteen seed quotes in the real PDF. See `NOTES.md` for implementation choices, browser validation and remaining release steps.

## Study collection

Neptune, Mars, Pluto, Sedna, Ceres, Proxima Centauri, Io, two Voyager interstellar studies, Uranus and white dwarfs are bundled locally. Only Neptune receives demo notes. Reading position and exports stay associated with each individual paper. The sixteen-item demo includes four layout samples in Triton’s comparative-planetology section. Reload restores these sample cards, discarding session additions and edits.
