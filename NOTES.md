# Production implementation notes

- Production Figma frames determine visuals; the supplied brief determines behavior. The PDF is 600px wide at 1440px, scales from 520 to 760px on desktop, and remains centered when modes change. The fixed title has a continuous blur/fade into the canvas.
- The real PDF outline and heading destinations determine chapter boundaries and annotation grouping. Appendix A begins at PDF page 49, B at 53 and C at 114. The file has no embedded page labels, so labels use the verified front-matter/main-body/appendix mapping.
- Internal annotation field names remain compatible with the earlier reader. Exports expose the brief's type, pdfPage and understanding values. Existing browser notes and drafts take precedence over demo seeds; fresh browser storage gets sixteen seeds. Corrupted storage is preserved and automatic writes are blocked until recovery.
- The original reader and legacy document modules remain isolated for preservation. New routes use components/production. The old Mars PDF and old font assets are unused by the new routes.
- Intentional stubs: upload/drop, annotation more menu, Go to page, Search and Undo. Each renders safely with feedback. No backend, login or cloud sync.
- Browser checks used a separate production origin on port 3001, preserving the user's localhost:3000 notes. Verified first-run seeds, actual text selection, composer save and reload persistence, Margin/List/Hidden, question filtering, contents, Focus restoration, theme controls, shortcut sheet, Markdown download, export format selection, and centered sizing at 1280/1440/1920 plus a 390px fallback. No browser console errors were observed during this pass. Only nearby PDF canvases mounted.
- Unit/integration checks, lint, strict TypeScript and optimized build pass. Lighthouse was not run; no performance score is claimed. The in-app browser's full-page screenshot path does not reliably capture PDF canvases, so screenshots alone are insufficient for PDF verification.
- No commit, push, remote, PR or deployment was created. Those standing instructions take precedence over the attached brief's commit/deploy milestones. Before submission: approve the final visual design, publish the chosen build, verify the public URL in a clean browser, and include the project write-up.

## React-PDF cancellation patch

`patches/react-pdf@10.2.0.patch` is applied automatically by pnpm. React-PDF 10.2.0 reports PDF.js text-layer task cancellation as a warning even when its own effect cleanup cancelled the task. The patch skips only the exact `AbortException: TextLayer task cancelled.` after that cleanup, and prevents stale successful tasks from updating the detached layer. All other failures still reach the original warning and error callback. Recheck this patch when upgrading React-PDF.

## Study library and sample content

The library now contains all 11 supplied Desktop studies, served locally from public/papers. All studies use the Production reader with independent storage, actual page counts, PDF outlines when available, and matching export metadata. Unlabelled documents use physical page numbers; Neptune retains its verified printed labels. Other studies begin empty unless their own legacy annotations exist. Neptune demo revision 3 supplies twelve sample annotations (five notes, four questions, three highlights) anchored to real passages. Older demo seeds are refreshed once; personal annotations and drafts are retained. No external upload or deployment was performed.

## Sidebar polish after voice review

The rail reserves a minimum of 28px per chapter (24px on short windows), with larger labels and contained markers. A single measured position ring travels across chapter boundaries and stays inset at the ends; dragging can cross chapter boundaries. The contents panel caps at 360px, reserves room for page numbers, wraps titles, and animates tree expansion/collapse with inert hidden rows. The compact rail disappears during expansion and waits for the contents exit before returning. Both ends of the contents scroller use an 8px fade. The brown dark-mode flyout has an integrated bordered pointer and a continuous scrollable chapter list, initially positioned at the hovered chapter. Demo revision 3 distributes twelve verified passages across front matter, science, engineering, schedule, cost, and appendices; personal notes and drafts remain intact. Circle-marker click behavior is intentionally deferred for the user's next review.

## Second sidebar review

The flyout is chapter-scoped again: continuous browsing across all chapters was not the intended behavior. Rail dragging still crosses chapter boundaries. Hover backgrounds extend 3px above/below the segments. The rail ring follows the same progress coordinate as the fill, clamped only at endpoints, without an extra lagging transition. Rail pointer jitter under 4px no longer cancels a smooth click jump. Stable, inert navigation layers now sequence their fades without remounting, delayed appearance hacks, or shifting the panel origin. The expanded view uses its filled active spine instead of another outlined ring. Flyout active styling uses a rounded inset edge, and row markers/page labels align vertically. The supplied Wagram face supplies the serif wordmark, paper title, and large flyout chapter headings; small sidebar rows and controls retain Hypertext. The Wagram file remains excluded from version control. Appendices is larger and aligned with top-level title text. No screenshots were captured during this pass, following the user's voice instruction.

