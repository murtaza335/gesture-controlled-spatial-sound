# Implementation Plan: Gesture-Controlled Spatial Audio Mixer

This plan is written for an AI coding agent (Claude Sonnet) to implement the project end to end. The product requirements live in `project-document.html` in this folder (FR-xx / NFR-xx IDs are referenced below). Every decision that would otherwise need guessing is fixed here. If something is still ambiguous, choose the simplest option that satisfies the acceptance criteria and note it in `NOTES.md`.

---

## 0. Rules for the implementing agent

1. **Work phase by phase** (Section 9). Do not start a phase until the previous phase's acceptance criteria pass. Phases 1–3 are the core; Phases 4–6 build on them.
2. **After every phase run** `npm run build` and `npm test`. Both must pass with no errors before moving on.
3. **You cannot see the camera or hear the audio.** Each phase ends with a *Human check* list. When you finish a phase, stop and ask the user to run `npm run dev` and go through that list. Fix what they report before continuing.
4. **The mouse simulator (Section 5.3) is your test harness.** Every feature driven by hands must also be drivable by mouse and keyboard, so you and the user can test without a camera.
5. **Dependencies:** use only the packages listed in Section 2. Do not add React, Vue, state libraries or CSS frameworks. Install the latest stable version of each and pin exact versions in `package.json` (no `^` or `~`).
6. **All tunable numbers live in `src/config.js`.** No magic numbers in other modules.
7. **Never set `AudioParam.value` inside the animation loop.** Always use `setTargetAtTime` (Section 6.4) to avoid clicks (NFR-03).
8. **Keep modules pure where possible.** Gesture recognition, filtering and mapping must be pure functions/classes with no DOM or audio access, so they can be unit tested.
9. If the folder is not a git repo, ask the user whether to run `git init`. If it is, commit at the end of each phase with a message like `Phase 2: spatial audio engine`.
10. Leave `project-document.html` in place; do not modify it.

---

## 1. Product summary (what you are building)

A single-page browser app:

- The webcam tracks both hands (MediaPipe Hand Landmarker).
- **Right hand = where the sound is.** Pinch to grab a sound source, move the hand to move the source around the listener's head. Left/right → azimuth, up/down → elevation, closer/farther from camera → distance. Audio is rendered binaurally (Web Audio `PannerNode`, HRTF) for headphones.
- **Left hand = how it sounds.** Hold up 1–5 fingers to select a parameter (Bass, Treble, Pitch, Filter, Reverb), then pinch and drag up/down to change it. Make a fist to reset the selected parameter.
- **Visuals:** camera preview with hand skeleton, a 2D "stage" showing sources and the hand cursor, a Three.js 3D scene (listener head, pulsing frequency ring, glowing sources), and a waveform + spectrum strip.
- **Baseline + study tools:** a slider panel with the same controls, an accessibility mode with audio cues, a sound-localization test, a task runner and CSV logging.
- Built-in **procedurally generated demo tracks** (no audio asset files needed) plus user file upload.

---

## 2. Tech stack and setup

| Package | Purpose |
|---|---|
| `vite` (dev) | Dev server and build |
| `vitest` (dev) | Unit tests |
| `@mediapipe/tasks-vision` | Hand Landmarker (and Face Landmarker for head tracking) |
| `three` | 3D scene |
| `tone` | Only for pitch-only shifting (Phase 6, optional) |

Plain JavaScript ES modules with JSDoc types. Add `// @ts-check` at the top of pure modules. No TypeScript build step.

### 2.1 Setup steps

```bash
npm create vite@latest . -- --template vanilla   # if the folder is not empty, scaffold manually instead
npm install @mediapipe/tasks-vision three
npm install -D vite vitest
```

If `create vite` refuses because the folder is not empty, create `package.json`, `index.html`, `vite.config.js` and `src/main.js` by hand.

`package.json` scripts:

```json
{
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "postinstall": "node scripts/copy-mediapipe.mjs"
  }
}
```

### 2.2 MediaPipe assets (serve locally, no runtime CDN)

- `scripts/copy-mediapipe.mjs`: copy `node_modules/@mediapipe/tasks-vision/wasm/*` into `public/mediapipe/wasm/`. Create the directory if needed. Must be idempotent.
- Download the model once into `public/models/hand_landmarker.task`:
  `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
- (Phase 6) Face model into `public/models/face_landmarker.task`:
  `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
- Add `public/mediapipe/` to `.gitignore` (regenerated on install). Commit the `.task` model files or document the download in `README.md`; ask the user which they prefer.
- In code: `FilesetResolver.forVisionTasks('/mediapipe/wasm')` and `modelAssetPath: '/models/hand_landmarker.task'`. Use `import.meta.env.BASE_URL` as the prefix so it also works when deployed under a sub-path.

### 2.3 Vite config

```js
// vite.config.js
import { defineConfig } from 'vite';
export default defineConfig({
  server: { host: 'localhost', port: 5173 },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
```

Camera access requires `localhost` or HTTPS. Free static hosts (GitHub Pages, Netlify) provide HTTPS for deployment.

---

## 3. Folder structure

