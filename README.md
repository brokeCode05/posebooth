# Posebooth — Phase 1

A playful, modern digital photobooth. **Phase 1** ships only the setup flow — no camera, no capture, no strip generation yet.

## Setup flow

```
START → People → Pose Mode → Layout → Shooting Mode → READY (placeholder)
```

## Files

```
posebooth/
├── index.html   # The whole Phase 1 UI (six step slides, progress, controls)
├── css/
│   └── style.css
└── js/
    └── app.js   # State, navigation, selection wiring, public API
```

## State & navigation

- All selections live in a single `state` object in `js/app.js`
  (`participants`, `poseMode`, `layout`, `shootingMode`).
- Steps slide horizontally on a flex track (`#steps-track`); the current
  index is `current`.
- **Continue** is disabled until the current step's selection is made.
  **Back** always works. The **Start** screen shows no footer controls.
- The progress dots and the selections tray above the steps update live.
- Later phases read the session via:

```js
Posebooth.getConfig() // → { participants, poseMode, layout, shootingMode }
```

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080   # then visit http://localhost:8080
```

## Planned for later phases

- Webcam (getUserMedia) + capture
- Visual pose guides (illustrations supplied separately)
- Random pose selection
- Photo strip layout rendering + download
