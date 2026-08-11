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
  this.style.setProperty = function (k, v) { this[k] = v; };
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

// Photos render inside .photo-cell clip wrappers — one cell per photo,
// sized exactly to the photo. The cell's overflow:hidden is what keeps
// effects (grain/glow) inside the photo rectangle.
function photoCells(el) {
  return el.children.filter(function (c) {
    return String(c.className || '').split(/\s+/).indexOf('photo-cell') !== -1;
  });
}
function photoImgs(el) {
  return photoCells(el).map(function (c) { return c.children[0]; });
}

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
  assert.strictEqual(photoCells(el).length, 4, layout + ': exactly 4 photos in clip cells');
  assert.ok(
    photoCells(el).every(function (c) {
      return c.children.length === 1 && c.children[0].tagName === 'img';
    }),
    layout + ': each photo-cell wraps exactly one img'
  );
  assert.deepStrictEqual(
    photoImgs(el).map(function (c) { return c.src; }),
    photos,
    layout + ': photos 1..4 in order, none duplicated, none missing'
  );
  assert.ok(
    photoImgs(el).every(function (c) { return /^Photo [1-4] of 4$/.test(c.alt); }),
    layout + ': numbered photo alts, no pose guides'
  );
});

var capped = new FakeEl('div');
Strip.renderPreview(capped, 'grid', ['a', 'b', 'c', 'd', 'e']);
assert.strictEqual(photoCells(capped).length, 4, 'caps at 4');

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
assert.strictEqual(Strip.colors.length, 13, '13 curated colors');
assert.strictEqual(Strip.colors[0].hex.toLowerCase(), '#ffffff', 'white is the default first color');

// Every palette color is unique — no near-duplicate pinks, blues or
// grays — and the palette spans soft, bold and dark ranges.
var hexes = Strip.colors.map(function (c) { return c.hex.toLowerCase(); });
assert.strictEqual(new Set(hexes).size, 13, 'all 13 colors are visually distinct (unique hexes)');
assert.ok(
  Strip.colors.some(function (c) { return c.name === 'Black' || c.name === 'Charcoal'; }),
  'palette includes dark colors'
);
assert.ok(
  Strip.colors.some(function (c) { return c.name === 'Coral' || c.name === 'Cobalt' || c.name === 'Red'; }),
  'palette includes bold colors'
);

// setColor applies the background inline without touching photos.
var preview = new FakeEl('div');
Strip.setColor(preview, '#f7cdd4');
assert.strictEqual(preview.style.backgroundColor, '#f7cdd4', 'setColor applies the background');
assert.strictEqual(preview.children.length, 0, 'setColor never touches the photos');

// buildColorSwatches: 13 buttons, default white selected.
var swatches = new FakeEl('div');
var picked = [];
Strip.buildColorSwatches(swatches, function (hex) { picked.push(hex); }, '#ffffff');
assert.strictEqual(swatches.children.length, 13, '13 swatch buttons built');
assert.strictEqual(swatches.children[0].getAttribute('aria-checked'), 'true', 'default white is selected');
assert.strictEqual(
  swatches.children[0].getAttribute('aria-label'), 'Strip color: White',
  'white swatch labelled'
);

// Click the Blush swatch (index 2) — selection moves + onPick fires.
picked.length = 0;
var blush = swatches.children[2];
blush.events.click();
assert.strictEqual(blush.getAttribute('aria-checked'), 'true', 'blush selected after click');
assert.strictEqual(swatches.children[0].getAttribute('aria-checked'), 'false', 'white deselected');
assert.deepStrictEqual(picked, ['#f7cdd4'], 'onPick receives the picked hex');

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
assert.strictEqual(photoImgs(themed).length, 4, 'theme never touches the photos');
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

/* ── Photo filters & effects (Phase 4D) ──────────────────────────────── */
assert.strictEqual(Strip.filters.length, 6, '6 curated filters');
assert.strictEqual(Strip.filters[0].key, 'original', 'original is the default first filter');
assert.strictEqual(Strip.effects.length, 3, '3 effect options (off + 2)');
assert.strictEqual(Strip.effects[0].key, 'none', 'effects default to off');

// applyPhotoFilter changes only the photo appearance — theme, color and the
// photos themselves stay untouched.
var filtered = new FakeEl('div');
Strip.setColor(filtered, '#f6d9de');
Strip.renderPreview(filtered, 'vertical', photos);
Strip.applyTheme(filtered, 'retro');
Strip.applyPhotoFilter(filtered, 'bw');
assert.strictEqual(filtered.attrs['data-filter'], 'bw', 'applyPhotoFilter stamps data-filter');
assert.strictEqual(
  filtered.style['--pb-filter'], 'grayscale(1) contrast(1.1) brightness(1.04)',
  '--pb-filter carries the CSS filter string'
);
assert.strictEqual(filtered.attrs['data-theme'], 'retro', 'filter never touches the theme');
assert.strictEqual(filtered.style.backgroundColor, '#f6d9de', 'filter never touches the color');
assert.strictEqual(photoImgs(filtered).length, 4, 'filter never touches the photos');

