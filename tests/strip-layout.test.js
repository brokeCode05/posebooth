/* ==========================================================================
   Posebooth — Phase 4A renderer smoke test (Node, no browser needed).
   Run with:  node tests/strip-layout.test.js
   Verifies layout mapping, the exactly-4 rule, photo order, and that only
   photo <img> elements are produced (no pose guides).
   ========================================================================== */

'use strict';

var assert = require('assert');

// Minimal document stub so the renderer can create <img> elements in Node.
global.document = {
  createElement: function (tag) {
    return { tagName: tag, src: '', alt: '' };
  }
};

var Strip = require('../js/strip.js');

// Minimal stand-in for a DOM element so the renderer can run in Node.
function FakeEl() {
  this.attrs = {};
  this.innerHTML = '';
  this.children = [];
}
FakeEl.prototype.setAttribute = function (k, v) {
  this.attrs[k] = v;
};
FakeEl.prototype.appendChild = function (child) {
  this.children.push(child);
};

var photos = ['data:photo1', 'data:photo2', 'data:photo3', 'data:photo4'];

['vertical', 'horizontal', 'grid'].forEach(function (layout) {
  var el = new FakeEl();
  Strip.renderPreview(el, layout, photos);

  assert.strictEqual(el.attrs['data-layout'], layout, layout + ': layout applied');
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

// Never render more than exactly 4, even if more are passed in.
var capped = new FakeEl();
Strip.renderPreview(capped, 'grid', ['a', 'b', 'c', 'd', 'e']);
assert.strictEqual(capped.children.length, 4, 'caps at 4');
assert.deepStrictEqual(
  capped.children.map(function (c) { return c.src; }),
  ['a', 'b', 'c', 'd'],
  'keeps the first four in order'
);

// Unknown / missing layout falls back to vertical, never a broken preview.
assert.strictEqual(Strip.layoutKey('diagonal'), 'vertical', 'unknown -> vertical');
assert.strictEqual(Strip.layoutKey(undefined), 'vertical', 'missing -> vertical');
assert.strictEqual(Strip.layoutKey('horizontal'), 'horizontal', 'horizontal passes through');
assert.strictEqual(Strip.layoutKey('grid'), 'grid', 'grid passes through');

console.log('strip layout tests passed ✓');
