/* ==========================================================================
   Posebooth — Phase 4A + 4B renderer smoke tests (Node, no browser needed).
   Run with:  node tests/strip-layout.test.js
   ========================================================================== */

'use strict';

var assert = require('assert');

/* ── Minimal DOM stand-ins ───────────────────────────────────────────── */
function FakeEl(tag) {
  this.tagName = tag;
  this.style = {};
  this.attrs = {};
  this._classes = new Set();
  this.children = [];
  this.events = {};
  var self = this;
  this.classList = {
    toggle: function (cls, force) {
      var on = force === undefined ? !self._classes.has(cls) : !!force;
      if (on) self._classes.add(cls); else self._classes.delete(cls);
      return on;
    }
  };
}
FakeEl.prototype.setAttribute = function (k, v) { this.attrs[k] = v; };
FakeEl.prototype.getAttribute = function (k) { return this.attrs[k]; };
FakeEl.prototype.appendChild = function (c) { this.children.push(c); };
FakeEl.prototype.removeChild = function (c) {
  var i = this.children.indexOf(c);
  if (i !== -1) this.children.splice(i, 1);
};
FakeEl.prototype.addEventListener = function (t, f) { this.events[t] = f; };
FakeEl.prototype.focus = function () {};
// Class selector lookups over the (shallow) fake DOM.
FakeEl.prototype.querySelectorAll = function (sel) {
  var cls = sel.charAt(0) === '.' ? sel.slice(1) : sel;
  var out = [];
  (function walk(node) {
    node.children.forEach(function (c) {
      if (String(c.className || '').split(/\s+/).indexOf(cls) !== -1) out.push(c);
      walk(c);
    });
  })(this);
  return out;
};

global.document = {
  createElement: function (tag) { return new FakeEl(tag); }
};

var Strip = require('../js/strip.js');

/* ── Layout rendering (Phase 4A) ─────────────────────────────────────── */
var photos = ['data:photo1', 'data:photo2', 'data:photo3', 'data:photo4'];
var RATIOS = {
  vertical: '1200 / 3600',
  grid: '3600 / 4800',
  horizontal: '3600 / 1200'
};

['vertical', 'horizontal', 'grid'].forEach(function (layout) {
  var el = new FakeEl('div');
  Strip.renderPreview(el, layout, photos);

  assert.strictEqual(el.attrs['data-layout'], layout, layout + ': layout applied');
  assert.strictEqual(el.style.aspectRatio, RATIOS[layout], layout + ': master canvas ratio applied');
  assert.strictEqual(el.children.length, 4, layout + ': exactly 4 photos');
  assert.deepStrictEqual(
    el.children.map(function (c) { return c.src; }),
    photos,
    layout + ': photos 1..4 in order, none duplicated, none missing'
  );
  assert.ok(
    el.children.every(function (c) { return /^Photo [1-4] of 4$/.test(c.alt); }),
    layout + ': numbered photo alts, no pose guides'
  );
});

var capped = new FakeEl('div');
Strip.renderPreview(capped, 'grid', ['a', 'b', 'c', 'd', 'e']);
assert.strictEqual(capped.children.length, 4, 'caps at 4');

assert.strictEqual(Strip.layoutKey('diagonal'), 'vertical', 'unknown layout -> vertical');
assert.strictEqual(Strip.layoutKey(undefined), 'vertical', 'missing layout -> vertical');
assert.strictEqual(Strip.canvasRatio('diagonal'), '1200 / 3600', 'unknown layout -> vertical canvas');

// Master canvas map: real photobooth print sizes (2×6, 6×8, 6×2 inch —
// horizontal is the vertical print turned on its side).
assert.deepStrictEqual(Strip.canvas, {
  vertical: { width: 1200, height: 3600 },
  grid: { width: 3600, height: 4800 },
  horizontal: { width: 3600, height: 1200 }
}, 'master canvas dimensions');

