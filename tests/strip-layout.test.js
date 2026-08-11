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

// applyTheme stamps data-theme and injects the decorative layer — photos
// and color stay untouched.
var themed = new FakeEl('div');
Strip.setColor(themed, '#f6d9de');
Strip.renderPreview(themed, 'vertical', photos);
Strip.applyTheme(themed, 'y2k');
assert.strictEqual(themed.attrs['data-theme'], 'y2k', 'applyTheme stamps data-theme');
assert.strictEqual(themed.style.backgroundColor, '#f6d9de', 'theme never touches the color');
assert.strictEqual(
  themed.children.filter(function (c) { return c.tagName === 'img'; }).length,
  4,
  'theme never touches the photos'
);
assert.strictEqual(themed.querySelectorAll('.pd-layer').length, 1, 'decor layer injected');

// Re-applying a theme swaps the decoration instead of piling it up.
Strip.applyTheme(themed, 'cute');
assert.strictEqual(themed.attrs['data-theme'], 'cute', 'theme swaps');
assert.strictEqual(themed.querySelectorAll('.pd-layer').length, 1, 'no duplicate decor layers');

Strip.applyTheme(themed, 'not-a-theme');
assert.strictEqual(themed.attrs['data-theme'], 'minimal', 'unknown theme falls back to minimal');
assert.strictEqual(Strip.themeKey(undefined), 'minimal', 'missing theme -> minimal');

// Each theme brings its own decorative shapes (its visual identity).
function decorKinds(el) {
  var layer = el.querySelectorAll('.pd-layer')[0];
  return layer ? layer.children.map(function (c) { return c.className; }) : [];
}

var minimal = new FakeEl('div');
Strip.applyTheme(minimal, 'minimal');
var mKinds = decorKinds(minimal);
assert.ok(mKinds.some(function (c) { return /pd-wordmark/.test(c); }), 'minimal has a wordmark');
assert.ok(mKinds.some(function (c) { return /pd-dot/.test(c); }), 'minimal has corner dots');

var cute = new FakeEl('div');
Strip.applyTheme(cute, 'cute');
assert.ok(decorKinds(cute).some(function (c) { return /pd-heart/.test(c); }), 'cute has hearts');

var classic = new FakeEl('div');
Strip.applyTheme(classic, 'classic');
assert.strictEqual(
  classic.querySelectorAll('.pd-layer')[0].children[0].textContent,
  'POSEBOOTH',
  'classic wordmark copy'
);

var retro = new FakeEl('div');
Strip.applyTheme(retro, 'retro');
var retroStamps = retro.querySelectorAll('.pd-layer')[0].children.filter(function (c) {
  return /pd-stamp/.test(c.className);
});
assert.strictEqual(retroStamps.length, 1, 'retro has a date stamp');
assert.ok(
  /[A-Z]{3} \d{2} '\d{2}/.test(retroStamps[0].textContent),
  'stamp prints a film-lab date (e.g. AUG 11 \'26)'
);

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
assert.strictEqual(demo.querySelectorAll('.pd-layer').length, 1, 'demo preview shows the theme decoration');

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