```
gesture-controlled-spatial-sound/
├── index.html
├── package.json
├── vite.config.js
├── README.md                    how to run, controls, troubleshooting
├── NOTES.md                     decisions you made that this plan did not fix
├── IMPLEMENTATION_PLAN.md       this file
├── project-document.html        requirements (do not edit)
├── scripts/
│   └── copy-mediapipe.mjs
├── public/
│   ├── models/                  hand_landmarker.task, face_landmarker.task
│   └── mediapipe/wasm/          copied at install
├── src/
│   ├── main.js                  boot, start button, main loop
│   ├── config.js                all tunable constants
│   ├── state/
│   │   └── store.js             tiny observable app state
│   ├── input/
│   │   ├── camera.js            getUserMedia wrapper
│   │   ├── handTracker.js       MediaPipe Hand Landmarker wrapper → HandFrame
│   │   ├── headTracker.js       (Phase 6) Face Landmarker → yaw
│   │   ├── mouseSimulator.js    fake HandFrame from mouse/keyboard
│   │   └── handFrame.js         normalization, mirroring, handedness assignment
│   ├── filters/
│   │   └── oneEuroFilter.js
│   ├── gestures/
│   │   ├── features.js          pure: pinch ratio, finger states, hand scale
│   │   ├── recognizer.js        pure: per-hand gesture state machines
│   │   └── calibration.js       calibration flow + persistence
│   ├── mapping/
│   │   └── handToAudio.js       pure: hand → az/el/dist, value curves, spherical → xyz
│   ├── controller/
│   │   └── controller.js        gesture events → state changes → audio calls
│   ├── audio/
│   │   ├── engine.js            AudioContext, master bus, analyser, track loading
│   │   ├── soundSource.js       per-source node chain
│   │   ├── demoTracks.js        procedural stems via OfflineAudioContext
│   │   ├── impulse.js           synthetic reverb impulse response
│   │   ├── params.js            parameter definitions (ranges, defaults, curves)
│   │   └── earcons.js           accessibility audio cues
│   ├── visuals/
│   │   ├── overlay2d.js         camera preview + skeleton
│   │   ├── stage2d.js           2D stage: sources + cursor
│   │   ├── scope.js             waveform + spectrum strip
│   │   ├── scene3d.js           Three.js scene
│   │   └── color.js             pure: spectrum → hue/brightness
│   ├── ui/
│   │   ├── layout.css
│   │   ├── panel.js             sliders baseline + settings
│   │   ├── hud.js               gesture hints, selected param, status
│   │   ├── debug.js             debug panel (fps, raw vs filtered, live tuning)
│   │   ├── keyboard.js          shortcuts
│   │   └── accessibility.js     audio-first mode, speech, ARIA live region
│   └── study/
│       ├── logger.js            event log + CSV export
│       ├── localizationTest.js
│       └── taskRunner.js
└── tests/
    ├── fixtures/handFixtures.js  synthetic landmark sets
    ├── oneEuroFilter.test.js
    ├── features.test.js
    ├── recognizer.test.js
    ├── handToAudio.test.js
    ├── color.test.js
    └── logger.test.js
```

---

## 4. Architecture

### 4.1 Main loop (one `requestAnimationFrame` loop)

```
now = performance.now()
frame   = input.getFrame(now)          // HandFrame from camera tracker OR mouse simulator
frame   = smoother.apply(frame, now)   // One Euro per landmark coordinate
gests   = recognizer.update(frame, now)// { left: LeftGestureState, right: RightGestureState, events: [] }
controller.update(gests, frame, now)   // mutates store, calls audio engine
visuals.render(store.state, engine.analysers, frame)
debug.update(...)
```

- Hand tracking runs inside `input.getFrame`: call `detectForVideo` only when `video.currentTime` has changed since the last call; otherwise return the previous HandFrame (with its original timestamp).
- Render loop must not stall if tracking is slow; tracking time per frame is measured and shown in the debug panel.

### 4.2 Core data types (JSDoc in `src/input/handFrame.js`)

```js
/** @typedef {{x:number, y:number, z:number}} Point   // x,y in [0,1] user-view coords (already mirrored), y down; z relative depth */
/**
 * @typedef {Object} HandData
 * @property {'left'|'right'} side     // the USER's hand
 * @property {Point[]} lm              // 21 landmarks, mirrored
 * @property {number} score            // handedness confidence
 */
/**
 * @typedef {Object} HandFrame
 * @property {number} t                // ms timestamp
 * @property {HandData|null} left
 * @property {HandData|null} right
 * @property {'camera'|'mouse'} source
 */
```

### 4.3 App state (`src/state/store.js`)

A minimal store: `createStore(initial)` returning `{ state, set(patch), subscribe(fn) }`. `set` shallow-merges and notifies. State shape:

```js
{
  started: false,
  inputMode: 'camera' | 'mouse',
  spatialMode: 'hrtf' | 'stereo',
  trackIndex: 0,
  tracks: [ { name, stems: [ { name } ] } ],
  sources: [ { id, name, az, el, dist, params: { bass, mid, treble, pitch, filter, reverb, gain } } ],
  focusedSourceId: 0,          // last grabbed; tone controls apply here
  applyToneTo: 'focused' | 'all',
  grabbedSourceId: null,
  selectedParam: 'bass',
  cursor: { right: {az, el, dist} | null, left: {...} | null },
  playing: true,
  a11yMode: false,
  debug: false,
  quality: 'high' | 'low',     // low = 2D stage only, no Three.js
  calibration: { ...see config MAP },
  study: { participantId: '', condition: 'gesture' | 'slider', running: null }
}
```

### 4.4 Module boundaries

- `input/*` knows about camera and MediaPipe. Outputs HandFrame only.
- `filters/*`, `gestures/features.js`, `gestures/recognizer.js`, `mapping/*`, `visuals/color.js` are **pure** (no DOM, no audio). Unit tested.
- `controller` is the only module that turns gestures into state and audio calls.
- `audio/*` exposes a small API (Section 6.6). Nothing else touches audio nodes.
- `visuals/*` only read state and analyser data.

---

## 5. Input

### 5.1 Camera (`src/input/camera.js`)

```js
export async function startCamera(videoEl) // returns MediaStream
```
- `getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })`.
- Errors: show a clear message in the HUD: permission denied → "Camera blocked. Allow camera access in the address bar, then press Start again." No camera → "No camera found. Switch to mouse mode with M." Then automatically fall back to mouse mode.

### 5.2 Hand tracker (`src/input/handTracker.js`)

