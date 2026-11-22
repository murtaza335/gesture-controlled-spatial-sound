// @ts-check
import { CONFIG } from '../config.js';

/** Aspect-corrected distance between two landmarks. */
export function dist(a, b, aspect = CONFIG.ASPECT) {
  const dx = (a.x - b.x) * aspect;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/** Wrist → middle MCP distance. Proxy for depth. */
export function handScale(lm) {
  return dist(lm[0], lm[9]);
}

/** Thumb tip ↔ index tip distance relative to hand size. */
export function pinchRatio(lm) {
  return dist(lm[4], lm[8]) / Math.max(handScale(lm), 1e-6);
}

/** @returns {boolean[]} [thumb, index, middle, ring, pinky] */
export function fingerExtended(lm) {
  const scale = Math.max(handScale(lm), 1e-6);
  const thumb = dist(lm[4], lm[5]) / scale > CONFIG.THUMB_EXT_RATIO;
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  const rest = tips.map(
    (t, i) => dist(lm[t], lm[0]) > dist(lm[pips[i]], lm[0]) * CONFIG.FINGER_EXT_RATIO,
  );
  return [thumb, ...rest];
}

export function fingerCount(lm) {
  return fingerExtended(lm).filter(Boolean).length;
}

export function palmCenter(lm) {
  const ids = [0, 5, 9, 13, 17];
  let x = 0;
  let y = 0;
  for (const i of ids) {
    x += lm[i].x;
    y += lm[i].y;
  }
  return { x: x / ids.length, y: y / ids.length };
}

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
