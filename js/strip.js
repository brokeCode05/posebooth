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

  // Normalize the Phase 1 layout value to one of the three strip shapes.
  // 'grid' and 'horizontal' map through; anything else falls back to
  // 'vertical' so a missing layout never produces a broken preview.
  function layoutKey(layout) {
    if (layout === 'horizontal' || layout === 'grid') return layout;
    return 'vertical';
  }

  // Build the strip: exactly four <img> in DOM order (photo 1..4), one per
  // captured photo. The container carries data-layout so the stylesheet
  // arranges them (row, column, 2×2). Images use object-fit: cover on a
  // fixed 4:3 frame, so nothing is stretched or distorted.
  function renderPreview(container, layout, photos) {
    if (!container) return;
    var taken = (photos || []).slice(0, PHOTO_LIMIT);
    container.setAttribute('data-layout', layoutKey(layout));
    container.innerHTML = '';
    taken.forEach(function (src) {
      var img = document.createElement('img');
      img.src = src;
      img.alt = 'Captured photo';
      container.appendChild(img);
    });
  }

  root.Strip = {
    version: '4.0.0',
    layoutKey: layoutKey,
    renderPreview: renderPreview
  };

  // Allow the layout logic to be smoke-tested in Node.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = root.Strip;
  }
})(typeof window !== 'undefined' ? window : globalThis);
