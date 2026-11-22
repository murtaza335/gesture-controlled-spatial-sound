import { CONFIG } from '../../src/config.js';

// Template hand in units of hand scale (wrist = 0,0; wrist→middle MCP = 1). y negative = up.
const MCP = { 5: [-0.33, -0.97], 9: [0, -1], 13: [0.33, -0.95], 17: [0.62, -0.8] };
const FINGERS = [
  { mcp: 5, ids: [5, 6, 7, 8] },
  { mcp: 9, ids: [9, 10, 11, 12] },
  { mcp: 13, ids: [13, 14, 15, 16] },
  { mcp: 17, ids: [17, 18, 19, 20] },
];
const PINCH_POINT = [-0.6, -1.25];

/**
 * Build 21 landmarks (user-view coordinates, normalized) for a synthetic hand.
 * Used by tests AND by the mouse simulator so real feature extraction runs on it.
 * @param {{wrist?:{x:number,y:number}, scale?:number, extended?:boolean[], pinch?:number}} o
 *   pinch: 0 = open, 1 = fully pinched
 */
export function makeHand({
  wrist = { x: 0.5, y: 0.7 },
  scale = 0.18,
  extended = [true, true, true, true, true],
  pinch = 0,
} = {}) {
  /** @type {number[][]} */
  const u = Array(21).fill(null);
  u[0] = [0, 0];
  u[1] = [-0.3, -0.3];
  u[2] = [-0.5, -0.5];
  u[3] = [-0.7, -0.7];
  u[4] = extended[0] ? [-1.05, -0.85] : [-0.2, -0.55];
  for (const [i, f] of FINGERS.entries()) {
    const [mx, my] = MCP[f.mcp];
    const ext = extended[i + 1];
    u[f.ids[0]] = [mx, my];
    if (ext) {
      u[f.ids[1]] = [mx, my - 0.45];
      u[f.ids[2]] = [mx, my - 0.75];
      u[f.ids[3]] = [mx, my - 0.98];
    } else {
      u[f.ids[1]] = [mx, my - 0.35];
      u[f.ids[2]] = [mx, my - 0.1];
      u[f.ids[3]] = [mx, my + 0.1];
    }
  }
  if (pinch > 0) {
    const lerp = (a, b) => [a[0] + (b[0] - a[0]) * pinch, a[1] + (b[1] - a[1]) * pinch];
    u[4] = lerp(u[4], PINCH_POINT);
    u[8] = lerp(u[8], PINCH_POINT);
  }
  return u.map(([ux, uy]) => ({
    x: wrist.x + (ux * scale) / CONFIG.ASPECT,
    y: wrist.y + uy * scale,
    z: 0,
  }));
}

export const FIST = [false, false, false, false, false];
export function fingers(n) {
  // 1..5 → thumb first? Use index-first for 1–4, thumb last, to mimic natural counting
  const order = [1, 2, 3, 4, 0];
  const e = [false, false, false, false, false];
  for (let i = 0; i < n; i++) e[order[i]] = true;
  return e;
}
