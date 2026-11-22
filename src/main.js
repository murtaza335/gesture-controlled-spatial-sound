import './ui/layout.css';
import { CONFIG } from './config.js';
import { store } from './state/store.js';
import { engine } from './audio/engine.js';
import { startCamera } from './input/camera.js';
import { createHandTracker } from './input/handTracker.js';
import { createMouseSimulator } from './input/mouseSimulator.js';
import { HandSmoother } from './filters/oneEuroFilter.js';
import { handScale } from './gestures/features.js';
import { createRecognizer } from './gestures/recognizer.js';
import { createController } from './controller/controller.js';
import { createStage } from './visuals/stage2d.js';
import { createOverlay } from './visuals/overlay2d.js';
import { createScope } from './visuals/scope.js';
import { createScene3d } from './visuals/scene3d.js';
import { createCalibration, loadCalibration, saveCalibration, clearCalibration } from './gestures/calibration.js';
import { createUI } from './ui/ui.js';
import { createDebug } from './ui/debug.js';
import { installKeyboard } from './ui/keyboard.js';

const $ = (id) => document.getElementById(id);
const startEl = $('start');
const appEl = $('app');
const videoEl = $('video');

const stage = createStage($('stage'));
const overlay = createOverlay($('overlay'));
const mouse = createMouseSimulator($('stage'), () => stage.plotRect());
const DEFAULT_MAP = { ...CONFIG.MAP };
const calibration = createCalibration();
const savedCal = loadCalibration(CONFIG.STORAGE_KEY);
if (savedCal) Object.assign(CONFIG.MAP, savedCal);
const smoother = new HandSmoother(CONFIG.SMOOTH, CONFIG.SMOOTH_DEPTH);
const recognizer = createRecognizer(CONFIG);
const debug = createDebug($('debug'));

let tracker = null;
let hasCamera = false;

const actions = {
  focus: (id) => controller.focus(id),
  async togglePlay() {
    const playing = await engine.togglePlay();
    store.set({ playing });
    ui.toast(playing ? 'Playing' : 'Paused', { ms: 1200 });
  },
  setSpatialMode(mode) {
    engine.setSpatialMode(mode);
    store.set({ spatialMode: mode });
    ui.toast(mode === 'hrtf' ? '3D binaural (HRTF)' : 'Plain stereo', { ms: 1400 });
  },
  toggleSpatial() {
    actions.setSpatialMode(store.state.spatialMode === 'hrtf' ? 'stereo' : 'hrtf');
  },
  setInputMode(mode) {
    if (mode === 'camera' && !hasCamera) {
      ui.toast('No camera available. Press Start with camera on the start screen after allowing access.', { warn: true });
      ui.setSeg(ui.els.inputSeg, store.state.inputMode);
      return;
    }
    controllerReset();
    mouse.setEnabled(mode === 'mouse');
    store.set({ inputMode: mode });
    ui.els.camCard.classList.toggle('hidden', false);
    ui.toast(mode === 'mouse' ? 'Mouse mode — click-drag near a sound, wheel = depth' : 'Camera mode', { ms: 2200 });
  },
  toggleInput() {
    actions.setInputMode(store.state.inputMode === 'mouse' ? 'camera' : 'mouse');
  },
  toggleDebug() {
    const on = !store.state.debug;
    store.set({ debug: on });
    debug.toggle(on);
  },
  setTrack(i) {
    controller.reset();
    const sources = engine.loadTrack(i);
    store.set({ trackIndex: i, sources, focusedSourceId: sources[0]?.id ?? 0, grabbedSourceId: null });
  },
  changeTrack(delta) {
    const n = store.state.tracks.length;
    if (n < 2) return;
    const i = (store.state.trackIndex + delta + n) % n;
    actions.setTrack(i);
    ui.toast(`♪ ${store.state.tracks[i].name}`, { ms: 1800 });
  },
  async upload(file) {
    ui.toast(`Adding ${file.name}…`, { ms: 1500 });
    try {
      const idx = await engine.addUploadedTrack(file);
      store.set({ tracks: engine.tracks.map((t) => ({ name: t.name })) });
      actions.setTrack(idx);
      ui.toast(`♪ ${store.state.tracks[idx].name} — grab it and move it!`, { ms: 3000 });
    } catch (err) {
      console.warn(err);
      ui.toast('This file could not be decoded. Try an MP3, WAV or OGG file.', { warn: true, ms: 5000 });
    }
  },
  setQuality(q, auto = false) {
    if (q === store.state.quality) return;
    store.set({ quality: q, view: q === 'low' ? 'stage' : store.state.view });
    ui.toast(
      q === 'low' ? (auto ? 'Frame rate was low — switched to Light mode (2D only)' : 'Light mode: 2D only') : '3D view on',
      { warn: auto, ms: auto ? 5000 : 1600 },
    );
  },
  swapView() {
    if (store.state.quality === 'low') {
      ui.toast('3D is off in Light mode — switch Visuals to High', { warn: true });
      return;
    }
    if (!scene3) {
      ui.toast('3D view is not available on this device', { warn: true });
      return;
    }
    store.set({ view: store.state.view === 'stage' ? '3d' : 'stage' });
  },
  startCalibration() {
    controller.reset();
    calibration.start();
    ui.toast('Calibration: hold still at each position', { ms: 2500 });
  },
  cancelCalibration() {
    if (!calibration.active) return;
    calibration.cancel();
    ui.showCalibration({ active: false });
    ui.toast('Calibration cancelled', { ms: 1400 });
  },
  resetCalibration() {
    calibration.cancel();
    ui.showCalibration({ active: false });
    clearCalibration(CONFIG.STORAGE_KEY);
    Object.assign(CONFIG.MAP, DEFAULT_MAP);
    ui.setCalibState('default range');
    ui.toast('Calibration reset to defaults', { ms: 2000 });
  },
  setApplyTone(mode) {
    store.set({ applyToneTo: mode });
  },
  setParam: (k, v) => controller.setParam(k, v),
  resetParam: (k) => controller.resetParam(k),
  setPosition: (id, p) => controller.setPosition(id, p),
  selectParam: (k) => k && controller.selectParam(k),
  showHelp: (on) => ui.showHelp(on),
  state: () => store.state,
};

