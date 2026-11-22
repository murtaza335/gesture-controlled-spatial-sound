# Tasks: Gesture-Controlled Spatial Audio Mixer

Task breakdown for a 2-person team. **Dev A** builds the MVP and hands it over. **Dev B** continues from the handover and builds everything after it. Section numbers (§) point to [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md), which has the full details for each task.

## Labels

| Label | Meaning |
|---|---|
| `MVP` | Minimum working version: hand moves a sound around your head. Must be done before handover. |
| `ADD-ON` | Planned features that make the full project (gestures, tone controls, visuals). |
| `STUDY` | Tools needed for the user study and report. |
| `STRETCH` | Optional. Pick at most one or two once everything else works. |
| `HUMAN` | Needs a person with a webcam and headphones. Claude can't do these checks. |

## How to use this file

- Tick a box (`- [x]`) when the task is done **and** its test or check passes.
- Work top to bottom inside your section. Tasks depend on earlier ones.
- After finishing a phase, run `npm run build` and `npm test`, then do the `HUMAN` checks for that phase.
- Write any decision not covered by the plan, and any setting you tuned, in `NOTES.md`.

## Overview

| Phase | Owner | Label | Plan § | Rough time with Claude |
|---|---|---|---|---|
| 1. Setup, camera and hand tracking | Dev A | `MVP` | §9 Phase 1 | 1–2 days |
| 2. Spatial audio and grab | Dev A | `MVP` | §9 Phase 2 | 1–2 days |
| Handover | Dev A → Dev B | | — | ½ day |
| 3. Gestures, tone controls, scope, sliders | Dev B | `ADD-ON` | §9 Phase 3 | 3–4 days |
| 4. 3D scene, colors, calibration, polish | Dev B | `ADD-ON` | §9 Phase 4 | 2–3 days |
| 5. Accessibility and study tools | Dev B | `ADD-ON` / `STUDY` | §9 Phase 5 | 3–4 days |
| 6. Stretch features | Dev B (or both) | `STRETCH` | §9 Phase 6 | 1–3 days each |
| User study, report, demo | Both | `STUDY` | project doc §10 | 1 week |

---

# Dev A — MVP

**Goal:** Press Start, pinch near a sound with your right hand, and move it left/right/closer in your headphones. The app also works with a mouse when there's no camera.

## Phase 1 — Setup, camera and hand tracking `MVP`

### 1.1 Project setup
- [ ] `MVP` Ask whether to `git init`; create the repo and a `.gitignore` (§0 rule 9)
- [ ] `MVP` Scaffold Vite vanilla project and install `@mediapipe/tasks-vision`, `three`, `vite`, `vitest` with exact pinned versions (§2.1)
- [ ] `MVP` Add `scripts/copy-mediapipe.mjs` and the `postinstall` script; confirm `public/mediapipe/wasm/` gets filled (§2.2)
- [ ] `MVP` Download `hand_landmarker.task` into `public/models/` (§2.2)
- [ ] `MVP` Add `vite.config.js` with the test settings (§2.3)
- [ ] `MVP` Create the full folder structure with stub files that export empty functions (§3)
- [ ] `MVP` Write `src/config.js` with every value from §10
- [ ] `MVP` Write `src/state/store.js` (§4.3)

### 1.2 Start screen and camera
- [ ] `MVP` Basic `index.html` + `layout.css` with the grid areas (main view, HUD, scope strip, side panel). The HUD and scope can stay empty for now (§8.2)
- [ ] `MVP` Start screen with a "Use headphones" note, a **Start** button and a **Start without camera** button (§8.2)
- [ ] `MVP` `camera.js` with clear error messages and automatic fallback to mouse mode (§5.1)

### 1.3 Hand tracking
- [ ] `MVP` `handTracker.js`: GPU delegate with CPU fallback, `detectForVideo` only on new video frames (§5.2, §12 pitfall 5)
- [ ] `MVP` `handFrame.js`: mirror x once, handedness swap, same-label fix, lost-hand grace (§5.3)
- [ ] `MVP` `oneEuroFilter.js` + `HandSmoother`, with separate depth smoothing (§6.2)
- [ ] `MVP` `features.js`: hand scale, pinch ratio, finger states, finger count, palm center (§6.3)
- [ ] `MVP` Main `requestAnimationFrame` loop in `main.js` (§4.1)

