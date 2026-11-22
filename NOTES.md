# Notes

## Decisions beyond the plan (MVP)
- Git repo initialised in this folder; hand model file is committed (7.8 MB) so a fresh clone works.
- **Grab offset:** on grab, the source keeps its offset from the hand and eases to the hand over ~0.35 s, so it never jumps. (`controller.js`)
- Mouse simulator maps the pointer to the stage's plot area (not the full canvas) so the cursor sits under the mouse.
- Camera card is top-right and click-through so it never blocks the stage.
- Stage and UI are animated (ripples, glows, springy buttons, cross-faded hints); `prefers-reduced-motion` is respected.
- `src/input/mouseSimulator.js` imports `tests/fixtures/handFixtures.js` (as the plan suggests) so real feature extraction runs on fake hands.
- Not in MVP: left-hand gestures (select/adjust/fist), swipe, extra tracks, upload, 3D scene, calibration, study tools.

## Needs a human (camera + headphones)
- Whether `HANDEDNESS_SWAP` must be flipped.
- Tracking fps / GPU vs CPU delegate on real hardware.
- Pinch thresholds (`PINCH_ON/OFF`) and mapping ranges feel.
- Audible checks: stems from different directions, no clicks while moving, HRTF vs stereo difference.

## Tuned values
None yet (all defaults from the plan).
