import { CONFIG } from '../config.js';
import { handToSpherical, clamp } from '../mapping/handToAudio.js';
import { PARAMS, PARAM_KEYS } from '../audio/params.js';

const PARAM_BY_FINGERS = Object.fromEntries(PARAM_KEYS.filter((k) => PARAMS[k].fingers).map((k) => [PARAMS[k].fingers, k]));

/**
 * Turns gesture events into state changes and audio calls.
 * The only module (besides main) that bridges gestures → store → engine.
 */
export function createController({ store, engine, stage, ui, actions, a11y, logger }) {
  let grab = null; // { id, dAz, dEl, ratio }
  let adj = null; // { key, startValue, startY, tick }
  const lastParamLog = {}; // key → ms, throttle for param logging
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
    if (logger?.active && performance.now() - (lastParamLog[key] ?? 0) > 100) {
      lastParamLog[key] = performance.now();
      const f = targets[0];
      logger.log('param', { source_id: f?.id, param: key, value: Math.round(v * 100) / 100 });
    }
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
      a11y?.miss();
      logger?.log('grab_miss', { az: cursor.az, el: cursor.el });
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
    a11y?.grab();
    logger?.log('grab', { source_id: source.id, az: source.az, el: source.el, dist: source.dist });
  }

  function grabEnd() {
    if (!grab) return;
    const s = sourceById(grab.id);
    logger?.log('release', { source_id: grab.id, az: s?.az, el: s?.el, dist: s?.dist });
    a11y?.release();
    stage.burst(grab.id, false);
    grab = null;
    store.set({ grabbedSourceId: null });
  }

  function adjustStart(y) {
    const key = store.state.selectedParam;
    const f = sourceById(store.state.focusedSourceId) ?? store.state.sources[0];
    if (!f) return;
    adj = { key, startValue: f.params[key], startY: y, tick: Math.floor(((f.params[key] - PARAMS[key].min) / (PARAMS[key].max - PARAMS[key].min)) * 10) };
    logger?.log('adjust_start', { source_id: f.id, param: key, value: f.params[key] });
  }

  function adjustEnd() {
    if (!adj) return;
    const f = sourceById(store.state.focusedSourceId);
    const def = PARAMS[adj.key];
    const v = f?.params[adj.key];
    if (v !== undefined) {
      a11y?.adjustEnd(def.label, def.format(v));
      logger?.log('adjust_end', { source_id: f.id, param: adj.key, value: v });
    }
    adj = null;
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
    get lastCursor() {
      return store.state.cursor.right;
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
            logger?.log('swipe', { extra: { dir: ev.dir } });
            actions.changeTrack(ev.dir === 'right' ? 1 : -1);
            break;
          case 'select': {
            const key = PARAM_BY_FINGERS[ev.count];
            if (key) {
              selectParam(key);
              a11y?.select(PARAMS[key].label);
              logger?.log('select', { param: key });
            }
            break;
          }
          case 'adjustStart': adjustStart(ev.y); break;
          case 'adjustEnd': adjustEnd(); break;
          case 'reset': {
            const key = st.selectedParam;
            setParam(key, PARAMS[key].default);
            ui.toast(`${PARAMS[key].label} reset`, { ms: 1400 });
            flash.reset = now;
            a11y?.reset();
            logger?.log('reset', { param: key });
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
        const f = sourceById(st.focusedSourceId);
        if (f) {
          const d = PARAMS[adj.key];
          const bucket = Math.floor(((f.params[adj.key] - d.min) / (d.max - d.min)) * 10);
          if (bucket !== adj.tick) {
            adj.tick = bucket;
            a11y?.tick(); // soft click each time the value crosses 10% of its range
          }
        }
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
      if (hoverId !== st.hoverSourceId) {
        store.set({ hoverSourceId: hoverId });
        if (hoverId !== null) a11y?.hover(sourceById(hoverId)?.name ?? '');
      }

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