/* ── Strip color (Phase 4B) ──────────────────────────────────────────── */
assert.strictEqual(Strip.colors.length, 8, '8 curated colors');
assert.strictEqual(Strip.colors[0].hex.toLowerCase(), '#ffffff', 'white is the default first color');

// setColor applies the background inline without touching photos.
var preview = new FakeEl('div');
Strip.setColor(preview, '#f6d9de');
assert.strictEqual(preview.style.backgroundColor, '#f6d9de', 'setColor applies the background');
assert.strictEqual(preview.children.length, 0, 'setColor never touches the photos');

// buildColorSwatches: 8 buttons, default white selected.
var swatches = new FakeEl('div');
var picked = [];
Strip.buildColorSwatches(swatches, function (hex) { picked.push(hex); }, '#ffffff');
assert.strictEqual(swatches.children.length, 8, '8 swatch buttons built');
assert.strictEqual(swatches.children[0].getAttribute('aria-checked'), 'true', 'default white is selected');
assert.strictEqual(
  swatches.children[0].getAttribute('aria-label'), 'Strip color: White',
  'white swatch labelled'
);

// Click the pink swatch (index 3) — selection moves + onPick fires.
picked.length = 0;
var pink = swatches.children[3];
pink.events.click();
assert.strictEqual(pink.getAttribute('aria-checked'), 'true', 'pink selected after click');
assert.strictEqual(swatches.children[0].getAttribute('aria-checked'), 'false', 'white deselected');
assert.deepStrictEqual(picked, ['#f6d9de'], 'onPick receives the picked hex');

// Arrow-key navigation moves selection to the next swatch.
picked.length = 0;
var first = swatches.children[0];
first.events.keydown({ key: 'ArrowRight', preventDefault: function () {} });
assert.strictEqual(swatches.children[1].getAttribute('aria-checked'), 'true', 'arrow-right moves selection forward');
assert.deepStrictEqual(picked, [swatches.children[1].getAttribute('data-hex')], 'keyboard pick fires onPick');

/* ── Strip themes (Phase 4C) ─────────────────────────────────────────── */
assert.strictEqual(Strip.themes.length, 6, '6 curated themes');
assert.strictEqual(Strip.themes[0].key, 'minimal', 'minimal is the default first theme');

// applyTheme stamps data-theme and injects accents only where the theme
// has them (cute/pastel corner dots) — photos and color stay untouched.
var themed = new FakeEl('div');
Strip.setColor(themed, '#f6d9de');
Strip.renderPreview(themed, 'vertical', photos);
Strip.applyTheme(themed, 'cute');
assert.strictEqual(themed.attrs['data-theme'], 'cute', 'applyTheme stamps data-theme');
assert.strictEqual(themed.style.backgroundColor, '#f6d9de', 'theme never touches the color');
assert.strictEqual(
  themed.children.filter(function (c) { return c.tagName === 'img'; }).length,
  4,
  'theme never touches the photos'
);
assert.strictEqual(themed.querySelectorAll('.pd-layer').length, 1, 'cute injects its tiny dot accents');

// Re-applying a theme swaps the decoration instead of piling it up.
Strip.applyTheme(themed, 'retro');
assert.strictEqual(themed.attrs['data-theme'], 'retro', 'theme swaps');
assert.strictEqual(themed.querySelectorAll('.pd-layer').length, 0, 'retro has no injected accents (frame only)');

Strip.applyTheme(themed, 'cute');
Strip.applyTheme(themed, 'cute');
assert.strictEqual(themed.querySelectorAll('.pd-layer').length, 1, 'no duplicate decor layers');

Strip.applyTheme(themed, 'not-a-theme');
assert.strictEqual(themed.attrs['data-theme'], 'minimal', 'unknown theme falls back to minimal');
assert.strictEqual(themed.querySelectorAll('.pd-layer').length, 0, 'minimal has no injected accents');
assert.strictEqual(Strip.themeKey(undefined), 'minimal', 'missing theme -> minimal');

// The default themes are clean starter templates: no wordmarks, no date
// stamps, no stickers — only tiny orientation-neutral corner dots.
function decorKinds(el) {
  var layer = el.querySelectorAll('.pd-layer')[0];
  return layer ? layer.children.map(function (c) { return c.className; }) : [];
}

