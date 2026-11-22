import { sourceColor } from '../visuals/sourceColors.js';

const $ = (id) => document.getElementById(id);

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
    pillInput: $('pillInput'),
    pillFps: $('pillFps'),
    pillSpatial: $('pillSpatial'),
    camCard: $('camCard'),
    camLabel: $('camLabel'),
  };

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
    const b = e.target.closest?.('.btn, .seg-btn');
    if (!b) return;
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height);
    const span = document.createElement('span');
    span.className = 'ripple';
    span.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    if (!b.classList.contains('seg-btn')) {
      b.appendChild(span);
      setTimeout(() => span.remove(), 650);
    }
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
  els.btnPlay.addEventListener('click', () => actions.togglePlay());
  els.trackSelect.addEventListener('change', () => actions.setTrack(Number(els.trackSelect.value)));

  // ---------- pills ----------
  function pop(el) {
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    setTimeout(() => el.classList.remove('pop'), 350);
  }

  // ---------- sources list ----------
  let listKey = '';
  const rows = new Map();
  function renderSources() {
    const { sources } = store.state;
    const key = sources.map((s) => s.id).join(',');
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
  });

  // ---------- per-frame updates ----------
  let frames = 0;
  return {
    toast,
    setSeg,
    els,
    /** Called each animation frame (cheap, only writes on change). */
    frame(levels, tracking) {
      const { sources, focusedSourceId, grabbedSourceId } = store.state;
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
      const f = sources.find((s) => s.id === (grabbedSourceId ?? focusedSourceId));
      if (frames++ % 3 === 0) {
        els.readout.innerHTML = f
          ? `<b>${f.name}</b> &nbsp;${Math.round(f.az)}° left/right · ${Math.round(f.el)}° height · ${f.dist.toFixed(1)} m away`
          : '';
      }
      els.camCard.classList.toggle('tracking', tracking);
    },
    setFps(fps, mode) {
      els.pillFps.textContent = `${Math.round(fps)} fps`;
      els.pillFps.className = `pill ${fps >= 25 ? 'good' : fps > 0 ? 'bad' : ''}`;
    },
  };
}
