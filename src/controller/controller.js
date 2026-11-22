import { CONFIG } from '../config.js';
import { handToSpherical, clamp } from '../mapping/handToAudio.js';

/**
 * Turns gesture events into state changes and audio calls.
 * The only module (besides main) that bridges gestures → store → engine.
 */
export function createController({ store, engine, stage, ui }) {
  let grab = null; // { id, dAz, dEl, ratio }
  let lastNow = 0;

  function sourceById(id) {
    return store.state.sources.find((s) => s.id === id);
  }

  function focus(id) {
    if (store.state.focusedSourceId !== id) store.set({ focusedSourceId: id });
  }

  function setHint(text, active = false) {
    if (store.state.hint !== text || store.state.hintActive !== active) store.set({ hint: text, hintActive: active });
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

  return {
    grabStart,
    grabEnd,
    focus,
    get grabbing() {
      return !!grab;
    },

    /** Called once per frame. */
    update(gests, frame, now) {
      const dt = Math.min(0.1, (now - lastNow) / 1000 || 0.016);
      lastNow = now;
      const st = store.state;
      const r = gests.right;
      const l = gests.left;

      // cursor from the right palm
      let cursor = null;
      if (r.palm) {
        const sph = handToSpherical(r.palm, r.scale || 0.19, CONFIG.MAP);
        cursor = sph;
        st.cursor.right = sph;
      } else {
        st.cursor.right = null;
      }
      st.cursor.left = l.palm ? { count: l.count } : null;

      for (const ev of gests.events) {
        if (ev.type === 'grabStart') grabStart(cursor);
        if (ev.type === 'grabEnd') grabEnd();
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

      if (grab) {
        const s = sourceById(grab.id);
        setHint(`Moving ${s?.name ?? 'sound'} — release to drop`, true);
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
