import { sourceColor } from '../visuals/sourceColors.js';
import { CONFIG } from '../config.js';
import { PARAMS, PARAM_KEYS } from '../audio/params.js';

const $ = (id) => document.getElementById(id);

const POS_SLIDERS = [
  { key: 'az', label: 'Left/Right', min: -90, max: 90, step: 1, fmt: (v) => `${Math.round(v)}°` },
  { key: 'el', label: 'Height', min: -30, max: 45, step: 1, fmt: (v) => `${Math.round(v)}°` },
  { key: 'dist', label: 'Distance', min: 0.5, max: 5, step: 0.05, fmt: (v) => `${v.toFixed(1)} m` },
];

const CHIPS = ['g-grab', 'g-swipe', 'g-select', 'g-adjust', 'g-fist'];

/** Panel + HUD + toasts. Reads the store; calls back through `actions`. */
export function createUI({ store, actions }) {
  const els = {
    toasts: $('toasts'),
    hint: $('hint'),
    hintText: $('hintText'),
    readout: $('readout'),
    list: $('sourceList'),
    trackSelect: $('trackSelect'),
    btnPlay: $('btnPlay'),
    spatialSeg: $('spatialSeg'),
    inputSeg: $('inputSeg'),
    toneSeg: $('toneSeg'),
    toneTarget: $('toneTarget'),
    pillInput: $('pillInput'),
    pillFps: $('pillFps'),
    pillSpatial: $('pillSpatial'),
    camCard: $('camCard'),
    camLabel: $('camLabel'),
    sliders: $('sliders'),
    paramCard: $('paramCard'),
    paramName: $('paramName'),
    paramVal: $('paramVal'),
    paramFill: $('paramFill'),
    paramSub: $('paramSub'),
    help: $('help'),
    dropzone: $('dropzone'),
    fileInput: $('fileInput'),
  };
  const chips = Object.fromEntries(CHIPS.map((id) => [id, $(id)]));
  for (const id of ['g-select', 'g-adjust', 'g-fist']) chips[id].classList.add('left');

  // ---------- toasts ----------
  function toast(msg, { warn = false, ms = 3200 } = {}) {
    for (const t of els.toasts.children) if (t.textContent === msg) return; // dedupe
    const el = document.createElement('div');
    el.className = `toast${warn ? ' warn' : ''}`;
    el.textContent = msg;
    els.toasts.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, ms);
  }

  // ---------- button ripple feedback ----------
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest?.('.btn');
    if (!b) return;
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    b.appendChild(span);
    setTimeout(() => span.remove(), 650);
  });

  // ---------- hint (cross-fade) ----------
  let hintShown = '';
  function setHint(text, active) {
    els.hint.classList.toggle('active', !!active);
    if (text === hintShown) return;
    hintShown = text;
    els.hint.classList.add('swap');
    setTimeout(() => {
      els.hintText.textContent = text;
      els.hint.classList.remove('swap');
    }, 140);
  }

  // ---------- segmented controls ----------
  function setSeg(seg, mode) {
    const btns = [...seg.querySelectorAll('.seg-btn')];
    const idx = Math.max(0, btns.findIndex((b) => b.dataset.mode === mode));
    seg.dataset.active = String(idx);
    btns.forEach((b, i) => b.classList.toggle('active', i === idx));
  }
  els.spatialSeg.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (b) actions.setSpatialMode(b.dataset.mode);
  });
  els.inputSeg.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (b) actions.setInputMode(b.dataset.mode);
  });
  els.toneSeg.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (b) actions.setApplyTone(b.dataset.mode);
  });
  els.btnPlay.addEventListener('click', () => actions.togglePlay());
  els.trackSelect.addEventListener('change', () => actions.setTrack(Number(els.trackSelect.value)));

  // ---------- upload / drag & drop ----------
  $('btnUpload').addEventListener('click', () => els.fileInput.click());
  els.fileInput.addEventListener('change', () => {
    const f = els.fileInput.files?.[0];
    if (f) actions.upload(f);
    els.fileInput.value = '';
  });
  let dragDepth = 0;
  window.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    dragDepth++;
    els.dropzone.classList.add('on');
  });
  window.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) els.dropzone.classList.remove('on');
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    els.dropzone.classList.remove('on');
    const f = e.dataTransfer?.files?.[0];
    if (f && store.state.started) actions.upload(f);
  });

  // ---------- help overlay ----------
  function showHelp(on = els.help.hidden) {
    els.help.hidden = !on;
  }
  $('btnHelp').addEventListener('click', () => showHelp(true));
  $('helpClose').addEventListener('click', () => showHelp(false));
  els.help.addEventListener('click', (e) => e.target === els.help && showHelp(false));
  window.addEventListener('keydown', (e) => e.key === 'Escape' && showHelp(false));

  // ---------- pills ----------
  function pop(el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    setTimeout(() => el.classList.remove('pop'), 350);
  }

  // ---------- sliders (two-way synced with gestures) ----------
  const sliderRows = new Map();
  let dragging = null;
  function buildSliders() {
    els.sliders.textContent = '';
    const defs = [
      ...POS_SLIDERS.map((d) => ({ ...d, kind: 'pos' })),
      ...PARAM_KEYS.map((k) => ({ key: k, label: PARAMS[k].label, min: PARAMS[k].min, max: PARAMS[k].max, step: PARAMS[k].step, fmt: PARAMS[k].format, kind: 'param' })),
    ];
    defs.forEach((d, i) => {
      const row = document.createElement('div');
      row.className = `sl${i === POS_SLIDERS.length ? ' sep' : ''}`;
      row.dataset.key = d.key;
      row.innerHTML = `<label for="sl-${d.key}">${d.label}</label><input id="sl-${d.key}" type="range" min="${d.min}" max="${d.max}" step="${d.step}"><output></output>`;
      const input = row.querySelector('input');
      const out = row.querySelector('output');
      input.addEventListener('pointerdown', () => { dragging = d.key; });
      window.addEventListener('pointerup', () => { dragging = null; });
      input.addEventListener('input', () => {
        const v = Number(input.value);
        if (d.kind === 'pos') actions.setPosition(store.state.focusedSourceId, { [d.key]: v });
        else actions.setParam(d.key, v);
      });
      input.addEventListener('dblclick', () => d.kind === 'param' && actions.resetParam(d.key));
      if (d.kind === 'param' && PARAMS[d.key].fingers) {
        row.querySelector('label').addEventListener('click', () => actions.selectParam(d.key));
      }
      els.sliders.appendChild(row);
      sliderRows.set(d.key, { row, input, out, d, last: NaN });
    });
  }
  buildSliders();

  // ---------- sources list ----------
  let listKey = '';
  const rows = new Map();
  function renderSources() {
    const { sources } = store.state;
    const key = sources.map((s) => `${s.id}:${s.name}`).join(',');
    if (key === listKey) return;
    listKey = key;
    els.list.textContent = '';
    rows.clear();
    sources.forEach((s, i) => {
      const li = document.createElement('li');
      li.className = 'source';
      li.dataset.id = s.id;
      li.style.setProperty('--c', sourceColor(s.id));
      li.style.setProperty('--i', i);
      li.tabIndex = 0;
      li.setAttribute('role', 'button');
      li.innerHTML = '<span class="swatch"></span><span class="name"></span><span class="tag">grabbed</span><span class="pos"></span><span class="meter"></span>';
      li.querySelector('.name').textContent = s.name;
      const focus = () => actions.focus(s.id);
      li.addEventListener('click', focus);
      li.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), focus()));
      els.list.appendChild(li);
      rows.set(s.id, { li, pos: li.querySelector('.pos'), last: '' });
    });
  }

  function renderTracks() {
    const { tracks, trackIndex } = store.state;
    els.trackSelect.textContent = '';
    tracks.forEach((t, i) => els.trackSelect.add(new Option(t.name, String(i), false, i === trackIndex)));
  }

  // ---------- reactive bits ----------
  let prevSpatial = store.state.spatialMode;
  let prevParam = store.state.selectedParam;
  store.subscribe((s, patch) => {
    if ('sources' in patch) renderSources();
    if ('tracks' in patch || 'trackIndex' in patch) renderTracks();
    if ('hint' in patch || 'hintActive' in patch) setHint(s.hint, s.hintActive);
    if ('spatialMode' in patch) {
      setSeg(els.spatialSeg, s.spatialMode);
      els.pillSpatial.textContent = s.spatialMode === 'hrtf' ? '3D · HRTF' : 'Stereo';
      if (s.spatialMode !== prevSpatial) pop(els.pillSpatial);
      prevSpatial = s.spatialMode;
    }
    if ('inputMode' in patch) {
      setSeg(els.inputSeg, s.inputMode);
      els.pillInput.textContent = s.inputMode === 'camera' ? 'Camera' : 'Mouse';
      els.camLabel.textContent = s.inputMode === 'camera' ? 'Camera' : 'Mouse mode';
      pop(els.pillInput);
    }
    if ('playing' in patch) els.btnPlay.classList.toggle('paused', !s.playing);
    if ('applyToneTo' in patch) {
      setSeg(els.toneSeg, s.applyToneTo);
      els.toneTarget.textContent = s.applyToneTo === 'all' ? 'all sounds' : 'focused sound';
    }
    if ('selectedParam' in patch && s.selectedParam !== prevParam) {
      prevParam = s.selectedParam;
      els.paramCard.classList.remove('changed');
      void els.paramCard.offsetWidth;
      els.paramCard.classList.add('changed');
    }
  });

  function fire(chipId) {
    const c = chips[chipId];
    c.classList.remove('fired');
    void c.offsetWidth;
    c.classList.add('fired');
  }

  // ---------- per-frame updates ----------
  let frames = 0;
  return {
    toast,
    setSeg,
    showHelp,
    els,
    /** Called each animation frame (cheap, only writes on change). */
    frame(levels, tracking, { gests, now, flash, bump }) {
      const st = store.state;
      const { sources, focusedSourceId, grabbedSourceId } = st;
      for (const s of sources) {
        const row = rows.get(s.id);
        if (!row) continue;
        row.li.style.setProperty('--lvl', (levels.get(s.id) ?? 0).toFixed(3));
        row.li.classList.toggle('focused', s.id === focusedSourceId);
        row.li.classList.toggle('grabbed', s.id === grabbedSourceId);
        const txt = `${Math.round(s.az)}° az · ${Math.round(s.el)}° el · ${s.dist.toFixed(1)} m`;
        if (txt !== row.last) {
          row.last = txt;
          row.pos.textContent = txt;
        }
      }
      const focused = sources.find((s) => s.id === focusedSourceId);
      const f = sources.find((s) => s.id === (grabbedSourceId ?? focusedSourceId));
      if (frames++ % 3 === 0) {
        els.readout.innerHTML = f
          ? `<b>${f.name}</b> &nbsp;${Math.round(f.az)}° left/right · ${Math.round(f.el)}° height · ${f.dist.toFixed(1)} m away`
          : '';
      }
      els.camCard.classList.toggle('tracking', tracking);

      // sliders mirror the focused source
      if (focused) {
        for (const [key, r] of sliderRows) {
          const v = r.d.kind === 'pos' ? focused[key] : focused.params[key];
          if (v !== r.last) {
            r.last = v;
            if (dragging !== key) r.input.value = String(v);
            r.input.style.setProperty('--fill', `${((v - r.d.min) / (r.d.max - r.d.min)) * 100}%`);
            r.out.textContent = r.d.fmt(v);
          }
          r.row.classList.toggle('selected', r.d.kind === 'param' && key === st.selectedParam);
        }
      }

      // selected-parameter card
      const def = PARAMS[st.selectedParam];
      if (focused) {
        const v = focused.params[st.selectedParam];
        els.paramName.textContent = def.label;
        els.paramVal.textContent = def.format(v);
        const t = (v - def.min) / (def.max - def.min);
        els.paramFill.style.setProperty('--v', t.toFixed(3));
        els.paramFill.parentElement.style.setProperty('--d', `${((def.default - def.min) / (def.max - def.min)) * 100}%`);
      }
      els.paramCard.classList.toggle('bump', now - bump.t < 250);

      // gesture chips: active state + hold progress
      const L = gests.left;
      const R = gests.right;
      const leftOpen = L.state === 'open';
      const set = (id, active, p = 0) => {
        chips[id].classList.toggle('active', active);
        chips[id].style.setProperty('--p', Math.min(1, Math.max(0, p)).toFixed(2));
      };
      set('g-grab', R.state === 'pinching');
      set('g-swipe', now - flash.swipe < 700);
      const selecting = leftOpen && L.count >= 1;
      set('g-select', selecting, L.holdMs / CONFIG.SELECT_HOLD_MS);
      set('g-adjust', L.state === 'pinching');
      const fisting = leftOpen && L.count === 0;
      set('g-fist', fisting, L.holdMs / CONFIG.FIST_HOLD_MS);
      for (const ev of gests.events) {
        if (ev.type === 'grabStart') fire('g-grab');
        else if (ev.type === 'swipe') fire('g-swipe');
        else if (ev.type === 'select') fire('g-select');
        else if (ev.type === 'adjustStart') fire('g-adjust');
        else if (ev.type === 'reset') fire('g-fist');
      }
      let sub = 'Left hand: hold up 1–5 fingers to switch';
      if (L.state === 'pinching') sub = 'Pinch + drag up / down to change';
      else if (selecting) {
        const key = PARAM_KEYS.find((k) => PARAMS[k].fingers === L.count);
        sub = key ? `${L.count} finger${L.count > 1 ? 's' : ''} → ${PARAMS[key].label}…` : sub;
      } else if (fisting) sub = 'Hold the fist to reset';
      if (els.paramSub.textContent !== sub) els.paramSub.textContent = sub;
    },
    setFps(fps) {
      els.pillFps.textContent = `${Math.round(fps)} fps`;
      els.pillFps.className = `pill ${fps >= 25 ? 'good' : fps > 0 ? 'bad' : ''}`;
    },
  };
}