### 1.4 Visual feedback and testing tools
- [ ] `MVP` `overlay2d.js`: mirrored camera preview + skeleton, right hand blue, left orange, finger count next to the left wrist (§8.3)
- [ ] `MVP` `tests/fixtures/handFixtures.js` with `makeHand(...)` (§5.4)
- [ ] `MVP` `mouseSimulator.js`, toggled with `M` (§5.4)
- [ ] `MVP` Debug panel, first version: tracking fps, render fps, delegate, pinch ratio, finger count, scale. Toggled with `D` (§8.10)

### 1.5 Tests
- [ ] `MVP` `oneEuroFilter.test.js` (§9 Phase 1, task 8)
- [ ] `MVP` `features.test.js` (§9 Phase 1, task 8)
- [ ] `MVP` `npm run build` and `npm test` pass, with no console errors on load

### 1.6 Phase 1 checks `HUMAN`
- [ ] `HUMAN` Camera preview shows up mirrored, like a mirror
- [ ] `HUMAN` Skeleton follows both hands. Right is blue, left is orange. If they're swapped, flip `HANDEDNESS_SWAP` and write it in `NOTES.md`
- [ ] `HUMAN` Debug panel shows tracking at 25 fps or more
- [ ] `HUMAN` Left-hand finger count matches 0–5 raised fingers
- [ ] `HUMAN` Mouse mode (`M`) shows a fake skeleton that follows the mouse

## Phase 2 — Spatial audio and grab `MVP`

### 2.1 Audio engine
- [ ] `MVP` `params.js` with every parameter definition (§6.6)
- [ ] `MVP` `impulse.js` synthetic reverb (§7.4)
- [ ] `MVP` `engine.js`: create AudioContext on the Start click, master bus, master analyser, latency readout in debug (§7.1)
- [ ] `MVP` `soundSource.js`: full per-source chain, HRTF panner, `setTargetAtTime` everywhere, `positionX` fallback (§7.2, §12 pitfalls 3–4)
- [ ] `MVP` Stereo fallback spatializer and `S` toggle (§7.2)
- [ ] `MVP` `demoTracks.js`: **Demo Band** only (4 stems with starting positions) (§7.3)
- [ ] `MVP` Engine API from §7.5: `init`, `loadTrack`, `setSourcePosition`, `setSourceParam`, `setSpatialMode`, `setMasterGain`, `togglePlay`, `analysers`

### 2.2 Mapping and grab
- [ ] `MVP` `handToAudio.js`: `handToSpherical`, `sphericalToCartesian`, `mapRange`, `expMap` (§6.5)
- [ ] `MVP` Right-hand pinch state machine in `recognizer.js` with hysteresis and debounce (§6.4)
- [ ] `MVP` Controller: `grabStart` picks the nearest source, while grabbed it updates position, `grabEnd` releases (§8.1)
- [ ] `MVP` `stage2d.js`: azimuth/elevation grid, sources sized by distance, focused/grabbed styles, hand cursor (§8.4)
- [ ] `MVP` Minimal side panel: play/pause, track select, source list (click to focus) (§8.8)

### 2.3 Tests
- [ ] `MVP` `handToAudio.test.js` (§9 Phase 2, task 2)
- [ ] `MVP` `recognizer.test.js`: pinch cases (§9 Phase 2, task 3)
- [ ] `MVP` No `.value =` writes to audio params inside loop code
- [ ] `MVP` `npm run build` and `npm test` pass

### 2.4 Phase 2 checks `HUMAN` (headphones on)
- [ ] `HUMAN` Start plays Demo Band, and the four stems come from different directions
- [ ] `HUMAN` Pinching near Drums and moving left/right clearly moves the drums, with no clicks
- [ ] `HUMAN` Moving your hand toward the camera makes the sound closer/louder
- [ ] `HUMAN` `S` makes an audible difference between HRTF and plain stereo
- [ ] `HUMAN` Delay from hand movement to sound change feels under ~0.1 s
- [ ] `MVP` In mouse mode, click-drag near a source moves it

---

# Handover: Dev A → Dev B

Dev A finishes this list before handing over. Dev B reads it before writing any code.

