/* ==========================================================================
   Posebooth — Phase 2: Camera + shooting system.
   Vanilla JavaScript. No frameworks.

   The user takes EXACTLY 4 photos — never 3, never 5.
   Photos stay local to the browser session (in-memory data URLs).

   Reads Phase 1 selections via Posebooth.getConfig() and stores captured
   frames through Posebooth.addPhoto(). All camera streams are stopped when
   the shooting session ends, is cancelled, or the page is hidden/closed.
   ========================================================================== */

(function () {
  'use strict';

  var PHOTO_LIMIT = 4; // the rule: exactly four photos.
  var COUNTDOWN_FROM = 3; // auto mode default countdown.
  var COUNTDOWN_TICK_MS = 1000;
  var PAUSE_AFTER_CAPTURE_MS = 450;

  // Pose illustrations — exactly as provided in /poses. One set per
  // participant count; a random session uses all four exactly once.
  var POSE_FILES = {
    '1': ['poses/1per/p1.png', 'poses/1per/p2.png', 'poses/1per/p3.png', 'poses/1per/p4.png'],
    '2': ['poses/2per/p1.jpg', 'poses/2per/p2.jpg', 'poses/2per/p3.jpg', 'poses/2per/p4.jpg']
  };

  var session = {
    stream: null,
    mode: 'manual', // 'auto' | 'manual' — set from Phase 1 state
    countdownTimer: null,
    capturing: false,
    active: false,
    currentPosePath: null // pose guide shown for the next capture (Phase 3)
  };

  var els = null;

  /* ── DOM ────────────────────────────────────────────────────────────── */
  function cacheEls() {
    els = {
      booth: document.getElementById('booth'),
      shootView: document.getElementById('shoot-view'),
      top: document.getElementById('shoot-top'),
      stage: document.getElementById('shoot-stage'),
      video: document.getElementById('shoot-video'),
      count: document.getElementById('shoot-count'),
      countdown: document.getElementById('shoot-countdown'),
      progress: document.getElementById('shoot-progress'),
      actions: document.getElementById('shoot-actions'),
      poseGuide: document.getElementById('pose-guide'),
      poseImg: document.getElementById('pose-img'),
      poseFree: document.getElementById('pose-free'),
      capture: document.getElementById('btn-capture'),
      hint: document.getElementById('shoot-hint'),
      cancel: document.getElementById('shoot-cancel'),
      starting: document.getElementById('shoot-starting'),
      error: document.getElementById('shoot-error'),
      errorTitle: document.getElementById('shoot-error-title'),
      errorMsg: document.getElementById('shoot-error-msg'),
      retry: document.getElementById('shoot-retry'),
      backSetup: document.getElementById('shoot-back-setup'),
      done: document.getElementById('shoot-done'),
      doneThumbs: document.getElementById('done-thumbs'),
      doneSub: document.getElementById('done-sub'),
      doneCompare: document.getElementById('done-compare'),
      poseLayout: document.getElementById('done-pose-layout'),
      photoLayout: document.getElementById('done-photo-layout'),
      doneRestart: document.getElementById('btn-done-restart'),
      doneBtn: document.getElementById('btn-done'),
      flash: document.getElementById('flash')
    };
  }

  /* ── Public entry point (wired from the Ready screen) ───────────────── */
  function start() {
    if (!window.Posebooth) return;
    if (!els) cacheEls();
    if (session.active) return; // already shooting

    session.mode = Posebooth.getConfig().shootingMode === 'auto' ? 'auto' : 'manual';
    session.active = true;

    Posebooth.clearPhotos(); // fresh session: exactly 4 new photos
    resetView();
    setupPoses();
    enterShooting();
    stopStream(); // safety: never inherit a stale stream
    requestCamera();
  }

  /* ── Camera access ──────────────────────────────────────────────────── */
  function requestCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showError(
        'Camera not supported',
        'This browser does not support camera access. Try a recent version of Chrome, Edge, Firefox or Safari.',
        false
      );
      return;
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      })
      .then(onStream)
      .catch(onError);
  }

  function onStream(stream) {
    session.stream = stream;
    els.video.srcObject = stream;
    els.video.play().catch(function () {
      /* muted + playsinline autoplay is generally allowed; ignore */
    });
    hideOverlay(els.starting);
    hideOverlay(els.error);
    updatePhotoUI();
    setupModeUI();

    if (session.mode === 'auto') {
      scheduleCountdown();
    }
  }

  function retryCamera() {
    hideOverlay(els.error);
    showOverlay(els.starting);
    stopStream();
    requestCamera();
  }

  /* ── Error handling — never leave a blank screen ────────────────────── */
  function onError(err) {
    var title;
    var msg;
    var name = err && err.name;

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      title = 'Camera permission denied';
      msg =
        'Posebooth needs your camera to shoot. Allow camera access in the browser prompt or in the site’s camera settings, then try again.';
    } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
      title = 'No camera found';
      msg = 'No camera was detected on this device. Connect one or check your device settings, then try again.';
    } else if (name === 'NotReadableError' || name === 'TrackStartError') {
      title = 'Camera is busy';
      msg = 'Your camera appears to be in use by another application. Close it, then try again.';
    } else if (name === 'AbortError') {
      title = 'Camera access interrupted';
      msg = 'The camera request was interrupted. Please try again.';
    } else {
      title = 'Camera unavailable';
      msg = 'Something went wrong while starting the camera. Please try again.';
    }

    hideOverlay(els.starting);
    showError(title, msg);
  }

  /* ── Pose guide (Phase 3) ──────────────────────────────────────────── */
  function setupPoses() {
    var cfg = Posebooth.getConfig();
    session.currentPosePath = null;

    if (cfg.poseMode === 'random') {
      // Use the folder that matches the Phase 1 participant count and shuffle
      // the four poses so every pose appears exactly once, in random order.
      var paths = POSE_FILES[cfg.participants] || POSE_FILES['1'];
      var seq = shuffle(paths.slice());
      Posebooth.setPoseSequence(seq);
      els.poseGuide.hidden = false;
      showPose(0);
    } else {
      // Free mode: no pose assets are loaded or displayed.
      Posebooth.setPoseSequence([]);
      els.poseGuide.hidden = false;
      els.poseFree.hidden = false;
    }
  }

  function showPose(index) {
    var seq = Posebooth.getSession().poseSequence;
    if (!seq.length) return;
    els.poseGuide.hidden = false;
    Posebooth.setPoseIndex(index);
    session.currentPosePath = seq[index];
    els.poseImg.hidden = false;
    els.poseFree.hidden = true;
    els.poseImg.src = seq[index];
    // Quick, subtle swap so the next pose is read immediately.
    els.poseImg.classList.remove('swap');
    void els.poseImg.offsetWidth;
    els.poseImg.classList.add('swap');
  }

  function advancePose() {
    var taken = Posebooth.getSession().photos.length;
    if (Posebooth.getConfig().poseMode === 'random' && taken < PHOTO_LIMIT) {
      showPose(taken);
    }
  }

  /* ── Compare My Poses (Phase 3.5) ──────────────────────────────────── */
  // ONE final comparison after all four photos: the complete pose guide
  // next to the complete set of photos, both arranged in the Phase 1
  // layout choice. UI only — the photos stay clean and the strip will
  // never include the poses.
  function buildFinalCompare(layout, s) {
    var layoutKey = layout || 'horizontal';
    els.poseLayout.setAttribute('data-layout', layoutKey);
    els.photoLayout.setAttribute('data-layout', layoutKey);
    els.poseLayout.innerHTML = '';
    els.photoLayout.innerHTML = '';

    s.photos.forEach(function (src, i) {
      var n = i + 1;

      var poseCell = document.createElement('span');
      poseCell.className = 'compare-cell';
      var poseImg = document.createElement('img');
      if (s.poseMatches[i]) {
        poseImg.src = s.poseMatches[i];
      } else {
        poseImg.hidden = true;
      }
      poseImg.alt = 'Pose ' + n;
      poseCell.appendChild(poseImg);
      poseCell.appendChild(numberBadge(n));
      els.poseLayout.appendChild(poseCell);

      var photoCell = document.createElement('span');
      photoCell.className = 'compare-cell';
      var photoImg = document.createElement('img');
      photoImg.src = src;
      photoImg.alt = 'Your photo ' + n;
      photoCell.appendChild(photoImg);
      photoCell.appendChild(numberBadge(n));
      els.photoLayout.appendChild(photoCell);
    });
  }

  // Subtle 1–4 chip so pose and photo positions scan at a glance.
  function numberBadge(n) {
    var b = document.createElement('i');
    b.className = 'compare-n';
    b.textContent = n;
    return b;
  }

  function shuffle(arr) {
    // Fisher–Yates: a random permutation, never repeated poses.
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  /* ── Modes ──────────────────────────────────────────────────────────── */
  function setupModeUI() {
    if (session.mode === 'manual') {
      els.capture.hidden = false;
      els.hint.textContent = 'Press the shutter when you’re ready.';
    } else {
      els.capture.hidden = true;
      els.hint.textContent = 'Auto — the booth counts you down.';
    }
    els.hint.hidden = false;
  }

  function scheduleCountdown() {
    var n = COUNTDOWN_FROM;
    showCountdown(n);
    session.countdownTimer = setInterval(function () {
      n -= 1;
      if (n <= 0) {
        clearInterval(session.countdownTimer);
        session.countdownTimer = null;
        hideCountdown();
        capture();
      } else {
        showCountdown(n);
      }
    }, COUNTDOWN_TICK_MS);
  }

  function showCountdown(n) {
    els.countdown.textContent = n;
    els.countdown.hidden = false;
    els.countdown.classList.remove('tick');
    void els.countdown.offsetWidth; // restart the tick animation
    els.countdown.classList.add('tick');
  }

  function hideCountdown() {
    els.countdown.hidden = true;
  }

  /* ── Capture ────────────────────────────────────────────────────────── */
  function capture() {
    if (session.capturing || !session.active) return;
    var video = els.video;
    if (!video || !video.videoWidth || !video.videoHeight) {
      // Camera frame not ready yet — back off instead of freezing.
      backOffCapture();
      return;
    }

    session.capturing = true;
    els.capture.disabled = true;

    var canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    var ctx = canvas.getContext('2d');
    if (!ctx) {
      backOffCapture();
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    var dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    var taken = Posebooth.addPhoto(dataUrl, session.currentPosePath);
    flashOnce();
    updatePhotoUI();
    session.capturing = false;

    // All four photos shoot back-to-back without interruption — the only
    // comparison happens once, in the final review.
    if (taken >= PHOTO_LIMIT) {
      finish();
      return;
    }

    advancePose();
    if (session.mode === 'auto') {
      setTimeout(function () {
        if (session.active) scheduleCountdown();
      }, PAUSE_AFTER_CAPTURE_MS);
    } else {
      els.capture.disabled = false;
    }
  }

  function flashOnce() {
    els.flash.classList.remove('go');
    void els.flash.offsetWidth;
    els.flash.classList.add('go');
    setTimeout(function () {
      els.flash.classList.remove('go');
    }, 520);
  }

  /* ── UI helpers ─────────────────────────────────────────────────────── */
  function updatePhotoUI() {
    var taken = Posebooth.getSession().photos.length;
    var next = Math.min(taken + 1, PHOTO_LIMIT);
    els.count.textContent = 'PHOTO ' + next + ' / ' + PHOTO_LIMIT;

    var ticks = els.progress.children;
    for (var i = 0; i < ticks.length; i++) {
      ticks[i].classList.toggle('is-filled', i < taken);
    }
    els.progress.setAttribute('aria-label', 'Photos captured: ' + taken + ' of ' + PHOTO_LIMIT);
  }

  function showOverlay(el) {
    el.hidden = false;
  }

  function hideOverlay(el) {
    el.hidden = true;
  }

  function showError(title, msg, canRetry) {
    els.errorTitle.textContent = title;
    els.errorMsg.textContent = msg;
    // "Try again" only makes sense when a retry could actually succeed.
    els.retry.hidden = canRetry === false;
    els.error.hidden = false;
  }

  // Shared "could not grab this frame" path — never freeze or over-capture.
  function backOffCapture() {
    session.capturing = false;
    if (session.mode === 'auto' && session.active) {
      scheduleCountdown();
    }
  }

  function resetView() {
    hideOverlay(els.starting);
    hideOverlay(els.error);
    hideCountdown();
    els.done.hidden = true;
    els.hint.hidden = true;
    els.capture.hidden = true;
    els.capture.disabled = false;
    els.doneThumbs.innerHTML = '';
    els.doneThumbs.removeAttribute('data-layout');
    els.doneThumbs.hidden = false;
    els.doneSub.textContent = 'Your four photos are captured — next up, customization.';
    els.doneCompare.innerHTML = '';
    els.doneCompare.hidden = true;
    els.poseLayout.innerHTML = '';
    els.photoLayout.innerHTML = '';
    session.currentPosePath = null;
    // Restore the shooting chrome for the next session.
    els.top.hidden = false;
    els.stage.hidden = false;
    els.progress.hidden = false;
    els.actions.hidden = false;
    els.poseGuide.hidden = true;
    els.poseImg.hidden = true;
    els.poseImg.removeAttribute('src');
    els.poseFree.hidden = false;
    els.count.textContent = 'PHOTO 1 / ' + PHOTO_LIMIT;
    var ticks = els.progress.children;
    for (var i = 0; i < ticks.length; i++) {
      ticks[i].classList.remove('is-filled');
    }
  }

  function enterShooting() {
    els.booth.classList.add('is-shooting');
    els.shootView.hidden = false;
  }

  function exitShooting() {
    session.active = false;
    clearInterval(session.countdownTimer);
    session.countdownTimer = null;
    stopStream();
    els.booth.classList.remove('is-shooting');
    els.shootView.hidden = true;
    resetView();
  }

  /* ── Completion (exactly 4 photos) ──────────────────────────────────── */
  function finish() {
    stopStream();
    hideCountdown();
    els.capture.hidden = true;
    els.hint.hidden = true;

    // The camera work is over — remove the shooting chrome so no empty
    // camera rectangle is left behind. Hiding these reclaims their space.
    els.top.hidden = true;
    els.stage.hidden = true;
    els.poseGuide.hidden = true;
    els.progress.hidden = true;
    els.actions.hidden = true;

    var cfg = Posebooth.getConfig();
    var s = Posebooth.getSession();

    if (cfg.poseMode === 'random' && s.comparePoses) {
      // One "how did I do?" moment: the whole pose guide beside the whole
      // set of photos, both laid out exactly as the user picked.
      els.doneSub.textContent = 'The pose versus the photo — how did you do?';
      els.doneThumbs.hidden = true;
      buildFinalCompare(cfg.layout, s);
      els.doneCompare.hidden = false;
    } else {
      // Plain review: the four photos mirror the Phase 1 layout choice.
      els.doneSub.textContent = 'Your four photos are captured — next up, customization.';
      els.doneCompare.hidden = true;
      els.doneThumbs.hidden = false;
      els.doneThumbs.setAttribute('data-layout', cfg.layout || 'horizontal');
      s.photos.forEach(function (src) {
        var img = document.createElement('img');
        img.src = src;
        img.alt = 'Captured photo';
        els.doneThumbs.appendChild(img);
      });
    }

    Posebooth.refreshSummaries(); // fill the session receipt
    els.done.hidden = false;
  }

  /* ── Cleanup ────────────────────────────────────────────────────────── */
  function stopStream() {
    if (session.stream) {
      session.stream.getTracks().forEach(function (track) {
        track.stop();
      });
      session.stream = null;
    }
    if (els && els.video) {
      els.video.srcObject = null;
    }
  }

  function cancel() {
    exitShooting();
    if (window.Posebooth) Posebooth.navigate('ready');
  }

  /* ── Wiring ─────────────────────────────────────────────────────────── */
  function init() {
    cacheEls();

    // If a pose asset is ever missing, hide it gracefully instead of
    // showing a broken-image icon.
    els.poseImg.onerror = function () {
      els.poseImg.hidden = true;
    };

    els.capture.addEventListener('click', capture);
    els.cancel.addEventListener('click', cancel);
    els.retry.addEventListener('click', retryCamera);
    els.backSetup.addEventListener('click', cancel);
    els.doneBtn.addEventListener('click', function () {
      // Placeholder — Phase 4 implements strip customization.
    });
    els.doneRestart.addEventListener('click', function () {
      if (window.Posebooth) Posebooth.clearPhotos();
      exitShooting();
      if (window.Posebooth) Posebooth.navigate('ready');
    });

    // Never leave a camera running after the page is hidden or closed.
    window.addEventListener('pagehide', function () {
      stopStream();
    });
  }

  init();

  /* ── Public API ─────────────────────────────────────────────────────── */
  window.Shooting = {
    start: start,
    stop: stopStream,
    isActive: function () {
      return session.active;
    }
  };
})();
