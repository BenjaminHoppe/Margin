import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clampStudyZoom, readerPageLayout } from "../src/lib/reader-zoom";
import { ViewMenu } from "../src/components/production/menus";
import { PreferencesProvider } from "../src/components/production/preferences";

test("study zoom rejects invalid preferences and respects useful bounds", () => {
  assert.equal(clampStudyZoom(NaN), 100);
  assert.equal(clampStudyZoom(Infinity), 100);
  assert.equal(clampStudyZoom(25), 75);
  assert.equal(clampStudyZoom(300), 200);
  assert.equal(clampStudyZoom(125), 125);
});

test("zoomed pages reserve complete annotation cards and remain horizontally reachable", () => {
  for (const screen of [1100, 1280, 1440, 1920]) {
    for (const percent of [75, 100, 125, 150, 175, 200]) {
      for (const contents of [false, true]) {
        const layout = readerPageLayout(screen, percent, {
          margin: true,
          list: false,
          contents,
          focus: false,
        });
        assert.ok(
          Math.abs(layout.width - (layout.baseWidth * percent) / 100) <= 0.5,
        );
        assert.ok(layout.left >= 96);
        // A 40px connector, 300px card and 24px breathing room all fit.
        assert.ok(
          layout.contentWidth >= layout.left + layout.width + 40 + 300 + 24,
        );
        assert.ok(layout.contentWidth >= screen);
        const list = readerPageLayout(screen, percent, {
          margin: false,
          list: true,
          contents,
          focus: false,
        });
        assert.equal(list.panelInset, 344);
        assert.ok(list.contentWidth >= list.left + list.width + 24);
        assert.ok(list.contentWidth >= screen - list.panelInset);
      }
    }
  }
  const defaultLayout = readerPageLayout(1440, 100, {
    margin: true,
    list: false,
    contents: false,
    focus: false,
  });
  assert.equal(defaultLayout.left + defaultLayout.width / 2, 720);
});

test("View settings expose study zoom only in a reader and retain labeled theme controls", () => {
  const noop = () => {};
  const props = {
    showOnPage: {
      highlight: true,
      note: true,
      question: true,
      understanding: false,
    },
    onShowChange: noop,
    onShortcuts: noop,
    onClose: noop,
  };
  const render = (zoom?: {
    percent: number;
    onChange: (percent: number) => void;
    overflowing: boolean;
  }) =>
    renderToStaticMarkup(
      createElement(
        PreferencesProvider,
        null,
        createElement(ViewMenu, { ...props, studyZoom: zoom }),
      ),
    );
  const library = render();
  assert.doesNotMatch(
    library,
    /Note text|Smaller note|Larger note|Study zoom|Zoom in study/,
  );
  for (const label of ["Auto", "Light", "Dark"])
    assert.ok(library.includes(label));
  assert.match(library, /lucide-monitor/);
  assert.match(library, /role="radio" aria-checked="true"/);
  const reader = render({ percent: 125, onChange: noop, overflowing: false });
  assert.match(reader, /Study zoom/);
  assert.match(reader, /125%/);
  assert.match(reader, /Reset study zoom to fit/);
  assert.doesNotMatch(reader, /Note text/);
  assert.match(
    render({ percent: 200, onChange: noop, overflowing: true }),
    /aria-label="Zoom in study" disabled=""/,
  );
  assert.match(
    render({ percent: 75, onChange: noop, overflowing: false }),
    /aria-label="Zoom out study" disabled=""/,
  );
});