- [ ] Every `MVP` task and `HUMAN` check above is ticked
- [ ] `npm install && npm run dev` works from a fresh clone (test it in a new folder)
- [ ] All work is committed and pushed to the shared repo; tag it `mvp`
- [ ] `README.md` (first version): how to install, run, use mouse mode, and the current controls
- [ ] `NOTES.md` lists:
  - [ ] Tuned values that differ from the plan (smoothing, pinch thresholds, mapping ranges)
  - [ ] Whether `HANDEDNESS_SWAP` had to be flipped
  - [ ] GPU or CPU delegate on each team laptop, and the fps each one gets
  - [ ] Known bugs or rough edges
  - [ ] Any decisions made outside the plan
- [ ] Short live demo (10–15 min): Dev A shows grab-and-move with camera and with mouse; Dev B runs it on their own laptop with headphones
- [ ] Dev B confirms the Phase 2 `HUMAN` checks pass on their own machine

---

# Dev B — Add-ons, study tools and stretch

**Goal:** Build the full project on top of the MVP: two-hand gestures, tone controls, visuals, 3D, accessibility, and the tools for the user study.

## Phase 3 — Gestures, tone controls, scope `ADD-ON`

### 3.1 Gestures
- [ ] `ADD-ON` Right-hand swipe with cooldown (§6.4)
- [ ] `ADD-ON` Left-hand pinch → `adjustStart` / `adjustEnd` (§6.4)
- [ ] `ADD-ON` Left-hand finger-count select (400 ms hold, not during or right after a pinch) (§6.4)
- [ ] `ADD-ON` Left-hand fist reset (800 ms hold) (§6.4)
- [ ] `ADD-ON` Extend the mouse simulator: keys `1`–`5`, `0` = fist, `Shift` = left pinch (§5.4)
- [ ] `ADD-ON` Tests for swipe, select and fist in `recognizer.test.js` (§9 Phase 3, task 1)

### 3.2 Controller and tone
- [ ] `ADD-ON` Controller handlers for `swipe`, `select`, `adjust`, `reset`, and the "apply tone to focused / all" setting (§8.1)
- [ ] `ADD-ON` Relative pinch-drag adjustment (§6.6)

### 3.3 Tracks
- [ ] `ADD-ON` Demo tracks **Rain and Bells** and **Test Noise** (§7.3)
- [ ] `ADD-ON` Track switching with crossfade, `[` / `]` keys (§7.3)
- [ ] `ADD-ON` Audio file upload + drag-and-drop with error message (§7.3)

### 3.4 Interface
- [ ] `ADD-ON` `hud.js`: selected parameter + value, 5 gesture hints with the active one highlighted, status line, ARIA live region (§8.7)
- [ ] `ADD-ON` `scope.js`: waveform + 64 log-spaced spectrum bars (§8.5)
- [ ] `ADD-ON` Full slider panel with two-way sync between sliders and gestures, plus settings (§8.8)
- [ ] `ADD-ON` `keyboard.js`: all shortcuts + help overlay (`H` / `?`) (§8.9)
- [ ] `ADD-ON` `npm run build` and `npm test` pass

### 3.5 Phase 3 checks `HUMAN`
- [ ] `HUMAN` One swipe = one track change
- [ ] `HUMAN` 1–5 left fingers change the selected parameter after a short pause
- [ ] `HUMAN` Left pinch + drag up/down audibly changes bass
- [ ] `HUMAN` Filter at minimum sounds muffled, and reverb at maximum sounds like a big room
- [ ] `HUMAN` Fist resets the selected parameter
- [ ] `HUMAN` An uploaded MP3 plays and can be grabbed and moved
- [ ] `HUMAN` Moving your hands without pinching doesn't change anything by accident

## Phase 4 — 3D scene, colors, calibration, polish `ADD-ON`

- [ ] `ADD-ON` `color.js` + `color.test.js` (§6.7)
- [ ] `ADD-ON` `scene3d.js`: listener head, frequency ring, glowing sources, lines, floor grid (§8.6)
- [ ] `ADD-ON` Quality toggle (high/low) and automatic fallback when WebGL is missing (§8.6)
- [ ] `ADD-ON` Calibration flow with validation, saving, reset, and the `C` key (§8.11)
- [ ] `ADD-ON` Debug panel: raw vs. filtered plot, and live sliders for the smoothing and gesture values (§8.10)
- [ ] `ADD-ON` Performance pass: if 3D runs below 30 fps, use the lighter low-quality settings (§9 Phase 4, task 4)
- [ ] `ADD-ON` README: full controls table and troubleshooting (§9 Phase 4, task 5)
- [ ] `ADD-ON` `npm run build` and `npm test` pass, with no console errors over 2 minutes in mouse mode

