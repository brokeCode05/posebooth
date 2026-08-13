/* ==========================================================================
   Posebooth — Phase 4A: Photo strip layout renderer.
   Renders the EXACTLY 4 captured photos into a strip preview following the
   layout chosen in Phase 1 (vertical | horizontal | grid).

   Only the captured photo data is rendered — no pose guides, no comparison
   UI, no camera chrome, no buttons. Later Phase 4 steps (colors, styles,
   filters, effects, download) build on this same preview element.
   ========================================================================== */

(function (root) {
  'use strict';

  var PHOTO_LIMIT = 4; // the rule: exactly four photos.

  // Master working canvases for the strip, sized to real photobooth
  // print proportions — horizontal is the vertical 2×6 print turned on
  // its side (6×2). The browser preview scales these down but always
  // preserves the exact ratio; the same dimensions will drive the
  // eventual printable/downloadable export. The extra room around the
  // photos is intentional breathing space for future themed frame
  // designs (borders, stickers, typography, logos).
  var CANVAS = {
    vertical:   { width: 1200, height: 3600 }, // 2×6 print, 1 : 3
    grid:       { width: 3600, height: 4800 }, // 6×8 print, 3 : 4
    horizontal: { width: 3600, height: 1200 }  // 6×2 print, 3 : 1
  };

  // Normalize the Phase 1 layout value to one of the three strip shapes.
  // 'grid' and 'horizontal' map through; anything else falls back to
  // 'vertical' so a missing layout never produces a broken preview.
  function layoutKey(layout) {
    if (layout === 'horizontal' || layout === 'grid') return layout;
    return 'vertical';
  }

  // CSS aspect-ratio string for the master canvas of a layout.
  function canvasRatio(layout) {
    var c = CANVAS[layoutKey(layout)];
    return c.width + ' / ' + c.height;
  }

  // Shared layout geometry — ONE intentional spacing system for every
  // strip. All values are percentages of the container width (the browser
  // resolves % padding/gap against width), and the container width maps
  // 1:1 onto the master canvas because it keeps the exact print ratio.
  // Each layout is solved so photos + gaps + margins fill the canvas
  // height exactly — no leftover flexbox slack, no per-theme offsets, no
  // arbitrary padding. Padding-box math (W = container width):
  //
  //   vertical (1:3):   pads 8% top/bottom, 4% sides, 2.5% gap
  //                     photos 92% wide → 69% tall ×4
  //                     276 + 3×2.5 + 2×8 = 299.5% ≈ 300% = 3W ✓
  //   horizontal (3:1): pads 4% top/bottom, 4% sides, 2.5% gap
  //                     cells 23% wide → 17.25% tall (51.75% of H) ×4
  //                     4×17.25 + 3×2.5 + 2×4 = 84.5% = 84.5% of W,
  //                     i.e. 253.5% of the 33.33%-of-W canvas height —
  //                     the 4:3 photos can't fill a 3:1 canvas, so the
  //                     cells size off the width axis (as the approved
  //                     6×2 did) and the remaining height is the margin.
  //   grid (3:4):       pads 30.92% top/bottom, 4% sides, 2.5% gap
  //                     2 rows × 34.5% + gap 2.5% + pads 2×30.92%
  //                     = 133.33% = 4/3 W ✓
  var GEOMETRY = {
    vertical:   { padX: '4%',      padTop: '8%',      padBottom: '8%',      gap: '2.5%' },
    horizontal: { padX: '4%',      padTop: '4%',      padBottom: '4%',      gap: '2.5%' },
    grid:       { padX: '4%',      padTop: '30.92%',  padBottom: '30.92%',  gap: '2.5%' }
  };

  // Build the strip: exactly four photos in DOM order (photo 1..4), each
  // wrapped in a .photo-cell — an overflow:hidden clip container sized
  // exactly to the photo. The container carries data-layout so the
  // stylesheet arranges the cells (row, column, 2×2), an inline
  // aspect-ratio matching the master canvas so the preview keeps the
  // exact print proportions, and the shared geometry as CSS custom
  // properties (padding + gap) so the white space is intentional.
  // Images use object-fit: cover on a fixed 4:3 frame, so nothing is
  // stretched or distorted.
  //
  // The cell exists to keep photo effects (film grain, soft glow) inside
  // the photo rectangle: the effects are applied to the <img>, and the
  // cell's overflow:hidden clips ANY filter output back to the photo —
  // nothing can ever paint onto the strip background, frame, decorations
  // or margins, regardless of strip color, theme, filter or layout.
  function renderPreview(container, layout, photos) {
    if (!container) return;
    var taken = (photos || []).slice(0, PHOTO_LIMIT);
    var key = layoutKey(layout);
    container.setAttribute('data-layout', key);
    container.style.aspectRatio = canvasRatio(key);
    var g = GEOMETRY[key];
    container.style.setProperty('--pb-pad-x', g.padX);
    container.style.setProperty('--pb-pad-top', g.padTop);
    container.style.setProperty('--pb-pad-bottom', g.padBottom);
    container.style.setProperty('--pb-gap', g.gap);
    container.innerHTML = '';
    taken.forEach(function (src, i) {
      var cell = document.createElement('span');
      cell.className = 'photo-cell';
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'Photo ' + (i + 1) + ' of ' + PHOTO_LIMIT;
      cell.appendChild(img);
      container.appendChild(cell);
    });
  }

  // ── Phase 4B: strip background color ───────────────────────────────────

  // Curated photobooth palette — 13 distinct colors spanning soft, bold
  // and dark ranges, so every swatch reads clearly next to its neighbours
  // and every theme has an intentional companion. White stays the clean
  // default. The photos themselves are never touched; only the strip
  // backing changes.
  var STRIP_COLORS = [
    { name: 'White', hex: '#ffffff' },
    { name: 'Cream', hex: '#f5efe3' },
    { name: 'Blush', hex: '#f7cdd4' },
    { name: 'Peach', hex: '#ffe1cc' },
    { name: 'Lavender', hex: '#e3d9f4' },
    { name: 'Blue', hex: '#cfe3f5' },
    { name: 'Mint', hex: '#d7f0e2' },
    { name: 'Coral', hex: '#f2745f' },
    { name: 'Red', hex: '#d9334a' },
    { name: 'Cobalt', hex: '#2f5fd0' },
    { name: 'Purple', hex: '#6441a5' },
    { name: 'Charcoal', hex: '#45434a' },
    { name: 'Black', hex: '#1a1917' }
  ];

  // Apply a strip background color to the preview container. Inline style
  // wins over the stylesheet default and the photos are never touched.
  function setColor(container, hex) {
    if (!container) return;
    container.style.backgroundColor = hex || '#ffffff';
  }

  // Build the visual color picker. Mirrors the app's radiogroup pattern:
  // arrow-key navigation, aria-checked, and a clear selected ring. Picking
  // calls onPick(hex) so the caller can store state and update the preview.
  function buildColorSwatches(container, onPick, initialHex) {
    if (!container) return [];
    container.innerHTML = '';
    var buttons = [];

    STRIP_COLORS.forEach(function (c) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'swatch';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.setAttribute('data-hex', c.hex);
      btn.setAttribute('aria-label', 'Strip color: ' + c.name);
      btn.title = c.name;
      // The swatch is a small column: a colour dot (the actual swatch,
      // carrying the inline background) with its NAME visible underneath —
      // unlabelled circles make colours like Cream impossible to find.
      var dot = document.createElement('i');
      dot.className = 'swatch-dot';
      dot.style.backgroundColor = c.hex;
      var label = document.createElement('span');
      label.className = 'swatch-name';
      label.textContent = c.name;
      btn.appendChild(dot);
      btn.appendChild(label);
      btn.addEventListener('click', function () {
        pick(btn);
        if (onPick) onPick(c.hex);
      });
      btn.addEventListener('keydown', function (e) {
        var idx = buttons.indexOf(btn);
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          next = buttons[(idx + 1) % buttons.length];
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          next = buttons[(idx - 1 + buttons.length) % buttons.length];
        }
        if (next) {
          e.preventDefault();
          pick(next);
          next.focus();
          if (onPick) onPick(next.getAttribute('data-hex'));
        }
      });
      container.appendChild(btn);
      buttons.push(btn);
    });

    function pick(target) {
      buttons.forEach(function (b) {
        var on = b === target;
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    }

    // Mark the initial/current colour (default white). Match against the
    // data-hex attribute, NOT style.backgroundColor: browsers serialize an
    // inline background-color back as rgb(...), so comparing the raw hex
    // against the serialized value would fail for every non-white colour
    // (and silently fall back to the first swatch).
    var current = String(initialHex || '#ffffff').toLowerCase();
    var found = null;
    buttons.forEach(function (b) {
      if (String(b.getAttribute('data-hex') || '').toLowerCase() === current) {
        found = b;
      }
    });
    if (found) {
      pick(found);
    } else if (buttons.length) {
      // Fallback: if the stored colour isn't in the palette (e.g., from a
      // future Phase 4C preset), default to the first swatch (white).
      pick(buttons[0]);
    }
    return buttons;
  }

  // ── Phase 4C: strip themes (decorative layer) ─────────────────────────

  // Curated theme set. Each theme is a decorative layer (borders, accents,
  // background treatment) applied via the data-theme attribute on the strip
  // container. COLOR = base/background, THEME = decoration — the two compose,
  // and a theme never touches the photos or the selected color.
  var THEMES = [
    { key: 'minimal', name: 'Minimal' },
    { key: 'classic', name: 'Classic' },
    { key: 'cute', name: 'Cute' },
    { key: 'y2k', name: 'Y2K' },
    { key: 'retro', name: 'Retro' },
    { key: 'pastel', name: 'Pastel' }
  ];

  // Normalize a theme key; unknown keys fall back to 'minimal'.
  function themeKey(key) {
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].key === key) return key;
    }
    return 'minimal';
  }

  // Accents injected into the strip frame for each theme. The default
  // themes are clean starter templates — the only injected accents are tiny
  // orientation-neutral corner dots (cute, pastel); everything else is a
  // frame/border treatment drawn by CSS. There is deliberately NO text on
  // the default strips: no wordmark, no date.
  //
  // The optional SHOW DATE element (Phase 4E) is handled separately by
  // applyDate() — a single .pd-date element appended directly to the strip,
  // OFF by default — rather than living in this per-theme DECOR map, so it
  // survives theme switches. This map remains the plug-in point for future
  // custom themes; date stays OFF unless the user enables it.
  var DECOR = {
    minimal: [],
    classic: [],
    cute: [
      ['dot', 'tl'],
      ['dot', 'tr'],
      ['dot', 'bl'],
      ['dot', 'br']
    ],
    y2k: [],
    retro: [],
    pastel: [
      ['dot', 'tl'],
      ['dot', 'tr'],
      ['dot', 'bl'],
      ['dot', 'br']
    ]
  };

  // (Re)build the decorative layer for a theme: remove any previous layer
  // and inject the theme's accents into the strip frame. Pure decoration —
  // pointer-events none, aria-hidden, and it never touches photos, layout
  // or color.
  function applyDecor(container, key) {
    if (!container) return;
    if (container.querySelectorAll) {
      var old = container.querySelectorAll('.pd-layer');
      for (var i = 0; i < old.length; i++) container.removeChild(old[i]);
    }
    var specs = DECOR[key];
    if (!specs || !specs.length) return;
    var layer = document.createElement('span');
    layer.className = 'pd-layer';
    layer.setAttribute('aria-hidden', 'true');
    specs.forEach(function (s) {
      var el = document.createElement('span');
      el.className = 'pd pd-' + s[0] + ' ' + s[1];
      layer.appendChild(el);
    });
    container.appendChild(layer);
  }

  // Apply a theme to the strip container: stamps data-theme (the decorative
  // CSS layer) and rebuilds the injected decorations. Photos, layout and
  // color stay untouched.
  function applyTheme(container, key) {
    if (!container) return;
    var k = themeKey(key);
    container.setAttribute('data-theme', k);
    applyDecor(container, k);
  }

  // Build the visual theme picker. Each option shows a mini mock of the
  // strip rendered with the REAL theme CSS (class strip-preview theme-demo)
  // and stamped with the SELECTED layout via the same data-layout mechanism
  // the real strip uses — so the theme cards always show what the theme
  // looks like in the user's current layout. Mirrors the color swatch
  // radiogroup: arrow keys, aria-checked, clear selected ring.
  function buildThemeSwatches(container, onPick, initialKey, layout) {
    if (!container) return [];
    container.innerHTML = '';
    var buttons = [];

    THEMES.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-option';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.setAttribute('data-theme', t.key);
      btn.setAttribute('aria-label', 'Strip theme: ' + t.name);

      // Mini strip preview that reuses the live theme CSS and mirrors the
      // current layout (vertical | horizontal | grid).
      var demo = document.createElement('span');
      demo.className = 'strip-preview theme-demo';
      demo.setAttribute('data-theme', t.key);
      demo.setAttribute('data-layout', layoutKey(layout));
      for (var i = 0; i < 4; i++) {
        var cell = document.createElement('i');
        cell.setAttribute('aria-hidden', 'true');
        demo.appendChild(cell);
      }
      applyDecor(demo, t.key);
      btn.appendChild(demo);

      var label = document.createElement('span');
      label.className = 'theme-name';
      label.textContent = t.name;
      btn.appendChild(label);

      btn.addEventListener('click', function () {
        pick(btn);
        if (onPick) onPick(t.key);
      });
      btn.addEventListener('keydown', function (e) {
        var idx = buttons.indexOf(btn);
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          next = buttons[(idx + 1) % buttons.length];
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          next = buttons[(idx - 1 + buttons.length) % buttons.length];
        }
        if (next) {
          e.preventDefault();
          pick(next);
          next.focus();
          if (onPick) onPick(next.getAttribute('data-theme'));
        }
      });

      container.appendChild(btn);
      buttons.push(btn);
    });

    function pick(target) {
      buttons.forEach(function (b) {
        var on = b === target;
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    }

    // Mark the initial/current theme (default minimal).
    var current = themeKey(initialKey);
    var found = null;
    buttons.forEach(function (b) {
      if (b.getAttribute('data-theme') === current) found = b;
    });
    if (found) pick(found);
    return buttons;
  }

  // ── Phase 4D: photo filters & effects ────────────────────────────────

  // Photo filters change the APPEARANCE of the photos only — the theme,
  // frame, borders and strip background stay untouched. Each filter maps
  // to a CSS filter-function string applied to the <img> elements via the
  // --pb-filter custom property on the strip container (Original uses the
  // identity brightness(1) so filter chains stay valid). The original
  // photo data is never modified, so switching back to Original restores
  // the photos exactly.
  //
  // Each non-original filter is tuned to be clearly recognisable against
  // Original while still looking like a real photobooth photo: B&W is a
  // clean monochrome, Vintage gets a warm cast with muted, softened
  // contrast, Warm shifts toward golden, Cool shifts toward blue/cyan,
  // Fade lifts the blacks and washes out the tone.
  var FILTERS = [
    { key: 'original', name: 'Original', css: 'brightness(1)' },
    { key: 'bw', name: 'Black & White', css: 'grayscale(1) contrast(1.1) brightness(1.04)' },
    { key: 'vintage', name: 'Vintage', css: 'sepia(0.5) saturate(0.75) contrast(0.88) brightness(1.05)' },
    { key: 'warm', name: 'Warm', css: 'sepia(0.28) saturate(1.3) hue-rotate(-10deg) brightness(1.03)' },
    { key: 'cool', name: 'Cool', css: 'hue-rotate(18deg) saturate(1.05) contrast(1.02) brightness(1.03)' },
    { key: 'fade', name: 'Fade', css: 'contrast(0.75) brightness(1.18) saturate(0.65)' }
  ];

  // Optional photo effects, subtle and exclusive of each other (one filter
  // + one effect at a time). 'none' = off.
  var EFFECTS = [
    { key: 'none', name: 'Off' },
    { key: 'grain', name: 'Film Grain' },
    { key: 'glow', name: 'Soft Glow' }
  ];

  function findByKey(list, key) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].key === key) return list[i];
    }
    return null;
  }

  // Normalize filter/effect keys; unknown values fall back to the defaults.
  function filterKey(key) {
    return findByKey(FILTERS, key) ? key : 'original';
  }

  function effectKey(key) {
    return findByKey(EFFECTS, key) ? key : 'none';
  }

  // Apply a photo filter to the strip container: stamps data-filter and sets
  // the --pb-filter custom property that the .strip-preview img rules
  // consume. Only the photo appearance changes.
  function applyPhotoFilter(container, key) {
    if (!container) return;
    var k = filterKey(key);
    var f = findByKey(FILTERS, k);
    container.setAttribute('data-filter', k);
    container.style.setProperty('--pb-filter', f ? f.css : 'brightness(1)');
  }

  // Apply an optional photo effect (none | grain | glow) — also stamps
  // data-effect for the CSS layer. Independent of the photo filter.
  function applyPhotoEffect(container, key) {
    if (!container) return;
    container.setAttribute('data-effect', effectKey(key));
  }

  // Shared radiogroup row builder for the filter/effect pickers (mirrors
  // the color/theme swatch pattern: arrow keys, aria-checked, clear
  // selected state). Items are [{ key, name }]; keyAttr stores the key on
  // each button.
  function buildFxRow(container, items, initialKey, keyAttr, labelPrefix, onPick) {
    if (!container) return [];
    container.innerHTML = '';
    var buttons = [];

    items.forEach(function (it) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fx-option';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.setAttribute(keyAttr, it.key);
      btn.setAttribute('aria-label', labelPrefix + ': ' + it.name);
      btn.textContent = it.name;
      btn.addEventListener('click', function () {
        pick(btn);
        if (onPick) onPick(it.key);
      });
      btn.addEventListener('keydown', function (e) {
        var idx = buttons.indexOf(btn);
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          next = buttons[(idx + 1) % buttons.length];
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          next = buttons[(idx - 1 + buttons.length) % buttons.length];
        }
        if (next) {
          e.preventDefault();
          pick(next);
          next.focus();
          if (onPick) onPick(next.getAttribute(keyAttr));
        }
      });
      container.appendChild(btn);
      buttons.push(btn);
    });

    function pick(target) {
      buttons.forEach(function (b) {
        var on = b === target;
        b.classList.toggle('is-selected', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
      });
    }

    var current = initialKey;
    var found = null;
    buttons.forEach(function (b) {
      if (b.getAttribute(keyAttr) === current) found = b;
    });
    if (found) pick(found);
    return buttons;
  }

  // Visual pickers for filters and effects (pills with clear active states).
  function buildFilterSwatches(container, onPick, initialKey) {
    return buildFxRow(container, FILTERS, filterKey(initialKey), 'data-filter', 'Photo filter', onPick);
  }

  function buildEffectSwatches(container, onPick, initialKey) {
    return buildFxRow(container, EFFECTS, effectKey(initialKey), 'data-effect', 'Effect', onPick);
  }

  // ── Phase 4E: optional date (OFF by default) ─────────────────────────

  // The date is an optional final-composition element. OFF by default —
  // nothing renders unless the user enables it. When ON, a small mono
  // date sits in the bottom-centre frame margin (the shared .pd.bc
  // position, so it is layout-aware and never rotated). A translucent
  // pill keeps it readable on any strip color. It is UI composition
  // only: it is never baked into the captured photos, and the export
  // photo data stays clean.
  var DATE_OPTIONS = [
    { key: 'off', name: 'Off' },
    { key: 'on', name: 'On' }
  ];

  function dateText() {
    var d = new Date();
    var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
      'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    var day = String(d.getDate());
    if (day.length === 1) day = '0' + day;
    return day + ' ' + MONTHS[d.getMonth()] + ' \'' + String(d.getFullYear()).slice(-2);
  }

  // Apply the optional date to the strip: stamps data-date (the CSS uses
  // it to open a slim bottom band on the 2×6 so the date never overlaps
  // the last photo) and injects/removes the .pd-date element. Remove
  // first, so re-applying never duplicates it.
  function applyDate(container, on) {
    if (!container) return;
    container.setAttribute('data-date', on ? 'on' : 'off');
    if (container.querySelectorAll) {
      var old = container.querySelectorAll('.pd-date');
      for (var i = 0; i < old.length; i++) container.removeChild(old[i]);
    }
    if (!on) return;
    var el = document.createElement('span');
    el.className = 'pd pd-date bc';
    el.setAttribute('aria-hidden', 'true');
    el.textContent = dateText();
    container.appendChild(el);
  }

  function buildDateToggle(container, onPick, initialOn) {
    return buildFxRow(container, DATE_OPTIONS, initialOn ? 'on' : 'off', 'data-date', 'Show date', onPick);
  }

  // ── Phase 4F: download / export ──────────────────────────────────────
  // The export shares ONE source of truth with the preview: the same
  // CANVAS dimensions, the same GEOMETRY spacing, the same theme/color/
  // filter/effect/date state. The finished strip is rendered offscreen at
  // master resolution (1200×3600 / 3600×1200 / 3600×4800) and rasterized
  // to a PNG — it is never a screenshot of the on-screen preview.
  //
  // How it works:
  //  1. The live preview is deep-cloned and every computed style is
  //     inlined (px lengths scaled by preview→master factor, so the
  //     percentage-based geometry re-flows to print size exactly).
  //     Pseudo-elements (y2k streak/sparkle) are materialized as real
  //     elements because cloneNode cannot carry ::before/::after.
  //  2. The clone is serialized into an SVG <foreignObject> and loaded as
  //     a data: URI — NOT a blob URL, because Chromium taints a canvas
  //     drawn from a blob-URI SVG-with-foreignObject, and a tainted
  //     canvas cannot be exported. Data URIs stay origin-clean in every
  //     browser. This raster carries the frame: strip color, theme
  //     borders/shadows/gradients, decorations, date, layout.
  //  3. The four photos are then drawn from their ORIGINAL sources on
  //     top, one per photo cell, with the photo filter applied via
  //     ctx.filter and grain/glow composited inside a clip of the cell
  //     rectangle — so effects can never leak onto the frame, margins or
  //     background, regardless of strip color or theme.

  // Master export dimensions — straight from the CANVAS table, so the
  // export is always 2×6 / 6×2 / 6×8 at full print resolution.
  function exportSize(layout) {
    var k = layoutKey(layout);
    return { width: CANVAS[k].width, height: CANVAS[k].height };
  }

  function exportFilename(layout) {
    var names = {
      vertical: 'posebooth-2x6.png',
      horizontal: 'posebooth-6x2.png',
      grid: 'posebooth-6x8.png'
    };
    return names[layoutKey(layout)];
  }

  // The SVG shell that carries the serialized strip markup at master
  // resolution. Kept as a pure string builder so it is unit-testable and
  // the data-URI/no-blob rule stays visible.
  function exportSvgMarkup(innerXml, layout) {
    var m = exportSize(layout);
    // No <?xml?> declaration: some browsers refuse to decode an SVG image
    // that carries one, which would make the raster silently fail.
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + m.width + '" height="' + m.height +
      '" viewBox="0 0 ' + m.width + ' ' + m.height + '">' +
      '<foreignObject width="100%" height="100%">' +
      '<div xmlns="http://www.w3.org/1999/xhtml">' + innerXml + '</div>' +
      '</foreignObject></svg>';
  }

  // Multiply every px length inside a computed-style value by s. The
  // preview and the master canvas differ only by this uniform factor
  // (the whole geometry system is percentage-based), so scaling the
  // computed px values reproduces the preview pixel-for-pixel at print
  // resolution.
  function scalePxValues(value, s) {
    return String(value).replace(/(-?[\d.]+)px/g, function (m, n) {
      return (parseFloat(n) * s) + 'px';
    });
  }

  // Split a comma-separated value without splitting inside rgba(...).
  function splitList(value) {
    var out = [], depth = 0, cur = '';
    var str = String(value || '');
    for (var i = 0; i < str.length; i++) {
      var ch = str.charAt(i);
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        out.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  // Theme frames draw with borders and box-shadows (classic/retro/cute/
  // y2k use inset shadows or zero-offset rings — those ARE the print's
  // frame). Only offset drop-shadows (the pastel UI glow) are preview
  // chrome and must NOT appear in the exported image. getComputedStyle
  // serializes shadows color-first ("rgba(...) 0px 0px 0px 8px") with
  // inset last, so the parser tolerates both orders.
  function exportBoxShadow(computed, s) {
    var parts = splitList(computed).filter(function (entry) {
      var t = String(entry).trim();
      var m = t.match(
        /^(?:rgba?\([^)]*\)|hsla?\([^)]*\)|#[0-9a-fA-F]{3,8}|[a-zA-Z]+)?\s*(-?[\d.]+)px\s+(-?[\d.]+)px/
      );
      return m && parseFloat(m[1]) === 0 && parseFloat(m[2]) === 0;
    });
    return parts.map(function (e) { return scalePxValues(e, s); }).join(', ');
  }

  // Properties that must not be copied from computed style: `content`
  // (pseudo text is handled by materialization) and the grid tracks
  // (Chrome reports them as used px, which cannot be scaled — the grid
  // container is re-set to the authored repeat(2, 1fr) instead).
  var SKIP_COMPUTED = { content: 1, gridTemplateColumns: 1, gridTemplateRows: 1 };

  // Copy a CSSStyleDeclaration onto an element as inline styles, scaling
  // px lengths.
  function applyComputed(el, cs, s) {
    for (var i = 0; i < cs.length; i++) {
      var name = cs[i];
      if (SKIP_COMPUTED[name]) continue;
      var val = cs.getPropertyValue(name);
      if (val === '') continue;
      try {
        el.style.setProperty(name, scalePxValues(val, s));
      } catch (e) { /* ignore unsupported properties */ }
    }
  }

  function inlineComputed(el, s, pseudo) {
    applyComputed(el, el.ownerDocument.defaultView.getComputedStyle(el, pseudo || null), s);
  }

  // cloneNode cannot copy ::before / ::after, so materialize them as real
  // decorative spans carrying the pseudo's computed styles (the y2k
  // streak + corner sparkle).
  function materializePseudo(el, pseudo, s) {
    var cs = el.ownerDocument.defaultView.getComputedStyle(el, pseudo || null);
    var content = cs ? cs.content : 'none';
    if (!cs || content === 'none' || content === 'normal' || content === '') return null;
    var span = el.ownerDocument.createElement('span');
    span.setAttribute('aria-hidden', 'true');
    applyComputed(span, cs, s);
    var text = String(content).replace(/^(["'])([\s\S]*)\1$/, '$2');
    if (text) span.textContent = text;
    return span;
  }

  // object-fit: cover crop math — the same fitting the preview uses
  // (photos keep their 4:3 frame, never stretched).
  function coverCrop(srcW, srcH, boxW, boxH) {
    var scale = Math.max(boxW / srcW, boxH / srcH);
    var sw = boxW / scale;
    var sh = boxH / scale;
    return {
      sx: (srcW - sw) / 2,
      sy: (srcH - sh) / 2,
      sw: sw,
      sh: sh
    };
  }

  // Film grain — reproduces the preview's SVG feTurbulence→feColorMatrix→
  // overlay blend as per-pixel noise drawn with the canvas 'overlay' blend
  // mode, clipped to the photo cell. (feTurbulence fractalNoise is 0..1,
  // and the matrix maps r=g=b = 0.32·noise + 0.34, a = 0.6·noise.)
  var grainNoise = null;
  function getGrainNoise() {
    if (grainNoise) return grainNoise;
    var c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    var g = c.getContext('2d');
    var id = g.createImageData(128, 128);
    var d = id.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = Math.random();
      var v = 0.34 + 0.32 * n;
      var a = 0.6 * n;
      d[i] = v * 255;
      d[i + 1] = v * 255;
      d[i + 2] = v * 255;
      d[i + 3] = a * 255;
    }
    g.putImageData(id, 0, 0);
    grainNoise = c;
    return c;
  }

  function drawGrain(ctx, x, y, w, h) {
    ctx.save();
    ctx.globalCompositeOperation = 'overlay'; // matches feBlend mode="overlay"
    ctx.fillStyle = ctx.createPattern(getGrainNoise(), 'repeat');
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  // Soft Glow — the preview's inset white shadows as two clipped radial
  // gradients (outer soft ring + tighter inner ring). Always clipped to
  // the photo rectangle, so no glow can touch the frame or margins.
  function drawGlow(ctx, x, y, w, h) {
    var cx = x + w / 2;
    var cy = y + h / 2;
    var mx = Math.max(w, h);
    var mn = Math.min(w, h);
    var outer = ctx.createRadialGradient(cx, cy, mn * 0.30, cx, cy, mx * 0.78);
    outer.addColorStop(0, 'rgba(255,255,255,0)');
    outer.addColorStop(1, 'rgba(255,255,255,0.32)');
    ctx.fillStyle = outer;
    ctx.fillRect(x, y, w, h);
    var inner = ctx.createRadialGradient(cx, cy, mx * 0.40, cx, cy, mx * 0.52);
    inner.addColorStop(0, 'rgba(255,255,255,0)');
    inner.addColorStop(1, 'rgba(255,255,255,0.20)');
    ctx.fillStyle = inner;
    ctx.fillRect(x, y, w, h);
  }

  // Draw the four photos from their original sources into their cell
  // rects, applying the photo filter (ctx.filter) and the optional effect
  // — every step clipped to the exact photo rectangle. The clone's imgs
  // are used directly as drawImage sources: they are already decoded
  // (same data URLs as the live preview) and a CSS filter on the element
  // does not affect drawImage, which reads the intrinsic bitmap.
  function drawPhotosAndEffects(ctx, clone, effect, filterCss) {
    var cells = clone.querySelectorAll ? clone.querySelectorAll('.photo-cell') : [];
    if (!cells.length) return;
    var crect = clone.getBoundingClientRect();
    var supportsFilter = typeof ctx.filter === 'string';
    var glowBoost = effect === 'glow' ? ' brightness(1.06) contrast(0.97)' : '';
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      var imgEl = cell.querySelector ? cell.querySelector('img') : null;
      if (!imgEl || !imgEl.naturalWidth) continue;
      var r = cell.getBoundingClientRect();
      var x = Math.round(r.left - crect.left);
      var y = Math.round(r.top - crect.top);
      var w = Math.round(r.width);
      var h = Math.round(r.height);
      if (w <= 0 || h <= 0) continue;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      var c = coverCrop(imgEl.naturalWidth, imgEl.naturalHeight, w, h);
      if (supportsFilter && filterCss) ctx.filter = filterCss + glowBoost;
      ctx.drawImage(imgEl, c.sx, c.sy, c.sw, c.sh, x, y, w, h);
      ctx.filter = 'none';
      if (effect === 'grain') drawGrain(ctx, x, y, w, h);
      else if (effect === 'glow') drawGlow(ctx, x, y, w, h);
      ctx.restore();
    }
  }

  // Render the finished strip to a canvas at master resolution. Resolves
  // with the canvas (never tainted — the SVG is loaded as a data URI).
  function exportToCanvas(preview, layout) {
    return new Promise(function (resolve, reject) {
      var key = layoutKey(layout);
      var master = exportSize(key);
      var host = null;
      var clone = null;
      var cleanup = function () {
        if (host && host.parentNode) host.parentNode.removeChild(host);
        host = null;
        clone = null;
      };
      try {
        var rect = preview.getBoundingClientRect();
        var scale = master.width / Math.max(1, rect.width);
        var liveEffect = preview.getAttribute('data-effect') || 'none';
        // The photo filter is the container's --pb-filter (inline from
        // applyPhotoFilter); the browser resolves it on the live imgs.
        var filterCss = preview.style.getPropertyValue('--pb-filter') || 'brightness(1)';

        host = document.createElement('div');
        host.setAttribute('aria-hidden', 'true');
        host.style.cssText = 'position:fixed;left:-99999px;top:0;' +
          'width:' + master.width + 'px;height:' + master.height + 'px;' +
          'overflow:hidden;pointer-events:none;';
        clone = preview.cloneNode(true);
        // The effects are composited on canvas (deterministically clipped
        // to the photos) — remove data-effect so the clone's imgs carry
        // only the photo filter, never grain/glow.
        clone.removeAttribute('data-effect');
        host.appendChild(clone);
        document.body.appendChild(host);

        (function walk(node) {
          if (!node || node.nodeType !== 1) return;
          inlineComputed(node, scale, null);
          var before = materializePseudo(node, '::before', scale);
          if (before) node.insertBefore(before, node.firstChild);
          var after = materializePseudo(node, '::after', scale);
          if (after) node.appendChild(after);
          var kids = node.children;
          for (var i = 0; i < kids.length; i++) walk(kids[i]);
        })(clone);

        // Pin the clone to the master canvas; everything inside is already
        // proportionally scaled.
        clone.style.width = master.width + 'px';
        clone.style.height = master.height + 'px';
        clone.style.aspectRatio = 'auto';
        if (key === 'grid') {
          clone.style.gridTemplateColumns = 'repeat(2, 1fr)';
          clone.style.gridTemplateRows = 'auto';
        }
        var shadow = clone.ownerDocument.defaultView.getComputedStyle(clone).boxShadow;
        if (shadow && shadow !== 'none') clone.style.boxShadow = exportBoxShadow(shadow, scale);

        var xml = new XMLSerializer().serializeToString(clone);
        var svg = exportSvgMarkup(xml, key);
        var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        var img = new Image();
        // Watchdog: never let the export hang silently — the UI must
        // always get either a canvas or a failure.
        var watchdog = setTimeout(function () {
          cleanup();
          reject(new Error('export timed out'));
        }, 20000);
        img.onload = function () {
          clearTimeout(watchdog);
          try {
            var canvas = document.createElement('canvas');
            canvas.width = master.width;
            canvas.height = master.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, master.width, master.height);
            // Re-draw the photos from source: sharp at master resolution,
            // filtered via ctx.filter, effects clipped to each photo.
            drawPhotosAndEffects(ctx, clone, liveEffect, filterCss);
            cleanup();
            resolve(canvas);
          } catch (e) {
            cleanup();
            reject(e);
          }
        };
        img.onerror = function () {
          clearTimeout(watchdog);
          cleanup();
          reject(new Error('render failed'));
        };
        img.src = url;
      } catch (e) {
        cleanup();
        reject(e);
      }
    });
  }

  function triggerDownload(href, filename) {
    var a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (href.indexOf('blob:') === 0) {
      setTimeout(function () { URL.revokeObjectURL(href); }, 4000);
    }
  }

  // Export the finished strip as a lossless PNG and save it with a
  // sensible filename (posebooth-2x6.png / -6x2.png / -6x8.png).
  function downloadStrip(preview, layout) {
    return exportToCanvas(preview, layout).then(function (canvas) {
      return new Promise(function (resolve, reject) {
        var filename = exportFilename(layout);
        if (typeof canvas.toBlob === 'function') {
          canvas.toBlob(function (blob) {
            if (!blob) {
              reject(new Error('PNG encoding failed'));
              return;
            }
            triggerDownload(URL.createObjectURL(blob), filename);
            resolve(true);
          }, 'image/png');
        } else {
          triggerDownload(canvas.toDataURL('image/png'), filename);
          resolve(true);
        }
      });
    });
  }

  root.Strip = {
    version: '4.16.1',
    canvas: CANVAS,
    layoutKey: layoutKey,
    canvasRatio: canvasRatio,
    renderPreview: renderPreview,
    colors: STRIP_COLORS,
    setColor: setColor,
    buildColorSwatches: buildColorSwatches,
    themes: THEMES,
    themeKey: themeKey,
    decor: DECOR,
    applyTheme: applyTheme,
    buildThemeSwatches: buildThemeSwatches,
    filters: FILTERS,
    effects: EFFECTS,
    filterKey: filterKey,
    effectKey: effectKey,
    applyPhotoFilter: applyPhotoFilter,
    applyPhotoEffect: applyPhotoEffect,
    buildFilterSwatches: buildFilterSwatches,
    buildEffectSwatches: buildEffectSwatches,
    applyDate: applyDate,
    buildDateToggle: buildDateToggle,
    exportSize: exportSize,
    exportFilename: exportFilename,
    exportSvgMarkup: exportSvgMarkup,
    exportBoxShadow: exportBoxShadow,
    coverCrop: coverCrop,
    exportToCanvas: exportToCanvas,
    downloadStrip: downloadStrip
  };

  // Allow the layout logic to be smoke-tested in Node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.Strip;
  }
})(typeof window !== 'undefined' ? window : globalThis);
