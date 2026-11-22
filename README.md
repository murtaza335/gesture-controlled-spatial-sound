# Spatial Mixer

Grab a sound with your hand and move it around your head. Hand tracking (MediaPipe) drives binaural 3D audio (Web Audio HRTF). **Use headphones** — wired ones are best, Bluetooth adds 150–300 ms of delay.

## Run

```bash
npm install     # also copies the MediaPipe wasm into public/mediapipe/
npm run dev     # http://localhost:5173
npm test        # unit tests
npm run build   # production build
```

The hand model is committed at `public/models/hand_landmarker.task`. If it is missing, download it from
`https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`.

Camera access needs `localhost` or HTTPS.

## Use (MVP)

| Action | How |
|---|---|
| Grab a sound | **Right hand**: pinch thumb + index near a sound |
| Move it | Keep pinching and move your hand: left/right = direction, up/down = height, toward camera = closer |
| Release | Open your fingers |
| Change track | **Right hand** quick swipe, or `[` / `]` |
| Pick a setting | **Left hand** hold up 1–5 fingers: Bass, Treble, Pitch, Filter, Reverb |
| Change it | **Left hand** pinch and drag up / down (relative); fist (hold) resets |
| Sliders | Side panel; synced with gestures. Tone applies to the focused sound or all |
| Add your own audio | `+ Add` or drag a file onto the window |
| Help | `H` or `?` |
| Focus a sound | Click it in the side panel |
| Play / pause | `Space` or the button |
| HRTF ↔ stereo | `S` |
| Camera ↔ mouse mode | `M` |
| Debug stats | `D` |

### Mouse mode (no camera)
Click **Start without camera**. Move the mouse over the stage (the cursor is your right hand), **hold the button** to pinch, **mouse wheel** to change depth. `Shift` + move = left pinch, `1`–`5` / `0` = left fingers / fist, `Alt` + fast move = swipe.

## Troubleshooting
- **Camera blocked** — allow it in the address bar and press Start again.
- **No sound** — check system volume; audio starts on the Start click.
- **Left/right hands swapped** — flip `HANDEDNESS_SWAP` in `src/config.js`.
- **Low fps** — press `D` to see the delegate (GPU/CPU) and tracking time.
