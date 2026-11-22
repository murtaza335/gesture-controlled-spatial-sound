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

## 3. What is *not* in the MVP (don't expect it)
Left-hand actions (finger-count select, pinch-adjust, fist reset), swipe to change track, tone sliders, extra tracks, file upload, 3D scene, calibration, accessibility mode, study tools. Left hand is only drawn and its fingers counted.

## 4. Known rough edges / things to judge
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