### 4.1 Phase 4 checks `HUMAN`
- [ ] `HUMAN` Source positions in 3D match where you hear them
- [ ] `HUMAN` The ring pulses with the music; bass-heavy stems glow warm and bright stems glow cool
- [ ] `HUMAN` After calibration, the full left/right range is easy to reach
- [ ] `HUMAN` Runs smoothly on the weakest team laptop, with low quality on if needed

## Phase 5 — Accessibility and study tools `ADD-ON` / `STUDY`

### 5.1 Accessibility
- [ ] `ADD-ON` `earcons.js`: sounds for grab, release, track change and reset, plus value ticks (§8.12)
- [ ] `ADD-ON` Speech for parameter names, values and track names (§8.12)
- [ ] `ADD-ON` Accessibility mode toggle (`A`) and screen-off toggle (§8.12)

### 5.2 Study tools
- [ ] `STUDY` `logger.js` + `logger.test.js`: CSV columns, escaping, export file name (§9 Phase 5, task 2)
- [ ] `STUDY` `engine.playOneShot` (§7.5)
- [ ] `STUDY` `localizationTest.js`: 21 front trials, HRTF vs. stereo, optional front/back block, summary (§9 Phase 5, task 3)
- [ ] `STUDY` `taskRunner.js` with tasks T1–T5, tolerances and logging (§9 Phase 5, task 4)
- [ ] `STUDY` Gesture vs. slider condition: gestures disabled in slider mode (§8.1)
- [ ] `STUDY` Study panel: participant ID, condition, run buttons, export (§9 Phase 5, task 5)
- [ ] `STUDY` In-app SUS form with scoring and logging (§9 Phase 5, task 6)
- [ ] `STUDY` `npm run build` and `npm test` pass, and a full mouse-mode study run exports a correct CSV

### 5.3 Phase 5 checks `HUMAN`
- [ ] `HUMAN` With eyes closed in accessibility mode, you can grab a sound and change bass
- [ ] `HUMAN` The localization test runs all 21 trials and shows a summary
- [ ] `HUMAN` The exported CSV opens in a spreadsheet with the right columns

## Phase 6 — Stretch `STRETCH` (choose as a team)

Choose: ☐ A  ☐ B  ☐ C  ☐ D

- [ ] `STRETCH` **A. Head tracking**: sounds stay fixed in the room when you turn your head (§9 Phase 6 A)
- [ ] `STRETCH` **B. Pitch-only shifting** with Tone.js (§9 Phase 6 B)
- [ ] `STRETCH` **C. "Find the sound" audio game**, playable with the screen off (§9 Phase 6 C)
- [ ] `STRETCH` **D. Rear orbit mode**: place sounds behind your head (§9 Phase 6 D)
- [ ] `HUMAN` Human check for each chosen stretch feature (§9 Phase 6)

---

# Both — Study, report and demo `STUDY`

- [ ] `STUDY` Agree the participant plan: 8–12 people, and whether visually impaired participants can join or blindfolded sighted users will stand in
- [ ] `STUDY` Pilot run with 1–2 people; fix anything confusing
- [ ] `STUDY` Run the study: tasks in both conditions (counterbalanced order), SUS after each, localization test in HRTF and stereo
- [ ] `STUDY` Analyse the CSVs: task time, accuracy, SUS scores, localization error, front/back confusion
- [ ] `STUDY` Write the report (problem, design, implementation, evaluation, results, limitations)
- [ ] `STUDY` Record a demo video as a backup for the live demo
- [ ] `STUDY` Final check: fresh clone → `npm install` → `npm run dev` works

---

## Optional: Dev B work during the MVP phase

If Dev B is free while Dev A builds the MVP, these tasks don't touch Dev A's files. They're pure modules or separate content, so there will be few merge conflicts. Tick them in the Dev B sections above when they're done.

- [ ] `color.js` + `color.test.js` (needs nothing from the MVP)
- [ ] `logger.js` + `logger.test.js`
- [ ] SUS form markup and scoring function
- [ ] Rain and Bells and Test Noise generators in a separate file, merged into `demoTracks.js` after handover
- [ ] Draft the study protocol, consent text and participant instructions
- [ ] Prepare the report outline
