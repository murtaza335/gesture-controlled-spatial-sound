# Commit Plan: Submission Repository

This plan is for the **submission repo** only. In this working repo, commit however you like. The submission repo gets a clean, readable history: one commit per finished piece of work, credited to the person who did it, in the same order as [TASKS.md](TASKS.md).

- **Dev A** = MVP (Phases 1–2)
- **Dev B** = add-ons, study tools, stretch (Phases 3–6)

---

## 1. Rules

1. **Port as you go.** Port a phase into the submission repo when it's finished in the working repo, not all at once at the end. The dates then match when the work was really done. Don't change commit dates.
2. **Commit under your own identity.** Each dev commits their own rows using their own `git config user.name` / `user.email`.
3. **Every commit must build.** Before each commit run `npm install && npm run build && npm test`. If a commit breaks the build, combine it with the next one or reorder the two. Never commit something broken.
4. **One logical change per commit.** Follow the rows below. Small extra fixes can be added to the row they belong to.
5. **Don't rewrite pushed history.** If something needs fixing, add a new `fix:` commit.
6. **AI use:** if your course requires you to disclose AI help, follow its rules. For example, add a `Co-Authored-By:` line to commits or mention it in the README.
7. **Never commit** `node_modules/`, `public/mediapipe/`, `dist/`, `.env*`, `.claude/`, `.vscode/`, or exported study CSVs that contain participant data.

### Message format

```
<type>(<scope>): <short summary in present tense>

<1–3 lines: what and why>
Tasks: <TASKS.md section, e.g. 1.3>
```

Types: `chore` (setup), `feat` (feature), `test`, `fix`, `docs`, `perf`, `refactor`, `style`.
Scopes: `setup`, `input`, `tracking`, `gestures`, `mapping`, `audio`, `controller`, `ui`, `visuals`, `a11y`, `study`, `docs`.

---

## 2. Setting up the submission repo

```bash
# once, by Dev A
mkdir gesture-spatial-audio-submission && cd gesture-spatial-audio-submission
git init -b main
git remote add origin <submission-repo-url>

# point at the working repo so files can be copied from it
git remote add dev <path-or-url-of-this-working-repo>
git fetch dev
```

### Copying files for a commit

Use the working-repo commit that **finished** that phase, not the latest `main`. Otherwise early commits get later versions of files, which may not build yet.

```bash
git fetch dev
git checkout <dev-commit-hash> -- <file1> <file2> ...   # copy those files at that point in time
npm install && npm run build && npm test
git add <file1> <file2> ...
git commit                                              # write the message from the table
```

If a file listed in an early row was changed later in the working repo, that's fine. A later row brings in the newer version.

### Branches and tags

| Phase | Branch | Merged by | Tag after merge |
|---|---|---|---|
| 0–2 (MVP) | `main` (Dev A) | — | `v0.1.0-mvp` |
| 3 | `feature/gestures-tone` | Pull request, reviewed by Dev A | `v0.2.0` |
| 4 | `feature/visuals-3d` | Pull request, reviewed by Dev A | `v0.3.0` |
| 5 | `feature/a11y-study` | Pull request, reviewed by Dev A | `v0.4.0` |
| 6 | `feature/stretch-<name>` | Pull request, reviewed by Dev A | — |
| Final | `main` | — | `v1.0.0` |

Merge with `git merge --no-ff` (or "Create a merge commit" on GitHub) so each phase shows up as a group of commits in the history.

---

## 3. Commits

The **Files** column lists files added or changed. `tests/` files go in the same commit as the code they test unless they have their own row.

### Phase 0 — Repository start (Dev A, on `main`)

| # | Author | Message | Files |
|---|---|---|---|
| 0.1 | A | `chore(setup): initialize repository` | `.gitignore`, `README.md` (title + one-line description) |
| 0.2 | A | `docs: add project proposal and requirements` | `docs/project-document.html` |
| 0.3 | A | `docs: add implementation plan and task breakdown` | `docs/IMPLEMENTATION_PLAN.md`, `docs/TASKS.md` |

> Put the planning docs under `docs/` in the submission repo. Leave out `COMMIT_PLAN.md` unless your instructor wants it.

