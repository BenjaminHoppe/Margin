# Margin

A desktop research-paper reader built from the Margin Production Figma designs. Next.js App Router, strict TypeScript, Tailwind CSS, React-PDF and local browser storage.

## Run locally

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. The Library contains all 11 supplied studies, each with its own `/read/[paperId]` route. Node 20.16+ and pnpm 11.25.0 are required. `pnpm build` and `pnpm start` run the optimized app. The postinstall script copies matching PDF.js worker, CMap, font and WASM assets locally; rendering does not depend on a CDN.

## Reader

The complete 116-page Neptune Odyssey report opens at printed page 8 with twelve sample annotations on first visit. Nearby pages mount canvases and text layers; all page dimensions reserve space for stable scrolling. The centered PDF keeps its position across Margin, List, Hidden, contents and Focus modes.

Select PDF text to highlight, write a note, ask a question or mark understanding. Notes, passage anchors, drafts, display settings and reading position persist per paper. Existing Neptune notes migrate from the earlier storage key without deleting the originals. Export Markdown, JSON or CSV, with optional quotes and printed page labels.

The map supports clicking, dragging, scrolling and keyboard navigation. The contents sidebar uses the PDF outline. View controls theme, note size and signals. Focus temporarily hides chrome and restores the previous layout on exit. The shortcuts sheet lists all supported keys.

## Assets

All UI typography uses the supplied 00 Hypertext family through `next/font/local`. The 25 supplied font files live in `src/app/fonts`; only six used faces load. See that directory's README for the non-commercial license notice. The full supplied PDF is `public/papers/neptune-odyssey.pdf`. These files are present and eligible for version control; no commits were made.

## Checks

```sh
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

Tests cover geometry, persistence and migration, corrupted data, section boundaries, exports, and locating all twelve seed quotes in the real PDF. See `NOTES.md` for implementation choices, browser validation and remaining release steps.

## Study collection

Neptune, Mars, Pluto, Sedna, Ceres, Proxima Centauri, Io, two Voyager interstellar studies, Uranus and white dwarfs are bundled locally. Only Neptune receives demo notes. Reading position, annotations and exports stay associated with each individual paper. The new twelve-item demo is added once alongside personal notes and drafts already saved in the browser.
