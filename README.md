# Posebooth

A playful, modern digital photobooth. Built by hand with HTML, CSS and JavaScript — no frameworks, no backend.

## Phases

**Phase 1 — Setup flow (done):** `START → People → Pose Mode → Layout → Shooting Mode → READY`. All selections are saved into session state.

**Phase 2 — Camera + shooting system (done):** the READY screen launches a real camera session. Live webcam preview, Manual (shutter) or Auto (3·2·1 countdown) shooting, exactly **4 photos** captured to canvas and held in session state, a flash on each capture, camera-error recovery screens, and a "4 PHOTOS CAPTURED" completion view.

## Files

```
posebooth/
├── index.html      # Project page + setup wizard + shooting/completion views
├── css/
│   └── style.css   # Minimal light design system + camera UI
├── js/
│   ├── app.js      # Phase 1 state, navigation, public Posebooth API
│   └── camera.js   # Phase 2: getUserMedia, capture, countdown, cleanup
└── README.md
```

## State & navigation

- All session data lives in one `state` object in `js/app.js`:
  `participants`, `poseMode`, `layout`, `shootingMode`, `photos[]`.
- Setup steps slide on a flex track; Continue is disabled until a step is answered.
- The shooting view takes over the card (setup chrome is hidden) and hands back to READY on cancel.
- Later phases read the whole session via:

```js
Posebooth.getSession() // → { participants, poseMode, layout, shootingMode, photos }
Posebooth.getConfig()  // → the four Phase 1 selections
```

Photos are pushed with `Posebooth.addPhoto(dataUrl)` and capped at **exactly 4**.

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

- Visual pose guides (illustrations supplied separately)
- Random pose selection
- Photo strip layout rendering + download
- Filters / effects / customization
