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
  // print proportions (2×6, 6×8, 8×6 inch). The browser preview scales
  // these down but always preserves the exact ratio; the same dimensions
  // will drive the eventual printable/downloadable export. The extra room
  // around the photos is intentional breathing space for future themed
  // frame designs (borders, stickers, typography, logos).
  var CANVAS = {
    vertical:   { width: 1200, height: 3600 }, // 2×6 print, 1 : 3
    grid:       { width: 3600, height: 4800 }, // 6×8 print, 3 : 4
    horizontal: { width: 4800, height: 3600 }  // 8×6 print, 4 : 3
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

  // Build the strip: exactly four <img> in DOM order (photo 1..4), one per
  // captured photo. The container carries data-layout so the stylesheet
  // arranges them (row, column, 2×2), and an inline aspect-ratio matching
  // the master canvas so the preview keeps the exact print proportions.
  // Images use object-fit: cover on a fixed 4:3 frame, so nothing is
  // stretched or distorted.
  function renderPreview(container, layout, photos) {
    if (!container) return;
    var taken = (photos || []).slice(0, PHOTO_LIMIT);
    container.setAttribute('data-layout', layoutKey(layout));
    container.style.aspectRatio = canvasRatio(layout);
    container.innerHTML = '';
    taken.forEach(function (src, i) {
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'Photo ' + (i + 1) + ' of ' + PHOTO_LIMIT;
      container.appendChild(img);
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

  root.Strip = {
    version: '4.3.0',
    canvas: CANVAS,
    layoutKey: layoutKey,
    canvasRatio: canvasRatio,
    renderPreview: renderPreview,
    colors: STRIP_COLORS,
    setColor: setColor,
    buildColorSwatches: buildColorSwatches
  };

  // Allow the layout logic to be smoke-tested in Node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.Strip;
  }
})(typeof window !== 'undefined' ? window : globalThis);