const ui = createUI({ store, actions });
const controller = createController({ store, engine, stage, ui, actions });
installKeyboard(actions);
const scope = createScope($('wave'), $('spectrum'));

// 3D scene loads lazily (keeps first paint fast); falls back to Light mode if WebGL is missing.
let scene3 = null;
createScene3d($('scene3d'))
  .then((s) => {
    scene3 = s;
    if (!s) actions.setQuality('low', true);
  })
  .catch((err) => {
    console.warn('3D scene failed', err);
    actions.setQuality('low', true);
  });
let lowFpsStreak = 0;

function controllerReset() {
  if (controller.grabbing) controller.grabEnd();
}

// ---------- start ----------
async function start(useCamera) {
  startEl.classList.add('busy');
  $('loading').hidden = false;
  $('startErr').hidden = true;
  try {
    // AudioContext is created synchronously inside the click handler (autoplay rule).
    const audioReady = engine.init();

    let cameraNote = null;
    if (useCamera) {
      try {
        $('loadingText').textContent = 'Starting camera…';
        await startCamera(videoEl);
        $('loadingText').textContent = 'Loading hand tracking…';
        tracker = await createHandTracker(videoEl);
        hasCamera = true;
      } catch (err) {
        console.warn(err);
        cameraNote = err.code ? err.message : 'Hand tracking could not start. Using mouse mode instead.';
        tracker = null;
        hasCamera = false;
      }
    }

    $('loadingText').textContent = 'Preparing sounds…';
    await audioReady;
    const sources = engine.loadTrack(0);
    store.set({
      started: true,
      tracks: engine.tracks.map((t) => ({ name: t.name })),
      trackIndex: 0,
      sources,
      focusedSourceId: sources[0].id,
      playing: true,
      spatialMode: 'hrtf',
    });
    const mode = hasCamera ? 'camera' : 'mouse';
    mouse.setEnabled(mode === 'mouse');
    store.set({ inputMode: mode });
    if (!hasCamera) ui.els.camCard.classList.remove('hidden');

    appEl.removeAttribute('aria-hidden');
    appEl.classList.add('ready');
    startEl.classList.add('leaving');
    setTimeout(() => startEl.remove(), 800);
    if (cameraNote) setTimeout(() => ui.toast(cameraNote, { warn: true, ms: 6000 }), 700);
    requestAnimationFrame(loop);
  } catch (err) {
    console.error(err);
    startEl.classList.remove('busy');
    $('loading').hidden = true;
    $('startErr').hidden = false;
    $('startErr').textContent = `Something went wrong: ${err.message}`;
  }
}
$('btnStart').addEventListener('click', () => start(true));
$('btnStartMouse').addEventListener('click', () => start(false));

