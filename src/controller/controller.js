import { CONFIG } from '../config.js';
import { handToSpherical, clamp } from '../mapping/handToAudio.js';
import { PARAMS, PARAM_KEYS } from '../audio/params.js';

const PARAM_BY_FINGERS = Object.fromEntries(PARAM_KEYS.filter((k) => PARAMS[k].fingers).map((k) => [PARAMS[k].fingers, k]));

/**
 * Turns gesture events into state changes and audio calls.
 * The only module (besides main) that bridges gestures → store → engine.
 */
export function createController({ store, engine, stage, ui, actions }) {
  let grab = null; // { id, dAz, dEl, ratio }
  let adj = null; // { key, startValue, startY }
  let lastNow = 0;
  const flash = { swipe: 0 }; // timestamps for momentary gesture highlights
  const bump = { t: 0 }; // last param change time (HUD pulse)

  function sourceById(id) {
    return store.state.sources.find((s) => s.id === id);
  }

  function focus(id) {
    if (store.state.focusedSourceId !== id) store.set({ focusedSourceId: id });
  }

  function setHint(text, active = false) {
    if (store.state.hint !== text || store.state.hintActive !== active) store.set({ hint: text, hintActive: active });
  }

  /** Sources a tone change applies to. */
  function toneTargets() {
    const { sources, focusedSourceId, applyToneTo } = store.state;
    return applyToneTo === 'all' ? sources : sources.filter((s) => s.id === focusedSourceId);
  }

  /** Sets a tone parameter on the focused source (or all). Shared by gestures, sliders and keys. */
  function setParam(key, value, targets = toneTargets()) {
    const def = PARAMS[key];
    const v = clamp(value, def.min, def.max);
    for (const s of targets) {
      if (s.params[key] === v) continue;
      s.params[key] = v;
      engine.setSourceParam(s.id, key, v);
    }
    bump.t = performance.now();
  }

  /** Direct position set (sliders / arrow keys). */
  function setPosition(id, patch) {
    const s = sourceById(id);
    if (!s) return;
    const m = CONFIG.MAP;
    if (patch.az !== undefined) s.az = clamp(patch.az, m.azMin, m.azMax);
    if (patch.el !== undefined) s.el = clamp(patch.el, m.elMin, m.elMax);
    if (patch.dist !== undefined) s.dist = clamp(patch.dist, m.distMin, m.distMax);
    engine.setSourcePosition(s.id, s.az, s.el, s.dist);
  }

  function selectParam(key) {
    if (store.state.selectedParam === key) return;
    store.set({ selectedParam: key });
    ui.toast(`${PARAMS[key].label} selected`, { ms: 1400 });
  }

  function grabStart(cursor) {
    const { sources } = store.state;
    if (!cursor || !sources.length) return;
    const { source, d } = stage.nearest(cursor.az, cursor.el, sources);
    if (!source || (sources.length > 1 && d > CONFIG.GRAB_RADIUS)) {
      ui.toast('Move closer to a sound to grab it', { warn: true });
      return;
    }
    // Keep offsets so the source doesn't jump to the hand; they ease out ("magnet" feel).
    grab = {
      id: source.id,
      dAz: source.az - cursor.az,
      dEl: source.el - cursor.el,
      ratio: source.dist / cursor.dist,
    };
    store.set({ grabbedSourceId: source.id, focusedSourceId: source.id });
    stage.burst(source.id, true);
  }

  function grabEnd() {
    if (!grab) return;
    stage.burst(grab.id, false);
    grab = null;
    store.set({ grabbedSourceId: null });
  }

  function adjustStart(y) {
    const key = store.state.selectedParam;
    const f = sourceById(store.state.focusedSourceId) ?? store.state.sources[0];
    if (!f) return;
    adj = { key, startValue: f.params[key], startY: y };
  }

  return {
    grabStart,
    grabEnd,
    focus,
    setParam,
    setPosition,
    selectParam,
    toneTargets,
    flash,
    bump,
    get adjusting() {
      return !!adj;
    },
    get grabbing() {
      return !!grab;
    },
    reset() {
      if (grab) grabEnd();
      adj = null;
    },
    resetParam(key = store.state.selectedParam) {
      setParam(key, PARAMS[key].default);
    },

    /** Called once per frame. */
    update(gests, frame, now) {
      const dt = Math.min(0.1, (now - lastNow) / 1000 || 0.016);
      lastNow = now;
      const st = store.state;
      const r = gests.right;
      const l = gests.left;
      const sliderMode = st.study?.condition === 'slider';

      // cursor from the right palm
      let cursor = null;
      if (r.palm) {
        cursor = handToSpherical(r.palm, r.scale || 0.19, CONFIG.MAP);
        st.cursor.right = cursor;
      } else {
        st.cursor.right = null;
      }
      st.cursor.left = l.palm ? { count: l.count } : null;

      for (const ev of gests.events) {
        if (sliderMode) continue;
        switch (ev.type) {
          case 'grabStart': grabStart(cursor); break;
          case 'grabEnd': grabEnd(); break;
          case 'swipe':
            flash.swipe = now;
            actions.changeTrack(ev.dir === 'right' ? 1 : -1);
            break;
          case 'select': {
            const key = PARAM_BY_FINGERS[ev.count];
            if (key) selectParam(key);
            break;
          }
          case 'adjustStart': adjustStart(ev.y); break;
          case 'adjustEnd': adj = null; break;
          case 'reset': {
            const key = st.selectedParam;
            setParam(key, PARAMS[key].default);
            ui.toast(`${PARAMS[key].label} reset`, { ms: 1400 });
            flash.reset = now;
            break;
          }
          default: break;
        }
      }

      // left pinch-drag: relative adjust of the selected param
      if (adj && l.palm) {
        const def = PARAMS[adj.key];
        const v = adj.startValue + (adj.startY - l.palm.y) * (def.max - def.min) * CONFIG.ADJUST_SENSITIVITY;
        setParam(adj.key, v);
      }

      // while grabbed: follow the hand
      if (grab && cursor) {
        const s = sourceById(grab.id);
        if (s) {
          const k = Math.exp(-dt / 0.35);
          grab.dAz *= k;
          grab.dEl *= k;
          grab.ratio = 1 + (grab.ratio - 1) * k;
          s.az = clamp(cursor.az + grab.dAz, CONFIG.MAP.azMin, CONFIG.MAP.azMax);
          s.el = clamp(cursor.el + grab.dEl, CONFIG.MAP.elMin, CONFIG.MAP.elMax);
          s.dist = clamp(cursor.dist * grab.ratio, CONFIG.MAP.distMin, CONFIG.MAP.distMax);
          engine.setSourcePosition(s.id, s.az, s.el, s.dist);
        }
      }

      // hover target + hint
      let hoverId = null;
      if (cursor && !grab && st.sources.length) {
        const { source, d } = stage.nearest(cursor.az, cursor.el, st.sources);
        if (source && (st.sources.length === 1 || d <= CONFIG.GRAB_RADIUS)) hoverId = source.id;
      }
      if (hoverId !== st.hoverSourceId) store.set({ hoverSourceId: hoverId });

      if (adj) {
        setHint(`Adjusting ${PARAMS[adj.key].label} — move your left hand up / down`, true);
      } else if (grab) {
        setHint(`Moving ${sourceById(grab.id)?.name ?? 'sound'} — release to drop`, true);
      } else if (!cursor) {
        setHint(st.inputMode === 'camera' ? 'Show your right hand to the camera' : 'Move the mouse over the stage');
      } else if (hoverId !== null) {
        setHint(`Pinch to grab ${sourceById(hoverId)?.name}`, true);
      } else {
        setHint('Move closer to a sound, then pinch');
      }
    },
  };
}
