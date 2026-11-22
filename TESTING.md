# Usage & Expectations (MVP test guide)

How to run the app, what each control does, and what you **should** see/hear. If something differs, note the step number and report it (see [Reporting](#reporting-problems)).

## 0. Before you start
- Chrome or Edge on a laptop, **wired headphones** (Bluetooth adds 150–300 ms delay and will feel laggy).
- Good, even lighting; sit ~60–80 cm from the webcam; show both hands, palms facing the camera.
- Run: `npm install && npm run dev`, open <http://localhost:5173>.
- Press `D` at any time for the debug panel (fps, GPU/CPU delegate, latency, pinch ratio, finger count).

## 1. Mouse mode (no camera) — do this first
Click **Start without camera**.

| # | Do | Expect |
|---|---|---|
| 1.1 | Wait for loading | Brief "Preparing sounds…" bar, then the start screen fades and the app scales in. Music starts (4 layers: drums, bass, pad, arpeggio). |
| 1.2 | Look at the stage | 4 glowing orbs (Drums orange centre, Bass pink left, Pad purple right, Lead cyan far left/up). They pulse with their music and emit ripples. A blue cursor ring follows your mouse. |
| 1.3 | Hover near Drums | Cursor sits inside the orb's range: orb gets a pulsing white halo; hint reads **"Pinch to grab Drums"** (in blue). |
| 1.4 | Press and hold the mouse button on an orb | Cursor ring tightens into a filled dot with a ripple; orb gets a white ring; its panel card glows with "grabbed"; hint: **"Moving Drums — release to drop"**. |
| 1.5 | Drag left/right | Orb follows smoothly (eases onto the cursor, no jump). Panel readout shows az (−90…+90°). **In headphones the sound moves left/right, no clicks.** |
| 1.6 | Drag up/down | Elevation changes (−30…+45°). Sound shifts in height (subtle with generic HRTF). |
| 1.7 | Scroll wheel while dragging | Orb shrinks/grows and distance changes (0.5–5 m): nearer = bigger orb and louder. |
| 1.8 | Release the button | Small ripple; orb stays where dropped. |
| 1.9 | Press down far from any orb | Toast: "Move closer to a sound to grab it". Nothing moves. |
| 1.10 | Click a card in the side panel | Card highlights; that orb gets a rotating dashed ring (focus). |
| 1.11 | `Space` | Music pauses, button morphs to ▶, toast "Paused". Again to resume. |
| 1.12 | `S` | Pill switches 3D·HRTF ↔ Stereo with a pop, toast shown. **Audibly different**: stereo is flat left-right; HRTF sounds more "outside/around" the head. |
| 1.13 | Track dropdown, `D`, `M` | Dropdown lists Demo Band; `D` toggles stats; `M` tries camera (toast says none available if you started without it). |
| 1.14 | Console (F12) | No red errors. |

## 2. Camera mode
Reload, click **Start with camera**, allow access.

| # | Do | Expect |
|---|---|---|
| 2.1 | Allow camera | "Starting camera… / Loading hand tracking…" then the app opens in **Camera** mode. If blocked: warning toast and Mouse mode. |
| 2.2 | Look at the top-right camera card | Your image **mirrored** (like a mirror). Moving your right hand to the right moves the drawn hand to the right. |
| 2.3 | Show both hands | **Right hand = blue skeleton, left = orange.** If swapped → set `HANDEDNESS_SWAP: false` in `src/config.js` and report. The green dot in the card lights up while a hand is detected. |
| 2.4 | Hold up 0–5 fingers on the left hand | Orange number next to the wrist matches your finger count. (Counting only; no action yet.) |
| 2.5 | Check fps pill / `D` | Tracking ≥ **25 fps** (green). Delegate shows GPU or CPU; note which. |
| 2.6 | Move right hand around (no pinch) | Blue cursor follows smoothly, slight smoothing but not laggy. Nothing is grabbed. |
| 2.7 | Move cursor near Drums, then pinch thumb + index | Same grab feedback as 1.4 (ring tightens, white ring, hint "Moving Drums"). Pinch contact point shows a white line + dot on the camera card. |
| 2.8 | Move hand while pinching | Drums follow; **sound moves in headphones**; delay should feel < ~0.1 s. |
| 2.9 | Move hand toward / away from camera | Distance changes (orb size + loudness). This is noisy by design; it is smoothed heavily. |
| 2.10 | Open fingers | Released. |
| 2.11 | Hold a half-pinch (fingers not quite touching) | Should not flicker grab on/off (hysteresis). |
| 2.12 | Drop right hand out of view mid-grab | Grab ends after ~0.3 s; source stays put. |
| 2.13 | Move both hands without pinching for ~30 s | No accidental grabs or parameter changes. |

## 3. Phase 3 — two-hand gestures, tone, tracks, sliders

### Mouse mode equivalents
`Shift` + move = left pinch (left hand follows the mouse's vertical position) · `1`–`5` / `0` = left fingers / fist (`Esc` hides the left hand) · `Alt` + fast horizontal move = swipe. (Swipe is off without `Alt` so mouse flicks don't change track.)

| # | Do | Expect |
|---|---|---|
| 3.1 | Hold up 1–5 left fingers (or press `1`–`5` in mouse mode) and hold ~0.4 s | The gesture chip "Pick setting" fills a bar, then flashes green; the top-left setting card switches to **Bass / Treble / Pitch / Filter / Reverb** with a pop and a toast. Slider row highlights. |
| 3.2 | Left pinch (thumb + index), move hand up / down | "Pinch & drag" chip lights orange; value changes relative to where it started (up = more); hint reads "Adjusting …". The matching slider moves too. |
| 3.3 | Bass up on a sound | Audibly more low end. Treble up = brighter. Filter at minimum = muffled. Reverb at maximum = big room. Pitch ±12 = changes speed *and* pitch (accepted limitation). |
| 3.4 | Make a left fist and hold ~0.8 s | Chip fills, then the selected setting resets to default; toast "… reset". |
| 3.5 | Right-hand fast swipe left/right (open hand) | **One** track change per swipe (0.8 s cooldown); toast "♪ track name"; sounds list rebuilds. |
| 3.6 | `[` / `]` | Previous / next track (wraps): Demo Band → Rain and Bells → Test Noise. Old sounds fade out, new fade in. |
| 3.7 | Drag a slider (position or tone) | Orb moves / sound changes immediately; double-click a tone slider resets it. After a gesture change, the slider follows. |
| 3.8 | "Tone: All sounds" | Gestures/sliders now change every sound, not just the focused one. |
| 3.9 | `+ Add` or drag an MP3/WAV onto the window | Drop zone appears while dragging; file becomes a new track with one sound that you can grab and move. A bad file shows "This file could not be decoded…". |
| 3.10 | Watch the strip above the HUD | Waveform on the left, 64 spectrum bars on the right (warm = bass, cool = treble) moving with the music. |
| 3.11 | `H` / `?` | Help sheet opens (Esc / click outside closes). `↑`/`↓` adjust the selected setting, `←`/`→` move the focused sound 10°. |
| 3.12 | Move both hands around without pinching | **No** setting changes by accident. |

### Things to watch (real hands)
- A tight left fist may read as a pinch (thumb tip near index) and start an "adjust" instead of a reset. If that happens, tell me.
- The finger count may flicker between 4 and 5 (thumb). Hold the pose; report if it never settles.

## 4. Still not built
3D scene, calibration, accessibility mode / speech, study tools (logging, localization test, task runner, SUS), stretch features.

## 5. Known rough edges / things to judge
- Elevation and front/back cues are weak with generic HRTF — expected. **Left/right must be clear.**
- Hand-distance depth is noisy; if it jumps, tell me how.
- Feel of pinch thresholds (`PINCH_ON` 0.25 / `PINCH_OFF` 0.38) and the hand-to-stage range (`MAP` in `src/config.js`): if you can't reach the edges, or pinches miss/stick, report it.

## Reporting problems
Send me: step number, what you saw/heard vs. expected, browser, GPU/CPU delegate and fps from `D`, and any red console errors. Also tell me which of these felt good or bad: pinch reliability, smoothness, latency, animations.

## Pass checklist
- [ ] 1.1–1.14 mouse mode all as expected
- [ ] Camera mirrored, hand colours correct, ≥ 25 fps
- [ ] Pinch grabs reliably, release is clean
- [ ] Four stems audibly from different directions
- [ ] Moving a sound has no clicks, and delay feels under ~0.1 s
- [ ] `S` makes an audible difference
- [ ] No accidental grabs
