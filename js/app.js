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
    shootingMode: null, //  'auto' | 'manual'
    photos: [], //         captured frames, always exactly 4 at the end (Phase 2)
    poseSequence: [], //   shuffled pose paths for this session (Phase 3)
    currentPoseIndex: 0, // position in poseSequence for the next photo
    comparePoses: true, //  Random-mode "Compare my poses" review, default ON (3.5)
    poseMatches: [] //     pose guide path per captured photo, parallel to photos (3.5)
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
  var compareOption = document.getElementById('compare-option');
  var compareSwitch = document.getElementById('compare-switch');

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
        if (slot === 'poseMode') syncCompareToggle();
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

  /* ── Compare My Poses (Phase 3.5) — Random mode only ────────────────── */
  function syncCompareToggle() {
    // The option only exists for Random poses — Free mode has no guide to compare.
    compareOption.hidden = state.poseMode !== 'random';

    var on = !!state.comparePoses;
    Array.prototype.forEach.call(
      compareSwitch.querySelectorAll('.compare-choice'),
      function (btn) {
        var val = btn.getAttribute('data-value') === 'true';
        var selected = val === on;
        btn.classList.toggle('is-selected', selected);
        btn.setAttribute('aria-checked', selected ? 'true' : 'false');
      }
    );
  }

  function wireCompareToggle() {
    var buttons = compareSwitch.querySelectorAll('.compare-choice');

    function pick(on) {
      if (!!state.comparePoses === on) return;
      state.comparePoses = on;
      syncCompareToggle();
      live.textContent = on
        ? 'Compare my poses is on — you’ll see the pose beside each photo.'
        : 'Compare my poses is off.';
    }

    compareSwitch.addEventListener('click', function (e) {
      var btn = e.target.closest('.compare-choice');
      if (!btn) return;
      pick(btn.getAttribute('data-value') === 'true');
    });

    // Radiogroup keyboard navigation, matching the option groups.
    compareSwitch.addEventListener('keydown', function (e) {
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
        buttons[next].focus();
        pick(buttons[next].getAttribute('data-value') === 'true');
      }
    });
  }

  /* ── Placeholder Start Shooting ─────────────────────────────────────── */
  function wireShoot() {
    shootBtn.addEventListener('click', function () {
      // Phase 2: hand off to the camera / shooting system.
      if (window.Shooting) {
        window.Shooting.start();
      }
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
    wireCompareToggle();
    wireNavigation();
    wireShoot();

    // Show the compare option only if Random poses is already selected.
    syncCompareToggle();

    // Sync any pre-selected state (future phases may seed it).
    Array.prototype.forEach.call(document.querySelectorAll('.options'), function (group) {
      syncGroup(group, group.getAttribute('data-slot'));
    });

    render();
  }

  init();

  /* ── Public API (consumed by later phases) ──────────────────────────── */
  window.Posebooth = {
    version: '3.5.1',
    phase: 3,
    getConfig: function () {
      return {
        participants: state.participants,
        poseMode: state.poseMode,
        layout: state.layout,
        shootingMode: state.shootingMode
      };
    },
    getSession: function () {
      return {
        participants: state.participants,
        poseMode: state.poseMode,
        layout: state.layout,
        shootingMode: state.shootingMode,
        photos: state.photos.slice(),
        poseSequence: state.poseSequence.slice(),
        currentPoseIndex: state.currentPoseIndex,
        comparePoses: state.comparePoses,
        poseMatches: state.poseMatches.slice()
      };
    },
    setPoseSequence: function (paths) {
      state.poseSequence = (paths || []).slice();
      state.currentPoseIndex = 0;
    },
    setPoseIndex: function (index) {
      state.currentPoseIndex = index;
    },
    addPhoto: function (dataUrl, poseGuide) {
      // The booth takes exactly 4 photos — never more.
      // poseGuide (optional) is the illustration shown for that shot. It is
      // stored separately from the photo and never baked into the image.
      if (state.photos.length >= 4) return state.photos.length;
      state.photos.push(dataUrl);
      state.poseMatches.push(poseGuide || null);
      return state.photos.length;
    },
    clearPhotos: function () {
      state.photos.length = 0;
      state.poseMatches.length = 0;
    },
    setComparePoses: function (on) {
      state.comparePoses = !!on;
    },
    getSummary: function () {
      return {
        participants: LABELS.participants[state.participants] || '—',
        poseMode: LABELS.poseMode[state.poseMode] || '—',
        layout: LABELS.layout[state.layout] || '—',
        shootingMode: LABELS.shootingMode[state.shootingMode] || '—'
      };
    },
    refreshSummaries: function () {
      updateSummary();
    },
    navigate: function (stepKey) {
      var idx = STEP_KEYS.indexOf(stepKey);
      if (idx !== -1) goTo(idx);
    },
    getStepIndex: function () {
      return current;
    }
  };
})();