### Phase 1 — Setup, camera and tracking (Dev A, on `main`)

| # | Author | Message | Files | TASKS |
|---|---|---|---|---|
| 1.1 | A | `chore(setup): scaffold Vite project with pinned dependencies` | `package.json`, `package-lock.json`, `vite.config.js`, `index.html` | 1.1 |
| 1.2 | A | `chore(setup): copy MediaPipe wasm on install and add hand model` | `scripts/copy-mediapipe.mjs`, `public/models/hand_landmarker.task` (or a download note in README) | 1.1 |
| 1.3 | A | `feat(setup): add config constants and app state store` | `src/config.js`, `src/state/store.js` | 1.1 |
| 1.4 | A | `chore(setup): add module skeleton` | all stub files under `src/` from plan §3 | 1.1 |
| 1.5 | A | `feat(ui): add page layout and start screen` | `index.html`, `src/ui/layout.css`, `src/main.js` | 1.2 |
| 1.6 | A | `feat(input): add camera access with fallback messages` | `src/input/camera.js`, `src/main.js` | 1.2 |
| 1.7 | A | `feat(tracking): add MediaPipe hand tracker with GPU/CPU fallback` | `src/input/handTracker.js` | 1.3 |
| 1.8 | A | `feat(input): normalize hand frames with mirroring and handedness fix` | `src/input/handFrame.js` | 1.3 |
| 1.9 | A | `feat(tracking): add One Euro filter and hand smoother` | `src/filters/oneEuroFilter.js`, `tests/oneEuroFilter.test.js` | 1.3, 1.5 |
| 1.10 | A | `feat(gestures): add hand feature extraction` | `src/gestures/features.js`, `tests/fixtures/handFixtures.js`, `tests/features.test.js` | 1.3, 1.5 |
| 1.11 | A | `feat(core): add main render and tracking loop` | `src/main.js` | 1.3 |
| 1.12 | A | `feat(visuals): draw camera preview with hand skeleton` | `src/visuals/overlay2d.js` | 1.4 |
| 1.13 | A | `feat(input): add mouse hand simulator` | `src/input/mouseSimulator.js`, `src/ui/keyboard.js` (M key only) | 1.4 |
| 1.14 | A | `feat(ui): add debug panel with tracking stats` | `src/ui/debug.js` | 1.4 |
| 1.15 | A | `fix(tracking): tune smoothing and handedness after camera testing` | `src/config.js`, `NOTES.md` | 1.6 |

> Skip 1.15 if nothing was tuned.

### Phase 2 — Spatial audio and grab (Dev A, on `main`)

| # | Author | Message | Files | TASKS |
|---|---|---|---|---|
| 2.1 | A | `feat(audio): add parameter definitions` | `src/audio/params.js` | 2.1 |
| 2.2 | A | `feat(audio): add synthetic reverb impulse` | `src/audio/impulse.js` | 2.1 |
| 2.3 | A | `feat(audio): add audio engine with master bus and analyser` | `src/audio/engine.js` | 2.1 |
| 2.4 | A | `feat(audio): add per-source chain with HRTF panner` | `src/audio/soundSource.js` | 2.1 |
| 2.5 | A | `feat(audio): add stereo fallback mode` | `src/audio/soundSource.js`, `src/audio/engine.js`, `src/ui/keyboard.js` | 2.1 |
| 2.6 | A | `feat(audio): generate Demo Band stems procedurally` | `src/audio/demoTracks.js` | 2.1 |
| 2.7 | A | `feat(mapping): map hand position to spherical sound position` | `src/mapping/handToAudio.js`, `tests/handToAudio.test.js` | 2.2, 2.3 |
| 2.8 | A | `feat(gestures): add pinch state machine with hysteresis` | `src/gestures/recognizer.js`, `tests/recognizer.test.js` | 2.2, 2.3 |
| 2.9 | A | `feat(controller): grab and move sound sources by pinch` | `src/controller/controller.js`, `src/main.js` | 2.2 |
| 2.10 | A | `feat(visuals): add 2D stage with sources and hand cursor` | `src/visuals/stage2d.js` | 2.2 |
| 2.11 | A | `feat(ui): add basic side panel` | `src/ui/panel.js`, `src/ui/layout.css` | 2.2 |
| 2.12 | A | `fix(audio): tune mapping ranges after headphone testing` | `src/config.js`, `NOTES.md` | 2.4 |