```js
export async function createHandTracker(videoEl) // → { getFrame(now): HandFrame, close() }
```
- `HandLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath, delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 })`. If GPU creation throws, retry with `delegate: 'CPU'` and log which one is used (shown in debug panel).
- Result fields: `result.landmarks` (normalized), `result.handedness` (older builds call it `handednesses`; support both).
- Pass the result to `toHandFrame(result, t)` in `handFrame.js`.

### 5.3 Normalization (`src/input/handFrame.js`) — important gotchas

1. **Mirror once, at ingest:** `x = 1 - lm.x`. Everything downstream works in the user's view (moving your right hand to your right increases x). The camera preview is displayed with CSS `transform: scaleX(-1)` and the skeleton is drawn with mirrored x, so they line up.
2. **Handedness:** MediaPipe labels assume a mirrored (selfie) input image. We feed the raw unmirrored video, so the label is **swapped**: MediaPipe `"Left"` = user's right hand. Implement this as `config.HANDEDNESS_SWAP = true` so the user can flip it if testing shows it is wrong.
3. **Two hands, same label** (happens): assign by position instead — in mirrored coords, the hand with larger wrist x is the user's right hand.
4. **Lost hands:** if a side disappears, keep returning the last HandData for `config.HAND_LOST_GRACE_MS` (300 ms) with a `stale: true` flag, then null. Gesture state machines treat null as "release".

### 5.4 Mouse simulator (`src/input/mouseSimulator.js`)

Produces a synthetic HandFrame so all features work without a camera. Toggle with `M`.

- Mouse position over the stage canvas → right-hand wrist position (x, y in [0,1]).
- Mouse wheel → right-hand scale (depth), clamped to the calibration range.
- Left mouse button held → right hand pinching.
- Quick mouse movement with button up → swipe (the recognizer sees a fast-moving open hand).
- Left hand: keys `1`–`5` set the left hand's finger count; `0` = fist; holding `Shift` = left pinch, and vertical mouse movement while `Shift` is held moves the left hand's y.
- Generate the 21 landmarks from a template open hand (`tests/fixtures/handFixtures.js` exports `makeHand({ wrist, scale, extended: [thumb, index, middle, ring, pinky], pinch })`), so the real feature extraction runs on simulated hands. Reuse the same fixture generator in tests.

---

## 6. Algorithms

### 6.1 Landmark indices

```
0 wrist
thumb: 1 CMC, 2 MCP, 3 IP, 4 TIP
index: 5 MCP, 6 PIP, 7 DIP, 8 TIP
middle: 9 MCP, 10 PIP, 11 DIP, 12 TIP
ring: 13 MCP, 14 PIP, 15 DIP, 16 TIP
pinky: 17 MCP, 18 PIP, 19 DIP, 20 TIP
```

Distances use aspect-corrected coordinates: `dx = (a.x - b.x) * ASPECT` where `ASPECT = videoWidth / videoHeight` (4/3 by default), `dy = a.y - b.y`.

### 6.2 Smoothing — One Euro filter (`src/filters/oneEuroFilter.js`)

```js
export class OneEuroFilter {
  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) { ... }
  filter(value, tMs) { ... }   // returns filtered value
  reset() { ... }
}
function alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
// filter():
//   if first sample: store and return value
//   dt = max((tMs - tPrevMs) / 1000, 1e-3)
//   dx = (value - xPrev) / dt
//   edx = dxPrev + alpha(dCutoff, dt) * (dx - dxPrev)
//   cutoff = minCutoff + beta * |edx|
//   x = xPrev + alpha(cutoff, dt) * (value - xPrev)
```

`HandSmoother` (same file): one filter per landmark per axis per side (21 × 3 × 2). Reset a side's filters when that hand goes null. Defaults in config: `SMOOTH = { minCutoff: 1.5, beta: 0.5, dCutoff: 1.0 }`. Hand scale (depth) gets its own heavier filter: `SMOOTH_DEPTH = { minCutoff: 0.4, beta: 0.2, dCutoff: 1.0 }`. All four values are live-tunable from the debug panel.

### 6.3 Hand features (`src/gestures/features.js`, pure)

```js
export function handScale(lm)          // dist(0, 9): wrist → middle MCP. Proxy for depth.
export function pinchRatio(lm)         // dist(4, 8) / handScale(lm)
export function fingerExtended(lm)     // → [thumb, index, middle, ring, pinky] booleans
export function fingerCount(lm)        // count of true in fingerExtended
export function palmCenter(lm)         // average of 0, 5, 9, 13, 17
```

- Non-thumb finger `i` with tip T, PIP P: extended if `dist(T, 0) > dist(P, 0) * 1.15`.
- Thumb: extended if `dist(4, 5) / handScale > 0.55` (thumb tip far from index MCP).
- Use `palmCenter` as the hand's position for mapping (more stable than the wrist).

### 6.4 Gesture recognizer (`src/gestures/recognizer.js`, pure)

`createRecognizer(config)` → `{ update(frame, now) → { right, left, events } }`. Events are objects `{ type, side, ... }`.

**Right hand state machine**

| State | Enter when | Emits |
|---|---|---|
| `idle` | hand null | `grabEnd` if was grabbing |
| `open` | hand present, `pinchRatio > PINCH_OFF` | — |
| `pinching` | `pinchRatio < PINCH_ON` (0.25) held for `PINCH_DEBOUNCE_MS` (60 ms) | `grabStart` once |
| back to `open` | `pinchRatio > PINCH_OFF` (0.38) | `grabEnd` |

Hysteresis between `PINCH_ON` and `PINCH_OFF` prevents flicker. While `pinching`, emit nothing extra: the controller reads the continuous hand position each frame.

**Right-hand swipe** (only in `open` state): keep a 250 ms history of palm x. If `|Δx| > SWIPE_MIN_DIST` (0.25) and `|Δx| / Δt > SWIPE_MIN_SPEED` (1.2 units/s) and `|Δy| < 0.5 · |Δx|`, emit `swipe { dir: 'left'|'right' }`, then ignore swipes for `SWIPE_COOLDOWN_MS` (800 ms) and clear the history.