// Switching filters replaces the previous one, and Original restores the
// base appearance exactly.
Strip.applyPhotoFilter(filtered, 'warm');
assert.strictEqual(filtered.attrs['data-filter'], 'warm', 'filter switches');
assert.strictEqual(
  filtered.style['--pb-filter'], 'sepia(0.28) saturate(1.3) hue-rotate(-10deg) brightness(1.03)',
  'new filter replaces the old'
);
// Every non-original filter must be clearly recognisable against Original
// AND against each other — each carries its signature function and no two
// share the same full CSS string (so the picker options feel distinct).
var signatures = {
  bw: 'grayscale(1)',
  vintage: 'sepia(0.5)',
  warm: 'hue-rotate(-10deg)',
  cool: 'hue-rotate(18deg)',
  fade: 'contrast(0.75)'
};
var seen = {};
Object.keys(signatures).forEach(function (k) {
  Strip.applyPhotoFilter(filtered, k);
  assert.strictEqual(filtered.attrs['data-filter'], k, k + ' filter applies');
  assert.ok(
    filtered.style['--pb-filter'].indexOf(signatures[k]) !== -1,
    k + ' filter carries its signature function'
  );
  assert.ok(
    filtered.style['--pb-filter'] !== 'brightness(1)',
    k + ' filter is visually distinct from Original'
  );
  assert.ok(!seen[filtered.style['--pb-filter']], k + ' filter string is unique');
  seen[filtered.style['--pb-filter']] = true;
});

Strip.applyPhotoFilter(filtered, 'original');
assert.strictEqual(filtered.attrs['data-filter'], 'original', 'back to original');
assert.strictEqual(filtered.style['--pb-filter'], 'brightness(1)', 'original restores the identity filter');

Strip.applyPhotoFilter(filtered, 'not-a-filter');
assert.strictEqual(filtered.attrs['data-filter'], 'original', 'unknown filter -> original');
assert.strictEqual(Strip.filterKey(undefined), 'original', 'missing filter -> original');

// Effects are separate and optional (off by default).
Strip.applyPhotoEffect(filtered, 'grain');
assert.strictEqual(filtered.attrs['data-effect'], 'grain', 'applyPhotoEffect stamps data-effect');
Strip.applyPhotoEffect(filtered, 'not-an-effect');
assert.strictEqual(filtered.attrs['data-effect'], 'none', 'unknown effect -> off');
assert.strictEqual(Strip.effectKey(undefined), 'none', 'missing effect -> off');

// Filter picker: 6 pills, original selected, click + keyboard both work.
var fx = new FakeEl('div');
var pickedFx = [];
Strip.buildFilterSwatches(fx, function (key) { pickedFx.push(key); }, 'original');
assert.strictEqual(fx.children.length, 6, '6 filter options built');
assert.strictEqual(fx.children[0].getAttribute('aria-checked'), 'true', 'original selected by default');
assert.strictEqual(fx.children[0].getAttribute('aria-label'), 'Photo filter: Original', 'filter labelled');
pickedFx.length = 0;
fx.children[3].events.click(); // warm
assert.strictEqual(fx.children[3].getAttribute('aria-checked'), 'true', 'warm selected after click');
assert.strictEqual(fx.children[0].getAttribute('aria-checked'), 'false', 'original deselected');
assert.deepStrictEqual(pickedFx, ['warm'], 'onPick receives the filter');
pickedFx.length = 0;
fx.children[0].events.keydown({ key: 'ArrowRight', preventDefault: function () {} });
assert.strictEqual(fx.children[1].getAttribute('aria-checked'), 'true', 'arrow-key moves filter forward');
assert.deepStrictEqual(pickedFx, ['bw'], 'keyboard filter pick fires onPick');

// Effect picker: 3 pills, off selected.
var ex = new FakeEl('div');
var pickedEx = [];
Strip.buildEffectSwatches(ex, function (key) { pickedEx.push(key); }, 'none');
assert.strictEqual(ex.children.length, 3, '3 effect options built');
assert.strictEqual(ex.children[0].getAttribute('aria-checked'), 'true', 'off selected by default');
pickedEx.length = 0;
ex.children[1].events.click(); // film grain
assert.deepStrictEqual(pickedEx, ['grain'], 'onPick receives the effect');

/* ── Optional date (Phase 4E) ────────────────────────────────────────── */
var dated = new FakeEl('div');
Strip.renderPreview(dated, 'vertical', photos);
Strip.applyDate(dated, false);
assert.strictEqual(dated.attrs['data-date'], 'off', 'date off stamps data-date=off');
assert.strictEqual(dated.querySelectorAll('.pd-date').length, 0, 'date off renders nothing');