## Sidebar annotation marker previews

Expanded-sidebar annotation markers show the same complete cards as Margin view, using a read-only variant of the shared AnnotationCard component. Multiple matching cards stack in a scrollable hover panel outside the masked sidebar. The pointer can move onto the preview to read it. Scrolling the document, resizing, Escape, or leaving the marker and preview dismisses it. Marker clicks do not navigate or change annotation visibility. Click-to-reveal behavior remains a future consideration.

## Triton layout samples

Demo revision 4 adds four verified annotations to “Triton as a Kuiper Belt Dwarf Planet”: one note, two questions, and one highlight. Revision 3 migration appends these once without replacing existing annotations, edited demo entries, deleted older seeds, or drafts. Sidebar signal grouping uses heading positions and subtree bounds, so adjacent sections on the same page do not share unrelated markers. Signals remain grouped by type; multiple matching cards stack in the hover preview.

## Annotation summary hover panel

Parent rows retain annotation summaries in both expanded and collapsed states, keeping markers and title wrapping stable. Hover previews now share a bordered, padded surface, capped by the available viewport height with 24px clearance at the bottom. The card stack scrolls internally, contains overscroll, and remains hover-only.

## Preview card interaction

Single hover cards have no extra outer surface; multiple cards share the scrollable container. The originating marker stays highlighted throughout marker/preview hover. Preview cards use a dedicated sidebar-opening action: select the annotation and scroll directly to its passage while preserving the annotation display mode, including Hidden. The sidebar destination is held active during the jump so it does not flash through ancestor sections. Card clicks do not toggle section rows. Paper scrolling does not dismiss the preview; scrolling its source sidebar does. Marker clicks themselves remain hover-only.

## Collapsed minimap parity pass

The compact rail uses 13px medium labels, 4px rounded tracks, 8px chapter gaps, and a centered 16×20px position indicator. Active, read, and unread colors follow the expanded sidebar; the selected chapter remains stable during navigation while the position indicator continues to track actual scrolling.

Chapter flyouts retain Wagram for their large title, with 13px medium full-wrap rows, 12px page labels, 8px nesting, 4px row gaps, and 12px container padding. Same-page heading positions determine completed rows. Flyouts grow within the viewport with 24px bottom clearance; the integrated pointer stays clear of rounded corners. Appendix headers identify themselves as appendices.

Flyout annotation markers reuse the expanded view’s ordered, clickable previews, single-card and multi-card surfaces, persistent source hover, and Hidden-mode preservation. Moving into a preview keeps the chapter flyout open. Row clicks navigate without immediately dismissing the flyout. Browser inspection remains with the user; TypeScript, lint, and the 27-test regression suite were checked locally.

## Minimap handle and track insets

The position handle is now a directly draggable, keyboard-operable slider with grab/grabbing feedback, a larger invisible hit area, and pickup-offset preservation. Arrow keys move one page, Page Up/Down five, and Home/End reach the document ends. Chapter tracks and their annotation marker lanes have 8px top/bottom insets; minimum chapter height is 36px so the contained 20px handle fits. Short windows use 4px insets and 28px minimum segments. The source track determines scrubbing coordinates.

## Minimap scaling

The compact rail now allocates chapter heights proportionally to PDF page counts using a zero flex basis, with the existing minimum height as a readability floor. It no longer adds the same fixed height before distributing proportional space. The expanded sidebar remains content-height driven. The draggable position handle is currently hidden at the user’s preference; tracks and click/drag navigation remain.

## Shared chapter flyout motion

The chapter flyout keeps a single outer shell while switching chapters. Natural chapter content determines its measured, viewport-bounded height; the shell and integrated pointer transition their position and height together, while chapter content fades in briefly. The inner scroll resets for each newly hovered chapter. A ResizeObserver watches natural content rather than the animated shell, avoiding per-frame measurement loops. Reduced-motion preferences disable these effects.

## Floating chapter panel

The triangular pointer and experimental SVG border were removed at the user’s request. Flyouts retain their existing color values and use the original CSS surface, border, and rounded corners. The single floating shell still animates its position and content-driven height; the originating rail highlight indicates its section.