**Left hand**

- `pinching` state machine identical to the right hand → `adjustStart { y }` / `adjustEnd`.
- **Parameter selection** (only while not pinching, and not within 300 ms after a pinch ends): if `fingerCount` stays the same for `SELECT_HOLD_MS` (400 ms) and is in 1–5, emit `select { count }` once (do not re-emit until the count changes).
- **Fist reset**: `fingerCount === 0` held for `FIST_HOLD_MS` (800 ms) → emit `reset` once.

Return continuous values too: `right: { state, palm, scale }`, `left: { state, palm, scale, count }`.

### 6.5 Mapping (`src/mapping/handToAudio.js`, pure)

```js
export function handToSpherical(palm, scale, cal)   // → { az, el, dist } in degrees / meters
export function sphericalToCartesian(az, el, dist)  // → { x, y, z } Web Audio coordinates
export function mapRange(v, inMin, inMax, outMin, outMax, clamp = true)
export function expMap(t, min, max)                  // min * (max/min)^t, for frequency and distance
```

Default calibration (`config.MAP`, overwritten by calibration and stored in `localStorage` under `gsam.calibration` — wrap in try/catch):

```js
MAP = {
  xMin: 0.2, xMax: 0.8,        // palm x → az
  yMin: 0.2, yMax: 0.8,        // palm y → el (y is down, so invert)
  scaleFar: 0.10, scaleNear: 0.28,
  azMin: -90, azMax: 90,
  elMin: -30, elMax: 45,
  distMin: 0.5, distMax: 5,
}
```

- `az = mapRange(palm.x, xMin, xMax, azMin, azMax)`
- `el = mapRange(palm.y, yMax, yMin, elMin, elMax)` (inverted)
- `t = clamp01((scale - scaleFar) / (scaleNear - scaleFar))`; `dist = expMap(1 - t, distMin, distMax)` (closer hand → smaller distance)
- Web Audio coordinates: listener at origin facing −Z, +X right, +Y up:
  ```
  x =  dist * sin(az) * cos(el)
  y =  dist * sin(el)
  z = -dist * cos(az) * cos(el)
  ```

### 6.6 Parameters (`src/audio/params.js`)

| Key | Label | Range | Default | Finger count | Audio |
|---|---|---|---|---|---|
| `bass` | Bass | −12 … +12 dB | 0 | 1 | lowshelf 200 Hz gain |
| `treble` | Treble | −12 … +12 dB | 0 | 2 | highshelf 4 kHz gain |
| `pitch` | Pitch | −12 … +12 semitones | 0 | 3 | `playbackRate = 2^(st/12)` |
| `filter` | Filter | 0 … 1 | 1 (open) | 4 | lowpass cutoff `expMap(v, 200, 20000)` Hz |
| `reverb` | Reverb | 0 … 1 | 0.15 | 5 | wet gain = v, dry gain = 1 − 0.5·v |
| `mid` | Mid | −12 … +12 dB | 0 | (slider only) | peaking 1 kHz, Q 1 |
| `gain` | Volume | 0 … 1.5 | 1 | (slider only) | source gain |

Each param definition: `{ key, label, min, max, default, step, unit, format(v) }`. Left-hand pinch-drag is **relative**: on `adjustStart` remember the value and y; each frame `value = start + (startY - y) * (max - min) * ADJUST_SENSITIVITY` (default 2.0, i.e. half the frame height = full range), clamped.

### 6.7 Color mapping (`src/visuals/color.js`, pure)

```js
export function spectrumToColor(freqBytes, sampleRate, fftSize) // → { hue, light, energy }
```
- Bin width = `sampleRate / fftSize`. Bass energy = mean of bins < 250 Hz; treble energy = mean of bins > 2000 Hz.
- `ratio = treble / (bass + treble + 1e-6)`; `hue = lerp(25, 210, ratio)` (warm orange for bass-heavy, blue for treble-heavy).
- `energy` = mean of all bins / 255; `light = 35 + 35 * energy` (HSL lightness %).

---

## 7. Audio engine

### 7.1 Context and master bus (`src/audio/engine.js`)

- Create the `AudioContext` only inside the Start button click handler (browser autoplay rule). Call `ctx.resume()`.
- Master chain: `sourcesBus (Gain) → masterGain → masterAnalyser → ctx.destination`.
- `masterAnalyser.fftSize = 2048`, `smoothingTimeConstant = 0.8`.
- Shared reverb impulse buffer from `impulse.js` (see 7.4), reused by all sources.
- Show `ctx.baseLatency` and `ctx.outputLatency` (if defined) in the debug panel.

### 7.2 Per-source chain (`src/audio/soundSource.js`)

```
AudioBufferSourceNode (loop = true)
 → bass (BiquadFilter lowshelf 200 Hz)
 → mid (BiquadFilter peaking 1 kHz, Q 1)
 → treble (BiquadFilter highshelf 4 kHz)
 → lowpass (BiquadFilter lowpass, Q 0.7)
 → split ─┬→ dryGain ───────────────┐
          └→ convolver → wetGain ───┴→ sourceGain
 → spatializer (PannerNode HRTF  OR  StereoPannerNode + distanceGain)
 → per-source analyser (fftSize 512) → engine.sourcesBus
```

PannerNode settings: `panningModel = 'HRTF'`, `distanceModel = 'inverse'`, `refDistance = 1`, `maxDistance = 10`, `rolloffFactor = 1`, `coneInnerAngle = 360`.

**Stereo fallback** (`spatialMode = 'stereo'`, FR-15): `pan = sin(az)`, `distanceGain = clamp(1 / dist, 0, 1.5)`. Build both spatializers per source at creation, and switch by disconnecting `sourceGain` from one and connecting it to the other. Toggle with `S`.

Class API:

```js
class SoundSource {
  constructor(engine, { id, name, buffer, startAt })
  setPosition(az, el, dist)     // uses setTargetAtTime on positionX/Y/Z (fallback: panner.setPosition) or pan/gain
  setParam(key, value)          // maps via params.js
  setSpatialMode(mode)
  stop(fadeSec = 0.2)           // fade sourceGain to 0, then stop and disconnect
}
```

**Smoothing rule:** `param.setTargetAtTime(target, ctx.currentTime, AUDIO_RAMP_TC)` with `AUDIO_RAMP_TC = 0.03` s for position and 0.05 s for tone params. Skip the call if the change is below a tiny epsilon to avoid flooding the audio thread.

Pitch with `playbackRate` changes speed too; this is accepted for the core (document it in the HUD tooltip). Phase 6 adds a pitch-only option.

### 7.3 Demo tracks (`src/audio/demoTracks.js`)

Generate all built-in audio procedurally with `OfflineAudioContext` (44.1 kHz, mono stems) so there are no asset or licensing issues. Generate once at start-up and cache `AudioBuffer`s. All stems in a track have identical length so they loop in sync.

1. **"Demo Band"** — 100 BPM, 8 bars (19.2 s), four stems with initial positions:
   - `Drums` (az 0°): kick = sine 150 → 40 Hz exponential sweep over 0.12 s with fast decay on beats 1 and 3; snare = white noise through bandpass 1.8 kHz, 0.15 s decay on beats 2 and 4; closed hats = highpassed noise 7 kHz, 0.04 s, every 8th note.
   - `Bass` (az −40°): sawtooth through lowpass 600 Hz, root-note pattern A1–F1–C2–G1 (two bars each), 8th notes.
   - `Pad` (az +60°): three detuned sawtooths per chord (Am, F, C, G), lowpass 1.2 kHz, 0.5 s attack, 1 s release.
   - `Lead` (az −70°, el +15°): triangle-wave arpeggio of the chord tones, 16th notes, short decay.
2. **"Rain and Bells"** — ambient, 16 s: filtered pink noise stem (az 0°, dist 3) and a bell stem (sine partials 1, 2.76, 5.4 with exponential decay, random pentatonic notes every ~1.5 s) at az +50°.
3. **"Test Noise"** — single pink-noise stem with 250 ms bursts every 600 ms, for localization testing. Az 0°.

**User uploads** (FR-12): a file input (`accept="audio/*"`) and drag-and-drop onto the page; decode with `ctx.decodeAudioData`; append as a new track with one stem at az 0°. Show an error in the HUD if decoding fails ("This file could not be decoded. Try an MP3, WAV or OGG file.").

**Track switching** (swipe or `[`/`]` keys): fade out current sources (0.2 s), create the new track's sources, start them together at `ctx.currentTime + 0.05`. Reset `focusedSourceId` to the first stem.

### 7.4 Reverb impulse (`src/audio/impulse.js`)

`makeImpulse(ctx, { seconds = 2.5, decay = 3 })`: stereo buffer, each channel = white noise × `(1 - t/len)^decay`. No files needed.

### 7.5 Engine API (the only audio surface other modules use)

```js
engine.init()                          // on Start click
engine.loadTrack(index)                // builds SoundSources for the track
engine.addUploadedTrack(file)          // → Promise<trackIndex>
engine.setSourcePosition(id, az, el, dist)
engine.setSourceParam(id, key, value)
engine.setSpatialMode('hrtf'|'stereo')
engine.setMasterGain(v)
engine.togglePlay()
engine.setListenerYaw(deg)             // Phase 6 head tracking
engine.analysers                       // { master: AnalyserNode, perSource: Map<id, AnalyserNode> }
engine.playOneShot(buffer, az, el, dist) // for localization test and earcons
```

---

## 8. Controller, visuals and UI

### 8.1 Controller (`src/controller/controller.js`)

- **`grabStart` (right):** compute cursor `{az, el}` from the right palm. If there is one source, grab it. Otherwise grab the nearest source on the 2D stage within `GRAB_RADIUS` (0.15 in stage-normalized units); if none is within the radius, do nothing (HUD hint: "Move closer to a sound to grab it"). Set `grabbedSourceId` and `focusedSourceId`. Play the grab earcon if a11y mode is on.
- **While grabbed:** every frame set the source's `az/el/dist` from `handToSpherical`, write to store, call `engine.setSourcePosition`.
- **`grabEnd`:** clear `grabbedSourceId`; the source stays where it was released.
- **`swipe`:** next / previous track (wraps around).
- **`select {count}`:** set `selectedParam` from the finger-count column in 6.6; speak the param name in a11y mode.
- **`adjustStart` / frames while left pinching:** relative adjust (6.6) on the focused source, or on all sources if `applyToneTo === 'all'`.
- **`reset`:** set the selected param to its default.
- In **study condition `slider`**, ignore all gesture events (sliders only).
- Every event and every param change goes to `study/logger.js` when a study session is running.

### 8.2 Layout (`index.html`, `src/ui/layout.css`)

Vanilla DOM + CSS grid, dark theme by default, works at 1280×720 and up (laptop only, no mobile).

```
┌───────────────────────────────────────────────┬──────────────┐
│  Main view: Three.js scene (or 2D stage in     │ Side panel   │
│  low quality). Camera preview (320×240) with   │ - Track list │
│  skeleton overlay in the top-left corner.      │ - Sources    │
│  2D stage as a small inset top-right.          │ - Sliders    │
│                                                │ - Settings   │
├───────────────────────────────────────────────┤ - Study      │
│  HUD: selected param + value, gesture hints    │              │
├───────────────────────────────────────────────┤              │
│  Scope strip: waveform (left) | spectrum (right)│             │
└───────────────────────────────────────────────┴──────────────┘
```

- **Start screen:** title, "Use headphones" notice, Start button (starts audio + camera), "Start without camera" button (mouse mode).
- Every control has a stable `id` and a visible focus style.