### Handover (Dev A, on `main`)

| # | Author | Message | Files |
|---|---|---|---|
| H.1 | A | `docs: add setup and usage guide for MVP` | `README.md` |
| H.2 | A | `docs: record tuned values, device results and known issues` | `NOTES.md`, `docs/TASKS.md` (Phase 1–2 boxes ticked) |

Then: `git tag -a v0.1.0-mvp -m "MVP: hand-controlled spatial audio"` and `git push origin main --tags`.

### Phase 3 — Gestures, tone controls, scope (Dev B, branch `feature/gestures-tone`)

| # | Author | Message | Files | TASKS |
|---|---|---|---|---|
| 3.1 | B | `feat(gestures): add right-hand swipe detection` | `src/gestures/recognizer.js`, `tests/recognizer.test.js` | 3.1 |
| 3.2 | B | `feat(gestures): add left-hand pinch adjust, finger select and fist reset` | `src/gestures/recognizer.js`, `tests/recognizer.test.js` | 3.1 |
| 3.3 | B | `feat(input): simulate left hand with keyboard` | `src/input/mouseSimulator.js` | 3.1 |
| 3.4 | B | `feat(controller): control tone parameters with left hand` | `src/controller/controller.js` | 3.2 |
| 3.5 | B | `feat(audio): add Rain and Bells and Test Noise tracks` | `src/audio/demoTracks.js` | 3.3 |
| 3.6 | B | `feat(audio): switch tracks with crossfade` | `src/audio/engine.js`, `src/controller/controller.js` | 3.3 |
| 3.7 | B | `feat(audio): load user audio files by upload or drag-and-drop` | `src/audio/engine.js`, `src/ui/panel.js` | 3.3 |
| 3.8 | B | `feat(ui): add HUD with gesture hints and parameter display` | `src/ui/hud.js`, `src/ui/layout.css` | 3.4 |
| 3.9 | B | `feat(visuals): add waveform and spectrum scope` | `src/visuals/scope.js` | 3.4 |
| 3.10 | B | `feat(ui): add full slider panel synced with gestures` | `src/ui/panel.js`, `src/state/store.js` | 3.4 |
| 3.11 | B | `feat(ui): add keyboard shortcuts and help overlay` | `src/ui/keyboard.js`, `index.html` | 3.4 |
| 3.12 | B | `fix(gestures): tune gesture thresholds after testing` | `src/config.js`, `NOTES.md` | 3.5 |

Open a PR `Phase 3: two-hand gestures and tone controls` → review by A → merge → tag `v0.2.0`.

### Phase 4 — 3D, colors, calibration, polish (Dev B, branch `feature/visuals-3d`)

| # | Author | Message | Files | TASKS |
|---|---|---|---|---|
| 4.1 | B | `feat(visuals): map spectrum to warm and cool colors` | `src/visuals/color.js`, `tests/color.test.js` | 4 |
| 4.2 | B | `feat(visuals): add Three.js scene with listener and frequency ring` | `src/visuals/scene3d.js` | 4 |
| 4.3 | B | `feat(visuals): add glowing sound sources to 3D scene` | `src/visuals/scene3d.js` | 4 |
| 4.4 | B | `feat(ui): add quality toggle and WebGL fallback` | `src/ui/panel.js`, `src/main.js` | 4 |
| 4.5 | B | `feat(gestures): add calibration flow with saved ranges` | `src/gestures/calibration.js`, `src/ui/keyboard.js` | 4 |
| 4.6 | B | `feat(ui): add live tuning and raw/filtered plot to debug panel` | `src/ui/debug.js` | 4 |
| 4.7 | B | `perf(visuals): lighten 3D scene in low-quality mode` | `src/visuals/scene3d.js`, `src/config.js` | 4 |
| 4.8 | B | `docs: add controls table and troubleshooting to README` | `README.md` | 4 |

PR `Phase 4: 3D visualization and calibration` → merge → tag `v0.3.0`.

