# Posebooth

A playful, modern digital photobooth. Built by hand with HTML, CSS and JavaScript — no frameworks, no backend.

## Phases

**Phase 1 — Setup flow (done):** `START → People → Pose Mode → Layout → Shooting Mode → READY`. All selections are saved into session state.

**Phase 2 — Camera + shooting system (done):** the READY screen launches a real camera session. Live webcam preview, Manual (shutter) or Auto (3·2·1 countdown) shooting, exactly **4 photos** captured to canvas and held in session state, a flash on each capture, camera-error recovery screens, and a "4 PHOTOS CAPTURED" completion view.

**Phase 3 — Visual pose system (done):** in **Random** mode, one of the four supplied pose illustrations is shown below the camera before each shot — all four poses used exactly once, in a shuffled per-session order, pulled from the folder matching the participant count (`poses/1per/` for 1 person, `poses/2per/` for 2 people). **Free** mode loads nothing and shows "Your pose, your rules." Poses are a visual guide only and never appear in the captured photo.

**Phase 3.5 — Compare My Poses (done):** when **Random** poses are on, a friendly **On/Off** option (default On) adds one final "how did I do?" moment. Shooting stays continuous — all four photos are captured back-to-back with no interruptions. After the 4th photo, a single comparison shows the complete pose guide beside the complete set of photos, both arranged in the Phase 1 layout choice (vertical, horizontal, or 2×2). Off (or Free mode) keeps the plain pose-free review. Poses are stored separately from photos (`poseMatches[]`) and are never baked into a captured image or the eventual strip.

## Files

```
posebooth/
├── index.html      # Project page + setup wizard + shooting/completion views
├── css/
│   └── style.css   # Minimal light design system + camera UI
├── js/
│   ├── app.js      # Phase 1 state, navigation, public Posebooth API
│   └── camera.js   # Phases 2–3.5: getUserMedia, capture, countdown, poses, compare
└── README.md
```

## State & navigation

- All session data lives in one `state` object in `js/app.js`:
  `participants`, `poseMode`, `layout`, `shootingMode`, `photos[]`,
  `poseSequence`, `currentPoseIndex`, `comparePoses`, `poseMatches[]`.
- Setup steps slide on a flex track; Continue is disabled until a step is answered.
- The shooting view takes over the card (setup chrome is hidden) and hands back to READY on cancel.
- Later phases read the whole session via:

```js
Posebooth.getSession() // → { participants, poseMode, layout, shootingMode, photos,
                        //     poseSequence, currentPoseIndex, comparePoses, poseMatches }
Posebooth.getConfig()  // → the four Phase 1 selections
```

Photos are pushed with `Posebooth.addPhoto(dataUrl, poseGuide?)` and capped at **exactly 4**; the optional pose path is recorded separately in `poseMatches[]`.

## Pose notes

- Random sessions shuffle `[p1, p2, p3, p4]` (Fisher–Yates) once at start; the order stays fixed for the session.
- The pose image advances after each capture; Free mode never requests a pose asset.
- **Compare My Poses** (Random only, default On) shows ONE final comparison after all four photos: the pose guide and your photos side by side, each laid out in the Phase 1 layout choice. Shooting is never interrupted. Poses and photos are kept as separate data — the illustration is UI only.

## Camera notes

- Access is requested only when the user presses **Start Shooting**.
- Manual: the user presses the shutter for every photo. Auto: a fixed 3·2·1 countdown fires each photo automatically.
- Permission denied, no camera, busy camera, and unsupported-browser cases each show a clear message with **Try again** / **Back to setup** actions.
- The stream is stopped on completion, cancel, retry, and when the page is hidden/closed.
- Photos are in-memory data URLs — nothing is uploaded.

## Run it

Camera access requires a secure context (`https://` or `http://localhost`):

```bash
cd /home/bryan/Documents/Testing/posebooth
python3 -m http.server 8080    # then open http://localhost:8080
```

## Planned for later phases

- Photo strip layout rendering + download
- Filters / effects / customization