### 8.3 Camera overlay (`src/visuals/overlay2d.js`)

Draw the mirrored video and the 21-point skeleton (standard hand connections) for each hand. Right hand in blue, left in orange. Pinching hand: thicker thumb–index line. Show the left hand's finger count as a number next to the wrist.

### 8.4 2D stage (`src/visuals/stage2d.js`)

Canvas. x axis = azimuth −90° … +90°, y axis = elevation −30° … +45°. Gridlines every 30° az with labels. Each source = circle, radius inversely proportional to distance, labelled with its name; focused source ringed; grabbed source filled. Right-hand cursor = crosshair. Also used as the main view in low-quality mode.

### 8.5 Scope (`src/visuals/scope.js`)

Waveform from `getByteTimeDomainData` (line), spectrum from `getByteFrequencyData` as 64 log-spaced bars (bass left, treble right), bar color by frequency (warm → cool, using the same hue ends as 6.7).

### 8.6 3D scene (`src/visuals/scene3d.js`)

- Same coordinates as audio (6.5). Camera at `(0, 2.2, 4.5)` looking at `(0, 0.3, -1)` so left/right on screen match left/right in the headphones.
- Listener: sphere head (r 0.25) with a small cone "nose" pointing −Z, two small ear boxes.
- Frequency ring: 64 thin boxes arranged on a circle of radius 1.2 at y = 0, each scaled in height by one spectrum band of the master analyser.
- Sources: emissive spheres (r 0.12) plus an additive-blended sprite glow; glow size and color from that source's analyser via `spectrumToColor`. A faint line from the head to each source.
- Floor grid (`GridHelper`) for depth reference.
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`; handle resize.
- If WebGL is unavailable, switch to `quality: 'low'` automatically.

### 8.7 HUD (`src/ui/hud.js`)

- Large label: selected parameter and value (e.g. `BASS +6.0 dB`).
- A row of 5 gesture hints with icons drawn in CSS or inline SVG: Pinch & move (R), Swipe (R), 1–5 fingers (L), Pinch & drag (L), Fist = reset (L). Highlight the gesture currently detected.
- Status line: input mode, tracking fps, spatial mode.
- `aria-live="polite"` region for status messages.

### 8.8 Side panel (`src/ui/panel.js`) — slider baseline (FR-27)

- Track select, play/pause, upload.
- Source list: click to focus. For the focused source: sliders for az, el, dist and all params in 6.6. Sliders and gestures update the same store, so each reflects the other.
- Settings: spatial mode (HRTF/stereo), apply tone to (focused/all), quality (high/low), accessibility mode, input mode, handedness swap, "Calibrate".

### 8.9 Keyboard (`src/ui/keyboard.js`)

| Key | Action |
|---|---|
| Space | Play / pause |
| `[` / `]` | Previous / next track |
| Tab / Shift+Tab (panel) | Normal focus navigation |
| `1`–`5` | Select param (when mouse simulator is off) |
| ↑ / ↓ | Adjust selected param by one step |
| ← / → | Move focused source az by 10° |
| `S` | Toggle HRTF / stereo |
| `M` | Toggle mouse simulator |
| `A` | Toggle accessibility mode |
| `D` | Toggle debug panel |
| `C` | Start calibration |
| `H` or `?` | Show help overlay |

Ignore shortcuts while focus is in a text input.

### 8.10 Debug panel (`src/ui/debug.js`)

Tracking fps, render fps, tracking ms/frame, delegate (GPU/CPU), audio latency, per-hand pinch ratio / finger count / scale, a small rolling plot of raw vs. filtered palm x for the right hand, and live sliders for `SMOOTH`, `SMOOTH_DEPTH`, `PINCH_ON`, `PINCH_OFF`, `SWIPE_MIN_SPEED`.

### 8.11 Calibration (`src/gestures/calibration.js`, FR-05)

Four prompts, each waits for the right hand to stay still for 1 s (palm movement < 0.01 over 1 s), then records:
1. "Reach to your far left" → `xMin`  2. "Far right" → `xMax`
3. "Hand high" → `yMin`, then "Hand low" → `yMax`
4. "Hand close to the camera" → `scaleNear`, "Hand far from the camera" → `scaleFar`

Add a 5% margin inwards on each so edges are reachable. Validate (`xMax - xMin > 0.2`, `scaleNear > scaleFar * 1.3`); if invalid, keep defaults and say why. Save to `localStorage` (try/catch). "Reset calibration" button restores defaults.

### 8.12 Accessibility mode (`src/ui/accessibility.js`, `src/audio/earcons.js`, FR-28)

- Earcons (short oscillator blips through the master bus, not spatialized): grab = rising 2-note (660→880 Hz), release = falling, track change = triple blip, reset = low thud.
- Value ticks: a soft click each time the adjusted value crosses 10% of its range.
- `speechSynthesis` speaks: selected param name, value on `adjustEnd` ("Bass plus 6"), track name on change. Cancel pending speech before speaking.
- "Screen off" toggle: blacks out visuals (saves CPU, for blindfolded study tasks).

---

## 9. Phases

Each phase lists tasks, automated acceptance criteria (you verify), and a human check (the user verifies with camera and headphones).

### Phase 1 — Scaffold, input and tracking (MVP part 1)

Tasks:
1. Project setup (Section 2), folder structure, `config.js`, `store.js`, empty module files with exported stubs.
2. Start screen; `camera.js`; `handTracker.js`; `handFrame.js` (mirroring, handedness swap, lost-hand grace).
3. `oneEuroFilter.js` + `HandSmoother`.
4. `features.js`.
5. `overlay2d.js` camera preview with skeleton.
6. `mouseSimulator.js` + `tests/fixtures/handFixtures.js`.
7. Debug panel with fps, delegate, pinch ratio, finger count, scale.
8. Unit tests: `oneEuroFilter.test.js` (constant input stays constant; step input converges; higher beta lags less on a ramp), `features.test.js` (pinched vs open fixture, finger counts 0–5, scale grows with fixture scale).

Acceptance: build and tests pass; app loads with no console errors; mouse mode shows a simulated skeleton that follows the mouse.

Human check:
- [ ] Camera preview appears, mirrored like a mirror.
- [ ] Skeleton follows both hands; right hand drawn blue, left orange (if swapped, flip `HANDEDNESS_SWAP` and report).
- [ ] Debug shows tracking ≥ 25 fps.
- [ ] Finger count shown on the left hand matches 0–5 fingers held up.

### Phase 2 — Spatial audio and grab (MVP part 2)

Tasks:
1. `engine.js`, `soundSource.js`, `impulse.js`, `params.js`, `demoTracks.js` (Demo Band first; others can come in Phase 3).
2. `handToAudio.js` + tests (`handToAudio.test.js`: center palm → az 0; left edge → −90; `sphericalToCartesian(90, 0, 1)` ≈ `{x:1,y:0,z:0}`; `(0,0,1)` ≈ `{z:-1}`; closer hand → smaller distance).
3. Recognizer right-hand pinch state machine + tests (`recognizer.test.js`: pinch sequence emits exactly one grabStart and one grabEnd; ratio jitter between ON and OFF does not toggle; null hand mid-pinch emits grabEnd).
4. Controller grab logic, `stage2d.js`.
5. HRTF / stereo toggle.
6. Minimal side panel: play/pause, track select, source list.

Acceptance: tests pass; in mouse mode, clicking near a source on the stage and dragging moves it, and the stage updates; no `AudioParam.value` assignments in loop code (grep for `.value =` outside init code).

Human check (headphones on):
- [ ] Press Start: Demo Band plays; the four stems are heard from different directions.
- [ ] Pinch near the Drums and move the hand left/right: the drums move clearly left/right in the headphones with no clicks.
- [ ] Moving the hand toward the camera makes the source louder/closer.
- [ ] Pressing `S` makes the difference between HRTF and plain stereo audible.
- [ ] Delay between hand move and sound change feels under ~0.1 s.

**MVP gate:** do not proceed until Phase 2's human check passes.

### Phase 3 — Gestures, tone controls, scope

Tasks:
1. Right-hand swipe, left-hand pinch adjust, finger-count select, fist reset (recognizer + tests for each: swipe fires once per fast move and not on slow drift; select fires after 400 ms stable count, not during pinch; fist fires after 800 ms).
2. Controller wiring for all left-hand events; `applyToneTo`.
3. Remaining demo tracks; upload and drag-and-drop.
4. `hud.js` with gesture hints and selected param display.
5. `scope.js` waveform + spectrum.
6. Full slider panel (8.8), two-way sync with gestures.
7. `keyboard.js` shortcuts and help overlay.

Acceptance: tests pass; every gesture can be triggered in mouse mode and changes the corresponding slider.

Human check:
- [ ] Swipe right/left changes the track once per swipe, not repeatedly.
- [ ] Holding up 1–5 left fingers changes the selected parameter label after a short moment.
- [ ] Left pinch + drag up raises bass (audible), drag down lowers it.
- [ ] Filter at minimum sounds muffled; reverb at maximum sounds like a large room.
- [ ] Fist resets the selected parameter.
- [ ] Uploading an MP3 plays it and it can be grabbed and moved.
- [ ] No accidental parameter changes when just moving the hands around without pinching.

### Phase 4 — 3D scene, color mapping, calibration, polish

Tasks:
1. `color.js` + `color.test.js` (bass-only spectrum → hue near 25; treble-only → near 210; silence → energy 0).
2. `scene3d.js` (8.6), quality toggle with automatic fallback.
3. Calibration flow (8.11).
4. Performance pass: measure tracking and render fps with 3D on; if render < 30 fps, reduce ring bars to 32 and disable glow sprites in `quality: 'low'`.
5. README: how to run, controls table, troubleshooting (camera blocked, no sound, wrong hand colors, low fps).

Acceptance: tests pass; build size reported; no console errors over a 2-minute mouse-mode session.

Human check:
- [ ] 3D source positions match where the sound is heard.
- [ ] The ring pulses with the music; sources glow warmer on bass-heavy stems, cooler on bright stems.
- [ ] Calibration completes and makes the full left/right range reachable without stretching.
- [ ] Frame rate stays smooth on the team's weakest laptop (switch to low quality if not).

### Phase 5 — Accessibility and study tools

Tasks:
1. Accessibility mode, earcons, speech, screen-off (8.12).
2. `logger.js` + `logger.test.js` (CSV escaping of commas/quotes; header row; one row per event). Event fields: `timestamp_ms, participant, condition, task_id, event, source_id, param, value, az, el, dist, extra`. Export via a Blob download named `gsam_<participant>_<condition>_<yyyymmdd-hhmm>.csv`.
3. `localizationTest.js` (FR-29): 
   - Uses "Test Noise" bursts via `engine.playOneShot`.
   - Targets: azimuths −90, −60, −30, 0, 30, 60, 90 at el 0, dist 1.5, each repeated 3 times, shuffled (21 trials). Condition = current spatial mode (run once with HRTF, once with stereo).
   - User points with the right hand (cursor shown only as "pointing" earcon in screen-off mode) and pinches to answer. Record target az, response az, absolute error, response time.
   - Optional front/back block: targets at ±30° front or ±150° back; user presses `F` or `B`; record confusion.
   - Summary at the end: mean absolute error per condition, front/back confusion rate.
4. `taskRunner.js`: a list of tasks (below). Each shows the instruction, starts a timer, and completes when the state is within tolerance for 1 s continuously, or the user presses Enter ("give up" = Esc). Logs time, success, number of grabs/adjusts.
   ```
   T1  Move "Drums" to 60° right            tolerance ±10°
   T2  Move "Bass" to 45° left and close (≤ 1 m)   ±10°, ≤ 1.0 m
   T3  Set Bass to +6 dB on "Pad"            ±1.5 dB
   T4  Set Filter to about half (0.5)        ±0.08
   T5  Switch to "Rain and Bells" and put the bells straight ahead   ±10°
   ```
5. Study panel: participant ID field, condition select (gesture / slider), buttons: Run tasks, Run localization test, Export CSV.
6. SUS: an in-app 10-question SUS form (standard SUS item wording, 1–5 scale) shown after each condition; compute the score (odd items: score−1, even items: 5−score, sum × 2.5) and log it.

Acceptance: tests pass; a full mouse-mode study run produces a CSV with the expected columns.

Human check:
- [ ] Accessibility mode can be used with eyes closed to grab a sound and change bass.
- [ ] Localization test runs 21 trials and shows a summary.
- [ ] Exported CSV opens in a spreadsheet with correct columns.

### Phase 6 — Stretch (implement only what the user chooses)

Ask the user which one (or more) to implement:

**A. Head tracking (FR-06):** `headTracker.js` with Face Landmarker, `outputFacialTransformationMatrixes: true`, run every 2nd video frame. Extract yaw from the transformation matrix (`yaw = atan2(m[8], m[10])` on the column-major 4×4; verify sign with the user). Smooth with One Euro (minCutoff 1.0, beta 0.3). Apply with `engine.setListenerYaw`: set `listener.forwardX = sin(yaw)`, `forwardZ = -cos(yaw)` via `setTargetAtTime` (fallback `listener.setOrientation`). Sources then stay fixed in the room when the head turns. Toggle in settings; off by default. Human check: turn the head left, a sound in front should move to the right ear.

**B. Pitch-only shifting (FR-21):** add `tone`, call `Tone.setContext(new Tone.Context(ctx))` with the existing context, insert `new Tone.PitchShift()` after the lowpass using `Tone.connect(nativeNode, pitchShift)` and `pitchShift.connect(...)` to native nodes. Setting "Pitch mode: speed+pitch / pitch only". If integration fails, stop and report; do not write a custom pitch shifter without asking.

**C. Audio game (FR-31):** "Find the sound": a hidden source plays at a random az; the user moves a "catcher" with the right hand and pinches when they think it's on target; score by error and time; 10 rounds; works in screen-off mode.

**D. Rear orbit mode:** setting that maps x to az −180 … +180 so sources can be placed behind the head.

---

## 10. `config.js` (complete list of tunables)

```js
export const CONFIG = {
  VIDEO: { width: 640, height: 480 },
  HANDEDNESS_SWAP: true,
  HAND_LOST_GRACE_MS: 300,
  SMOOTH: { minCutoff: 1.5, beta: 0.5, dCutoff: 1.0 },
  SMOOTH_DEPTH: { minCutoff: 0.4, beta: 0.2, dCutoff: 1.0 },
  PINCH_ON: 0.25,
  PINCH_OFF: 0.38,
  PINCH_DEBOUNCE_MS: 60,
  FINGER_EXT_RATIO: 1.15,
  THUMB_EXT_RATIO: 0.55,
  SWIPE_WINDOW_MS: 250,
  SWIPE_MIN_DIST: 0.25,
  SWIPE_MIN_SPEED: 1.2,
  SWIPE_COOLDOWN_MS: 800,
  SELECT_HOLD_MS: 400,
  SELECT_AFTER_PINCH_MS: 300,
  FIST_HOLD_MS: 800,
  ADJUST_SENSITIVITY: 2.0,
  GRAB_RADIUS: 0.15,
  MAP: { xMin: 0.2, xMax: 0.8, yMin: 0.2, yMax: 0.8, scaleFar: 0.10, scaleNear: 0.28,
         azMin: -90, azMax: 90, elMin: -30, elMax: 45, distMin: 0.5, distMax: 5 },
  AUDIO_RAMP_TC_POS: 0.03,
  AUDIO_RAMP_TC_PARAM: 0.05,
  ANALYSER_FFT: 2048,
  SOURCE_ANALYSER_FFT: 512,
  SPECTRUM_BARS: 64,
  MAX_PIXEL_RATIO: 1.5,
  STORAGE_KEY: 'gsam.calibration',
};
```

---

## 11. Testing summary

- **Unit (Vitest, `npm test`):** one-euro filter, features, recognizer (all state machines, using fixture sequences with timestamps), mapping, color, logger CSV. Target: every pure module has tests; recognizer tests cover debounce, hysteresis, cooldown and lost-hand behavior.
- **Manual in mouse mode (you):** run `npm run build` and, if a browser tool is available, `npm run dev` and check for console errors.
- **Manual with camera and headphones (user):** the Human check lists. Record any tuned values the user reports back into `config.js` defaults.

## 12. Known pitfalls (read before coding)

1. Handedness labels are mirrored (5.3). Mirror x once at ingest and never again.
2. `AudioContext` must be created/resumed in a click handler.
3. Do not set `.value` on AudioParams every frame; use `setTargetAtTime`.
4. `PannerNode.positionX` may be missing in old browsers; fall back to `setPosition`.
5. Call `detectForVideo` with strictly increasing timestamps; skip frames where `video.currentTime` has not changed.
6. Bluetooth headphones add 150–300 ms of delay; README should recommend wired.
7. Generic HRTFs give weak front/back and elevation cues; that is expected, not a bug. Left/right must be clear.
8. Depth from hand size is noisy; keep its stronger smoothing.
9. `localStorage` can throw; wrap every access in try/catch.
10. Stop and disconnect old `AudioBufferSourceNode`s on track change to avoid leaks (they cannot be restarted; create new ones).

## 13. Definition of done

- Phases 1–5 complete with all automated and human checks passed.
- Phase 6 items the user chose are complete.
- `README.md` explains setup, controls, calibration, the study flow and troubleshooting.
- `NOTES.md` lists every decision made beyond this plan and every config value changed after tuning.
