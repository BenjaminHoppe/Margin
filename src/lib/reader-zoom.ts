export const MIN_STUDY_ZOOM = 75;
export const MAX_STUDY_ZOOM = 200;
export const STUDY_ZOOM_STEP = 25;

export function clampStudyZoom(value: number) {
  return Number.isFinite(value)
    ? Math.max(MIN_STUDY_ZOOM, Math.min(MAX_STUDY_ZOOM, value))
    : 100;
}

// Keep the existing centered reading layout where it fits. Enlarged pages
// reserve space for cards and can be panned rather than being clipped.
export function readerPageLayout(
  screenWidth: number,
  zoom: number,
  {
    margin,
    list,
    contents,
    focus,
  }: { margin: boolean; list: boolean; contents: boolean; focus: boolean },
) {
  const baseWidth = Math.round(
    Math.max(520, Math.min(760, (screenWidth * 5) / 12)),
  );
  const width = Math.round((baseWidth * clampStudyZoom(zoom)) / 100);
  const panelInset = list ? 344 : 0;
  const viewportWidth = Math.max(1, screenWidth - panelInset);
  const navigationWidth = Math.min(360, (screenWidth - baseWidth) / 2 - 42);
  const leftGutter = focus
    ? 24
    : contents
      ? Math.max(96, navigationWidth + 48)
      : 96;
  const rightGutter = margin ? 364 : 24;
  const left = Math.max(
    leftGutter,
    Math.min((screenWidth - width) / 2, viewportWidth - rightGutter - width),
  );
  const contentWidth = Math.max(viewportWidth, left + width + rightGutter);
  return {
    baseWidth,
    width,
    left,
    contentWidth,
    panelInset,
    overflowing: contentWidth > viewportWidth + 1,
  };
}
