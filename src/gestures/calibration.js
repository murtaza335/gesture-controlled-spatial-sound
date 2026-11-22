// @ts-check
/**
 * Calibration: the user holds the right hand still at six extremes; we record them,
 * trim a 5% margin so the edges are easy to reach, validate, and persist.
 * The flow is pure (takes hand samples + timestamps); persistence helpers wrap localStorage in try/catch.
 */

export const STEPS = [
  { key: 'left', prompt: 'Reach your hand to the far LEFT', read: (h) => h.palm.x },
  { key: 'right', prompt: 'Now the far RIGHT', read: (h) => h.palm.x, check: (v, raw) => v > raw.left + 0.1 },
  { key: 'high', prompt: 'Raise your hand HIGH', read: (h) => h.palm.y },
  { key: 'low', prompt: 'Lower your hand LOW', read: (h) => h.palm.y, check: (v, raw) => v > raw.high + 0.1 },
  { key: 'near', prompt: 'Hold your hand CLOSE to the camera', read: (h) => h.scale },
  { key: 'far', prompt: 'Now FAR from the camera', read: (h) => h.scale, check: (v, raw) => v < raw.near * 0.85 },
];

/** Turns the six raw extremes into a MAP. Returns {ok:true,map} or {ok:false,reason}. */
export function finalizeCalibration(raw, defaults, margin = 0.05) {
  const xr = raw.right - raw.left;
  const yr = raw.low - raw.high;
  const sr = raw.near - raw.far;
  const map = {
    ...defaults,
    xMin: raw.left + margin * xr,
    xMax: raw.right - margin * xr,
    yMin: raw.high + margin * yr,
    yMax: raw.low - margin * yr,
    scaleNear: raw.near - margin * sr,
    scaleFar: raw.far + margin * sr,
  };
  if (map.xMax - map.xMin <= 0.2) return { ok: false, reason: 'Left/right reach was too small. Reach further apart and try again.' };
  if (map.yMax - map.yMin <= 0.2) return { ok: false, reason: 'Up/down reach was too small. Reach higher and lower and try again.' };
  if (!(map.scaleNear > map.scaleFar * 1.3)) return { ok: false, reason: 'Close and far hand sizes were too similar. Move more toward / away from the camera.' };
  return { ok: true, map };
}

export function createCalibration({ stillMs = 1000, stillDist = 0.01, pauseMs = 900 } = {}) {
  let active = false;
  let step = 0;
  let raw = {};
  let anchor = null;
  let since = 0;
  let pauseUntil = 0;
  let note = '';

  const status = (extra = {}) => ({
    active,
    step,
    total: STEPS.length,
    prompt: active && STEPS[step] ? STEPS[step].prompt : '',
    progress: 0,
    note,
    done: false,
    ...extra,
  });

  return {
    get active() {
      return active;
    },
    start() {
      active = true;
      step = 0;
      raw = {};
      anchor = null;
      pauseUntil = 0;
      note = '';
    },
    cancel() {
      active = false;
    },
    /** @param {{palm:{x:number,y:number}, scale:number}|null} hand @param {number} now @param {any} defaults */
    update(hand, now, defaults) {
      if (!active) return status();
      if (now < pauseUntil) return status({ progress: 1, note: 'Got it ✓' });
      if (!hand || !hand.palm) {
        anchor = null;
        note = 'Show your right hand';
        return status();
      }
      const cur = { x: hand.palm.x, y: hand.palm.y, s: hand.scale };
      if (!anchor || Math.hypot(cur.x - anchor.x, cur.y - anchor.y) > stillDist || Math.abs(cur.s - anchor.s) > stillDist) {
        anchor = cur;
        since = now;
        note = 'Hold still…';
        return status();
      }
      const progress = Math.min(1, (now - since) / stillMs);
      if (progress < 1) return status({ progress });

      const def = STEPS[step];
      const v = def.read(hand);
      if (def.check && !def.check(v, raw)) {
        since = now; // not far enough from the previous point: keep waiting
        note = 'A bit further…';
        return status();
      }
      raw[def.key] = v;
      step++;
      anchor = null;
      pauseUntil = now + pauseMs;
      note = '';
      if (step >= STEPS.length) {
        active = false;
        const res = finalizeCalibration(raw, defaults);
        return { ...status({ progress: 1, done: true }), ...res };
      }
      return status({ progress: 1, note: 'Got it ✓' });
    },
  };
}

// ---------- persistence ----------
export function loadCalibration(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null');
    return v && typeof v.xMin === 'number' ? v : null;
  } catch {
    return null;
  }
}
export function saveCalibration(key, map) {
  try {
    localStorage.setItem(key, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}
export function clearCalibration(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