['cute', 'pastel'].forEach(function (t) {
  var el = new FakeEl('div');
  Strip.applyTheme(el, t);
  var kinds = decorKinds(el);
  assert.strictEqual(kinds.length, 4, t + ' has exactly 4 tiny corner dots');
  assert.ok(
    kinds.every(function (c) { return /pd-dot/.test(c); }),
    t + ' accents are dots only (no stickers, no text)'
  );
});

// The rest are pure frame/border treatments — nothing injected, no text.
['minimal', 'classic', 'y2k', 'retro'].forEach(function (t) {
  var el = new FakeEl('div');
  Strip.applyTheme(el, t);
  assert.strictEqual(el.querySelectorAll('.pd-layer').length, 0, t + ' keeps the strip clean');
});

// buildThemeSwatches: 6 buttons, each with a 4-cell mini demo + label.
var themeSwatches = new FakeEl('div');
var pickedThemes = [];
Strip.buildThemeSwatches(themeSwatches, function (key) { pickedThemes.push(key); }, 'minimal');
assert.strictEqual(themeSwatches.children.length, 6, '6 theme options built');
assert.strictEqual(themeSwatches.children[0].getAttribute('aria-checked'), 'true', 'default minimal is selected');
assert.strictEqual(themeSwatches.children[0].getAttribute('aria-label'), 'Strip theme: Minimal', 'minimal labelled');
assert.strictEqual(
  themeSwatches.children[3].getAttribute('data-theme'), 'y2k',
  'theme order: minimal, classic, cute, y2k, retro, pastel'
);
var demo = themeSwatches.children[3].children[0];
assert.strictEqual(demo.attrs['data-theme'], 'y2k', 'demo preview carries the theme');
assert.strictEqual(
  demo.children.filter(function (c) { return c.tagName === 'i'; }).length,
  4,
  'demo preview shows 4 photo cells'
);
assert.strictEqual(demo.querySelectorAll('.pd-layer').length, 0, 'y2k demo is clean (frame only)');

var cuteDemo = themeSwatches.children[2].children[0];
assert.strictEqual(cuteDemo.querySelectorAll('.pd-layer').length, 1, 'cute demo shows its dot accents');

// Click Y2K — selection moves + onPick fires.
pickedThemes.length = 0;
var y2kBtn = themeSwatches.children[3];
y2kBtn.events.click();
assert.strictEqual(y2kBtn.getAttribute('aria-checked'), 'true', 'y2k selected after click');
assert.strictEqual(themeSwatches.children[0].getAttribute('aria-checked'), 'false', 'minimal deselected');
assert.deepStrictEqual(pickedThemes, ['y2k'], 'onPick receives the picked theme');

// Arrow-key navigation moves theme selection forward.
pickedThemes.length = 0;
themeSwatches.children[0].events.keydown({ key: 'ArrowRight', preventDefault: function () {} });
assert.strictEqual(themeSwatches.children[1].getAttribute('aria-checked'), 'true', 'arrow-right moves theme forward');
assert.deepStrictEqual(pickedThemes, ['classic'], 'keyboard theme pick fires onPick');

// Theme previews adapt to the selected layout (the demos carry data-layout).
['vertical', 'horizontal', 'grid'].forEach(function (layout) {
  var picker = new FakeEl('div');
  Strip.buildThemeSwatches(picker, null, 'minimal', layout);
  assert.strictEqual(
    picker.children[0].children[0].attrs['data-layout'], layout,
    layout + ': theme previews match the selected layout'
  );
});

// Unknown/missing layout falls back to vertical previews.
var noLayout = new FakeEl('div');
Strip.buildThemeSwatches(noLayout, null, 'minimal', 'diagonal');
assert.strictEqual(noLayout.children[0].children[0].attrs['data-layout'], 'vertical', 'unknown layout -> vertical previews');

console.log('strip layout + color + theme tests passed ✓');