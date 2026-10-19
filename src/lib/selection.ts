import type { Anchor, Rect } from "./annotations";
// PDF text layers expose both span and text-node rectangles. Merge their
// overlapping fragments into one rectangle per visual line.
export function mergeRects(rects: Rect[]): Rect[] {
  const lines: Rect[] = [];
  for (const rect of [...rects].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const match = lines.find(
      (r) =>
        Math.min(r.y + r.height, rect.y + rect.height) - Math.max(r.y, rect.y) >
          Math.min(r.height, rect.height) * 0.7 &&
        rect.x <= r.x + r.width + 0.012 &&
        rect.x + rect.width >= r.x - 0.012,
    );
    if (match) {
      const right = Math.max(match.x + match.width, rect.x + rect.width);
      const bottom = Math.max(match.y + match.height, rect.y + rect.height);
      match.x = Math.min(match.x, rect.x);
      match.y = Math.min(match.y, rect.y);
      match.width = right - match.x;
      match.height = bottom - match.y;
    } else lines.push({ ...rect });
  }
  return lines;
}
export function captureSelection(
  container: HTMLElement,
  page: number,
): (Anchor & { left: number; top: number }) | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0)
    return null;
  const range = selection.getRangeAt(0);
  if (
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  )
    return null;
  const quote = selection.toString().replace(/\s+/g, " ").trim();
  if (!quote) return null;
  const bounds = container.getBoundingClientRect();
  const rects: Rect[] = [];
  for (const r of Array.from(range.getClientRects())) {
    if (r.width < 1 || r.height < 1) continue;
    const x = Math.max(0, (r.left - bounds.left) / bounds.width),
      y = Math.max(0, (r.top - bounds.top) / bounds.height);
    const rect = {
      x,
      y,
      width: Math.min(r.width / bounds.width, 1 - x),
      height: Math.min(r.height / bounds.height, 1 - y),
    };
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      !rects.some(
        (p) =>
          Math.abs(p.x - x) < 0.001 &&
          Math.abs(p.y - y) < 0.001 &&
          Math.abs(p.width - rect.width) < 0.001,
      )
    )
      rects.push(rect);
  }
  if (!rects.length) return null;
  const first = range.getBoundingClientRect();
  return {
    page,
    quote,
    rects: mergeRects(rects),
    left: Math.max(
      16,
      Math.min(window.innerWidth - 310, first.left + first.width / 2 - 145),
    ),
    top: Math.max(76, Math.min(window.innerHeight - 100, first.top - 52)),
  };
}