Strip.applyDate(dated, true);
assert.strictEqual(dated.attrs['data-date'], 'on', 'date on stamps data-date=on');
var dateEls = dated.querySelectorAll('.pd-date');
assert.strictEqual(dateEls.length, 1, 'date on injects exactly one date element');
assert.ok(
  /^pd pd-date bc$/.test(dateEls[0].className),
  'date element uses the upright bottom-centre position'
);
assert.ok(
  /^\d{2} [A-Z]{3} '\d{2}$/.test(dateEls[0].textContent),
  "date text is a readable DD MMM 'YY"
);
assert.strictEqual(photoImgs(dated).length, 4, 'the date never touches the four photos');
assert.deepStrictEqual(
  photoImgs(dated).map(function (c) { return c.src; }),
  photos,
  'photo order is preserved with the date on'
);

Strip.applyDate(dated, true);
assert.strictEqual(dated.querySelectorAll('.pd-date').length, 1, 're-applying on never duplicates the date');
Strip.applyDate(dated, false);
assert.strictEqual(dated.querySelectorAll('.pd-date').length, 0, 'date off removes the element');

// Date toggle: 2 options, off default, click + arrow keys work.
var dt = new FakeEl('div');
var pickedDate = [];
Strip.buildDateToggle(dt, function (key) { pickedDate.push(key); }, false);
assert.strictEqual(dt.children.length, 2, 'date toggle has Off/On');
assert.strictEqual(dt.children[0].getAttribute('aria-checked'), 'true', 'date defaults to off');
pickedDate.length = 0;
dt.children[1].events.click(); // On
assert.strictEqual(dt.children[1].getAttribute('aria-checked'), 'true', 'On selected after click');
assert.deepStrictEqual(pickedDate, ['on'], 'onPick receives the date setting');
var dtOn = new FakeEl('div');
Strip.buildDateToggle(dtOn, null, true);
assert.strictEqual(dtOn.children[1].getAttribute('aria-checked'), 'true', 'On preselected when already enabled');

/* ── No-leak static invariants (Phase 4D refinement) ─────────────────────
   The core rule: filters/effects must affect ONLY the photo pixels —
   never the strip background, theme frame, borders, decorations or
   margins. These source-level checks lock that in so a future change
   can't silently re-introduce leakage (e.g. a drop-shadow glow or an
   unclipped grain region). */
var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var css = fs.readFileSync(path.join(ROOT, 'css', 'style.css'), 'utf8');
var html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// 1. Soft Glow must never render outside the photo: the rule must NOT use
//    drop-shadow() (which draws past the img bounds onto the strip
//    background) and must target the photos only.
var glowRule = css.match(/\.strip-preview\[data-effect="glow"\] img\s*\{([^}]*)\}/);
assert.ok(glowRule, 'glow effect rule exists');
assert.ok(!/drop-shadow/.test(glowRule[1]), 'glow never uses drop-shadow (it would leak outside the photo)');
assert.ok(/inset/.test(glowRule[1]), 'glow is an inset treatment, clipped to the photo box');
assert.ok(
  /var\(--pb-filter, brightness\(1\)\)/.test(css),
  'photo filter fallback is the brightness(1) identity (never the invalid none)'
);

// 2. Every effect rule must target .strip-preview img — photos only.
var effectRules = css.match(/\.strip-preview\[data-effect="[a-z]+"\]\s+img/g) || [];
assert.ok(effectRules.length >= 2, 'both effect rules target .strip-preview img (photos only)');

// 3. The Film Grain SVG filter must be region-clipped to the element
//    bounds — the default -10%/+20% region would render grain OUTSIDE the
//    photo, onto the strip background.
assert.ok(
  /<filter id="pb-grain" x="0%" y="0%" width="100%" height="100%"/.test(html),
  'grain filter is region-clipped to the photo bounds'
);

// 4. The .photo-cell wrapper is the hard clip enforcement point: even if a
//    browser ignores the SVG filter region, overflow:hidden on the cell
//    clips all effect output to the exact photo rectangle — so effects can
//    never reach the strip background, frame, decorations or margins.
var cellRule = css.match(/\.strip-preview \.photo-cell\s*\{([^}]*)\}/);
assert.ok(cellRule, '.photo-cell clip rule exists');
assert.ok(/overflow:\s*hidden/.test(cellRule[1]), '.photo-cell clips effect output to the photo');
assert.ok(/position:\s*relative/.test(cellRule[1]), '.photo-cell anchors the photo cell');

// 5. Filters may ONLY ever be applied to the photo imgs — never to the
//    strip container, theme frame or decor layer. Every rule using
//    filter: must target an img selector, so the frame/background can
//    never receive a photo effect.
var cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
var filteredRules = cssNoComments.split('}').filter(function (block) {
  return /filter\s*:/.test(block);
});
assert.ok(filteredRules.length >= 3, 'the photo-filter rules are present');
filteredRules.forEach(function (block) {
  assert.ok(/img\s*\{/.test(block), 'every filter rule targets the photo <img> only');
});

console.log('strip layout + color + theme + filter tests passed ✓');