// ---------- main loop ----------
let lastNow = performance.now();
let fpsAcc = 0;
let fpsCount = 0;
let renderFps = 0;
let lastRawT = -1;
let smoothed = { t: 0, left: null, right: null };
const levels = new Map();

function withScale(frame) {
  const out = { ...frame };
  for (const side of ['left', 'right']) {
    const h = frame[side];
    out[side] = h ? { ...h, scaleSmooth: handScale(h.lm) } : null;
  }
  return out;
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - lastNow) / 1000);
  lastNow = now;
  fpsAcc += dt;
  fpsCount++;
  if (fpsAcc >= 0.5) {
    renderFps = fpsCount / fpsAcc;
    fpsAcc = 0;
    fpsCount = 0;
    ui.setFps(store.state.inputMode === 'camera' ? tracker?.stats.trackFps ?? 0 : renderFps);
    // performance pass: sustained slow rendering with 3D on → Light mode
    if (store.state.quality === 'high' && scene3 && !document.hidden && now > 6000 && renderFps < 20) lowFpsStreak++;
    else lowFpsStreak = 0;
    if (lowFpsStreak >= 8) {
      lowFpsStreak = 0;
      actions.setQuality('low', true);
    }
  }

  // input → smooth → recognize → control
  let frame;
  if (store.state.inputMode === 'camera' && tracker) {
    const raw = tracker.getFrame(now);
    if (raw.t !== lastRawT) {
      lastRawT = raw.t;
      smoothed = smoother.apply(raw, now);
    }
    frame = smoothed;
  } else {
    frame = withScale(mouse.getFrame(now));
  }
  const gests = recognizer.update(frame, now);
  if (calibration.active) {
    // calibration owns the right hand: no grabs / gestures while it runs
    gests.events.length = 0;
    const r = gests.right;
    const res = calibration.update(r.palm ? { palm: r.palm, scale: r.scale } : null, now, DEFAULT_MAP);
    ui.showCalibration(res);
    if (res.done) {
      ui.showCalibration({ active: false });
      if (res.ok) {
        Object.assign(CONFIG.MAP, res.map);
        saveCalibration(CONFIG.STORAGE_KEY, { ...res.map });
        ui.setCalibState('calibrated');
        ui.toast('Calibration saved ✓', { ms: 2500 });
      } else {
        ui.toast(`${res.reason} Kept the previous range.`, { warn: true, ms: 6000 });
      }
    }
  }
  controller.update(gests, frame, now);

  // visuals
  for (const s of store.state.sources) levels.set(s.id, engine.level(s.id));
  const st = store.state;
  stage.render(now, dt, {
    sources: st.sources,
    focusedId: st.focusedSourceId,
    grabbedId: st.grabbedSourceId,
    hoverId: st.hoverSourceId,
    cursor: st.cursor.right,
    pinching: gests.right.state === 'pinching',
    levels,
  });
  overlay.render(frame, gests);
  ui.frame(levels, !!(frame.right || frame.left), { gests, now, flash: controller.flash, bump: controller.bump });
  scope.render(engine.analysers.master, engine.ctx.sampleRate);
  if (scene3 && st.quality === 'high') scene3.render(now, dt, st, engine.analysers, engine.ctx.sampleRate);
  debug.update(now, {
    renderFps,
    trackFps: tracker?.stats.trackFps,
    trackMs: tracker?.stats.trackMs,
    delegate: tracker?.stats.delegate ?? 'n/a',
    latency: engine.latency,
    inputMode: st.inputMode,
    spatialMode: st.spatialMode,
    gests,
  });
}

if (savedCal) ui.setCalibState('calibrated');

// Reflect initial state in the UI before Start.
ui.setSeg(ui.els.spatialSeg, 'hrtf');
ui.setSeg(ui.els.inputSeg, 'mouse');
