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

  // Build the strip: exactly four photos in DOM order (photo 1..4), each
  // wrapped in a .photo-cell — an overflow:hidden clip container sized
  // exactly to the photo. The container carries data-layout so the
  // stylesheet arranges the cells (row, column, 2×2), and an inline
  // aspect-ratio matching the master canvas so the preview keeps the
  // exact print proportions. Images use object-fit: cover on a fixed 4:3
  // frame, so nothing is stretched or distorted.
  //
  // The cell exists to keep photo effects (film grain, soft glow) inside
  // the photo rectangle: the effects are applied to the <img>, and the
  // cell's overflow:hidden clips ANY filter output back to the photo —
  // nothing can ever paint onto the strip background, frame, decorations
  // or margins, regardless of strip color, theme, filter or layout.
  function renderPreview(container, layout, photos) {
    if (!container) return;
    var taken = (photos || []).slice(0, PHOTO_LIMIT);
    container.setAttribute('data-layout', layoutKey(layout));
    container.style.aspectRatio = canvasRatio(layout);
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

  // Curated photobooth palette — white is the clean default. The photos
  // themselves are never touched; only the strip backing changes.
  var STRIP_COLORS = [
    { name: 'White', hex: '#ffffff' },
    { name: 'Black', hex: '#1a1917' },
    { name: 'Cream', hex: '#f5efe3' },
    { name: 'Soft Pink', hex: '#f6d9de' },
    { name: 'Light Blue', hex: '#d3e5f2' },
    { name: 'Lavender', hex: '#e4dcf2' },
    { name: 'Soft Yellow', hex: '#f7e9c2' },
    { name: 'Soft Green', hex: '#dcead5' }
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
      btn.style.backgroundColor = c.hex;
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

    // Mark the initial/current colour (default white).
    var current = String(initialHex || '#ffffff').toLowerCase();
    var found = null;
    buttons.forEach(function (b) {
      if (b.style.backgroundColor && b.style.backgroundColor.toLowerCase() === current) {
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

  root.Strip = {
    version: '4.13.0',
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
    buildDateToggle: buildDateToggle
  };

  // Allow the layout logic to be smoke-tested in Node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.Strip;
  }
})(typeof window !== 'undefined' ? window : globalThis);
