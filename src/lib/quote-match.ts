import type { Rect } from "./annotations";
import { mergeRects } from "./selection";
export type QuoteTextItem = {
  str: string;
  width: number;
  height: number;
  transform: number[];
  hasEOL?: boolean;
};
export function normalizedQuote(text: string) {
  return text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[^a-z]/g, "");
}
// Keep a character-to-item map so typography/line-break normalization does
// not detach the matched passage from its PDF coordinates.
export function locateQuote(
  items: QuoteTextItem[],
  quote: string,
  pageWidth: number,
  pageHeight: number,
): Rect[] {
  const characters: { item: number; offset: number }[] = [];
  let text = "";
  items.forEach((item, index) => {
    for (let offset = 0; offset < item.str.length; offset++) {
      const normalized = normalizedQuote(item.str[offset]);
      for (const char of normalized) {
        text += char;
        characters.push({ item: index, offset });
      }
    }
  });
  const needle = normalizedQuote(quote);
  const start = text.indexOf(needle);
  if (start < 0 || !needle) return [];
  const ranges = new Map<number, { start: number; end: number }>();
  characters.slice(start, start + needle.length).forEach(({ item, offset }) => {
    const old = ranges.get(item);
    ranges.set(item, {
      start: Math.min(old?.start ?? offset, offset),
      end: Math.max(old?.end ?? offset + 1, offset + 1),
    });
  });
  const rects: Rect[] = [];
  for (const [index, range] of ranges) {
    const item = items[index];
    const height = Math.max(
      item.height,
      Math.hypot(item.transform[2], item.transform[3]),
    );
    const x =
      (item.transform[4] +
        (item.width * range.start) / Math.max(1, item.str.length)) /
      pageWidth;
    const y = (pageHeight - item.transform[5] - height * 0.85) / pageHeight;
    const width =
      (item.width * (range.end - range.start)) /
      Math.max(1, item.str.length) /
      pageWidth;
    if (x >= 0 && y >= 0 && width > 0)
      rects.push({
        x,
        y,
        width: Math.min(width, 1 - x),
        height: Math.min(height / pageHeight, 1 - y),
      });
  }
  return mergeRects(rects);
}