### Phase 5 — Accessibility and study tools (Dev B, branch `feature/a11y-study`)

| # | Author | Message | Files | TASKS |
|---|---|---|---|---|
| 5.1 | B | `feat(a11y): add earcons and value ticks` | `src/audio/earcons.js` | 5.1 |
| 5.2 | B | `feat(a11y): add accessibility mode with speech and screen-off` | `src/ui/accessibility.js`, `src/ui/keyboard.js` | 5.1 |
| 5.3 | B | `feat(study): add event logger with CSV export` | `src/study/logger.js`, `tests/logger.test.js` | 5.2 |
| 5.4 | B | `feat(audio): add one-shot playback for tests` | `src/audio/engine.js` | 5.2 |
| 5.5 | B | `feat(study): add sound localization test` | `src/study/localizationTest.js` | 5.2 |
| 5.6 | B | `feat(study): add task runner with tasks T1–T5` | `src/study/taskRunner.js` | 5.2 |
| 5.7 | B | `feat(study): add gesture vs slider study conditions` | `src/controller/controller.js` | 5.2 |
| 5.8 | B | `feat(study): add study panel and SUS questionnaire` | `src/ui/panel.js`, `src/study/sus.js` (+ test if scoring is separate) | 5.2 |

PR `Phase 5: accessibility mode and study tools` → merge → tag `v0.4.0`.

### Phase 6 — Stretch (Dev B, one branch per feature; include only the ones you build)

| # | Author | Branch | Message | Files |
|---|---|---|---|---|
| 6.A | B | `feature/stretch-head-tracking` | `feat(tracking): keep sounds fixed in the room with head tracking` | `src/input/headTracker.js`, `src/audio/engine.js`, `public/models/face_landmarker.task` |
| 6.B | B | `feature/stretch-pitch-shift` | `feat(audio): add pitch-only shifting with Tone.js` | `package.json`, `package-lock.json`, `src/audio/soundSource.js` |
| 6.C | B | `feature/stretch-audio-game` | `feat(a11y): add find-the-sound audio game` | `src/study/findTheSound.js` (or `src/game/`) |
| 6.D | B | `feature/stretch-rear-orbit` | `feat(mapping): add rear orbit mode` | `src/mapping/handToAudio.js`, `tests/handToAudio.test.js` |

One PR per feature.

### Final (both, on `main`)

| # | Author | Message | Files |
|---|---|---|---|
| F.1 | A or B | `docs: add study protocol and participant instructions` | `docs/study-protocol.md` |
| F.2 | A or B | `docs: add anonymized study results and analysis` | `docs/results/` (summaries only, no names) |
| F.3 | A or B | `docs: add final report` | `docs/report.pdf` |
| F.4 | A or B | `docs: finalize README with demo link and screenshots` | `README.md`, `docs/images/` |

Then: `git tag -a v1.0.0 -m "Final submission"` and `git push origin main --tags`.

---

## 4. Checklist

### Dev A
- [ ] Submission repo created, `dev` remote added
- [ ] Phase 0 commits (0.1–0.3)
- [ ] Phase 1 commits (1.1–1.15), each builds and tests pass
- [ ] Phase 2 commits (2.1–2.12), each builds and tests pass
- [ ] Handover commits (H.1–H.2)
- [ ] Tag `v0.1.0-mvp` pushed
- [ ] Reviewed and approved the Phase 3, 4, 5 and stretch PRs

### Dev B
- [ ] Cloned the submission repo, set own git name/email
- [ ] Phase 3 branch + commits (3.1–3.12), PR merged, tag `v0.2.0`
- [ ] Phase 4 branch + commits (4.1–4.8), PR merged, tag `v0.3.0`
- [ ] Phase 5 branch + commits (5.1–5.8), PR merged, tag `v0.4.0`
- [ ] Stretch branches merged (only those built)

### Both
- [ ] Final commits (F.1–F.4)
- [ ] Tag `v1.0.0` pushed
- [ ] Fresh clone of the submission repo → `npm install` → `npm run dev` works
- [ ] No `node_modules/`, `dist/`, `public/mediapipe/`, secrets or raw participant data in the history (`git log --stat` check)
