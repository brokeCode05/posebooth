/* ==========================================================================
   Posebooth — Phase 1 setup flow
   Vanilla JavaScript. No frameworks, no build step.

   State lives in `state` below — the single source of truth for this
   session. Later phases (camera, capture, strip generation) read the
   selections through the public API:

     Posebooth.getConfig() → {
       participants: '1' | '2' | null,
       poseMode:     'random' | 'free' | null,
       layout:       'vertical' | 'horizontal' | 'grid' | null,
       shootingMode: 'auto' | 'manual' | null
     }
   ========================================================================== */

(function () {
  'use strict';

  /* ── Session state ──────────────────────────────────────────────────── */
  var state = {
    participants: null, // '1' | '2'
    poseMode: null, //     'random' | 'free'
    layout: null, //       'vertical' | 'horizontal' | 'grid'
    shootingMode: null //  'auto' | 'manual'
  };

  /* ── Definitions ────────────────────────────────────────────────────── */
  var STEP_NAMES = ['Start', 'People', 'Poses', 'Layout', 'Mode', 'Ready'];
  var STEP_KEYS = ['start', 'people', 'poses', 'layout', 'mode', 'ready'];
  var LAST_INDEX = STEP_KEYS.length - 1;

  // Which state slot each selection step writes to.
  var SLOT_BY_STEP = {
    people: 'participants',
    poses: 'poseMode',
    layout: 'layout',
    mode: 'shootingMode'
  };

  // Human-readable labels for the summary trays and the ready receipt.
  var LABELS = {
    participants: { '1': '1 Person', '2': '2 People' },
    poseMode: { random: 'Random', free: 'Free' },
    layout: { vertical: 'Vertical', horizontal: 'Horizontal', grid: '2 × 2 Grid' },
    shootingMode: { auto: 'Auto', manual: 'Manual' }
  };

  var current = 0;

  /* ── DOM refs ───────────────────────────────────────────────────────── */
  var track = document.getElementById('steps-track');
  var stepEls = document.querySelectorAll('.step');
  var progressList = document.getElementById('progress-list');
  var summary = document.getElementById('summary');
  var controls = document.getElementById('controls');
  var backBtn = document.getElementById('btn-back');
  var nextBtn = document.getElementById('btn-next');
  var shootBtn = document.getElementById('btn-shoot');
  var shootNote = document.getElementById('shoot-note');
  var flash = document.getElementById('flash');

  // Screen-reader announcements (status = polite live region).
  var live = document.createElement('div');
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  live.className = 'sr-only';
  document.body.appendChild(live);

  /* ── Progress indicator ─────────────────────────────────────────────── */
  function buildProgress() {
    STEP_NAMES.forEach(function (name, i) {
      var li = document.createElement('li');
      li.className = 'p-step';

      var dot = document.createElement('span');
      dot.className = 'p-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.textContent = i + 1;

      var label = document.createElement('span');
      label.className = 'p-label';
      label.textContent = name;

      li.appendChild(dot);
      li.appendChild(label);
      progressList.appendChild(li);
    });
  }

  function setProgress() {
    var items = progressList.children;
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('is-done', i < current);
      items[i].classList.toggle('is-current', i === current);
    }
    // Fill the connecting line up to the current dot (line spans 8% → 92%).
    var pct = 8 + 84 * (current / LAST_INDEX);
    progressList.style.setProperty('--progress', pct + '%');
  }

  /* ── Summary trays ──────────────────────────────────────────────────── */
  function updateSummary() {
    summary.classList.toggle('is-hidden', current === 0);

    document.querySelectorAll('[data-chip]').forEach(function (dd) {
      var slot = dd.getAttribute('data-chip');
      var val = state[slot];
      dd.textContent = val ? LABELS[slot][val] : '—';
      dd.classList.toggle('is-set', !!val);
    });

    document.querySelectorAll('[data-summary]').forEach(function (strong) {
      var slot = strong.getAttribute('data-summary');
      var val = state[slot];
      strong.textContent = val ? LABELS[slot][val] : '—';
      strong.classList.toggle('is-empty', !val);
    });
  }

  /* ── Controls ───────────────────────────────────────────────────────── */
  function updateControls() {
    var isStart = current === 0;
    var isReady = current === LAST_INDEX;

    controls.classList.toggle('is-hidden', isStart);
    backBtn.disabled = isStart;

    nextBtn.classList.toggle('is-hidden', isStart || isReady);
    if (!isStart && !isReady) {
      var slot = SLOT_BY_STEP[STEP_KEYS[current]];
      nextBtn.disabled = !state[slot];
    } else {
      nextBtn.disabled = false;
    }
  }

  /* ── Rendering / navigation ─────────────────────────────────────────── */
  function render() {
    track.style.transform = 'translateX(-' + current * 100 + '%)';
    for (var i = 0; i < stepEls.length; i++) {
      stepEls[i].classList.toggle('is-active', i === current);
    }
    setProgress();
    updateControls();
    updateSummary();
  }

  function goTo(index, opts) {
    opts = opts || {};
    index = Math.max(0, Math.min(LAST_INDEX, index));
    current = index;
    render();

    if (opts.announce !== false) {
      live.textContent =
        'Step ' + (current + 1) + ' of ' + STEP_NAMES.length + ': ' + STEP_NAMES[current] + '.';
    }
    if (opts.focus !== false) {
      var step = stepEls[current];
      if (step) step.focus({ preventScroll: true });
    }
  }

  /* ── Option selection ───────────────────────────────────────────────── */
  function syncGroup(group, slot) {
    Array.prototype.forEach.call(group.querySelectorAll('.option'), function (btn) {
      var on = btn.getAttribute('data-value') === state[slot];
      btn.classList.toggle('is-selected', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function wireOptions() {
    Array.prototype.forEach.call(document.querySelectorAll('.options'), function (group) {
      var slot = group.getAttribute('data-slot');
      var buttons = group.querySelectorAll('.option');

      function select(btn, focus) {
        var value = btn.getAttribute('data-value');
        if (state[slot] === value) return;
        state[slot] = value;
        syncGroup(group, slot);
        updateControls();
        updateSummary();
        if (focus) btn.focus();
        live.textContent = LABELS[slot][value] + ' selected.';
      }

      group.addEventListener('click', function (e) {
        var btn = e.target.closest('.option');
        if (btn) select(btn, false);
      });

      // Radiogroup keyboard navigation.
      group.addEventListener('keydown', function (e) {
        var active = document.activeElement;
        var idx = Array.prototype.indexOf.call(buttons, active);
        if (idx === -1) return;

        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          next = (idx + 1) % buttons.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          next = (idx - 1 + buttons.length) % buttons.length;
        } else if (e.key === 'Home') {
          next = 0;
        } else if (e.key === 'End') {
          next = buttons.length - 1;
        }

        if (next !== null) {
          e.preventDefault();
          select(buttons[next], true);
        }
      });
    });
  }

  /* ── Placeholder Start Shooting ─────────────────────────────────────── */
  function wireShoot() {
    shootBtn.addEventListener('click', function () {
      // Re-trigger the flash animation, then reveal the Phase 2 note.
      flash.classList.remove('go');
      void flash.offsetWidth;
      flash.classList.add('go');
      setTimeout(function () {
        flash.classList.remove('go');
      }, 650);
      shootNote.hidden = false;
    });
  }

  /* ── Wiring ─────────────────────────────────────────────────────────── */
  function wireNavigation() {
    backBtn.addEventListener('click', function () {
      goTo(current - 1);
    });

    nextBtn.addEventListener('click', function () {
      // Belt-and-braces guard: never advance past an unanswered step.
      var slot = SLOT_BY_STEP[STEP_KEYS[current]];
      if (slot && !state[slot]) return;
      goTo(current + 1);
    });

    // data-goto elements (Start button, logo) jump straight to a step.
    document.addEventListener('click', function (e) {
      var el = e.target.closest('[data-goto]');
      if (!el) return;
      e.preventDefault();
      var idx = STEP_KEYS.indexOf(el.getAttribute('data-goto'));
      if (idx !== -1) goTo(idx);
    });
  }

  /* ── Init ───────────────────────────────────────────────────────────── */
  function init() {
    buildProgress();
    wireOptions();
    wireNavigation();
    wireShoot();

    // Sync any pre-selected state (future phases may seed it).
    Array.prototype.forEach.call(document.querySelectorAll('.options'), function (group) {
      syncGroup(group, group.getAttribute('data-slot'));
    });

    render();
  }

  init();

  /* ── Public API (consumed by later phases) ──────────────────────────── */
  window.Posebooth = {
    version: '1.0.0',
    phase: 1,
    getConfig: function () {
      return {
        participants: state.participants,
        poseMode: state.poseMode,
        layout: state.layout,
        shootingMode: state.shootingMode
      };
    },
    getStepIndex: function () {
      return current;
    }
  };
})();
