# Notes

## Decisions beyond the plan (MVP)
- Git repo initialised in this folder; hand model file is committed (7.8 MB) so a fresh clone works.
- **Grab offset:** on grab, the source keeps its offset from the hand and eases to the hand over ~0.35 s, so it never jumps. (`controller.js`)
- Mouse simulator maps the pointer to the stage's plot area (not the full canvas) so the cursor sits under the mouse.
- Camera card is top-right and click-through so it never blocks the stage.
- Stage and UI are animated (ripples, glows, springy buttons, cross-faded hints); `prefers-reduced-motion` is respected.
- `src/input/mouseSimulator.js` imports `tests/fixtures/handFixtures.js` (as the plan suggests) so real feature extraction runs on fake hands.
- Not in MVP: left-hand gestures (select/adjust/fist), swipe, extra tracks, upload, 3D scene, calibration, study tools.

## Phase 3–4 decisions
- Mouse-mode swipe needs `Alt` held, so mouse flicks don't change track.
- The 3D scene is a lazy-loaded inset card; `V` swaps it with the 2D map (a morph), because mouse-mode interaction lives on the 2D canvas.
- Auto Light-mode fallback: render fps < 20 for 8 consecutive half-second samples (after the first 6 s). In camera mode render fps is tied to tracking time (detection runs synchronously), so slow tracking can trigger it.
- Calibration saves the whole MAP to `localStorage` (`gsam.calibration`); Reset deletes it.
- A tight left fist may be read as a left pinch (risk, untested on real hands).

## Phase 5 decisions
- Screen-off key is `X` (not `B`) because `F`/`B` answer the front/back block.
- `Enter` = give up the current task, `Esc` = stop the run (the plan was ambiguous).
- Tasks start from a fresh Demo Band each time; T4 is on "Drums", T3 on "Pad".
- Task time = time to first reach tolerance (the one held for 1 s).
- Localization: the beep replays every 2.2 s until answered; response time counts from the first play.
- Study logging only records after a study run starts (or SUS is submitted); Clear log empties it.
- The localization response uses the right-hand cursor azimuth at pinch time; in screen-off mode a spatial "pointing" blip plays at the cursor every 0.5 s.

## Needs a human (camera + headphones)
- Whether `HANDEDNESS_SWAP` must be flipped.
- Tracking fps / GPU vs CPU delegate on real hardware.
- Pinch thresholds (`PINCH_ON/OFF`) and mapping ranges feel.
- Audible checks: stems from different directions, no clicks while moving, HRTF vs stereo difference.

## Tuned values
- `HANDEDNESS_SWAP` flipped from `true` to `false` (hands were reported swapped on the first real camera test).
