// @ts-check
import { handScale } from '../gestures/features.js';

function alpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

/** One Euro filter: low lag on fast moves, strong smoothing when still. */
export class OneEuroFilter {
  constructor({ minCutoff = 1.0, beta = 0.0, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }

  reset() {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = 0;
  }

  /** @param {number} value @param {number} tMs */
  filter(value, tMs) {
    if (this.xPrev === null) {
      this.xPrev = value;
      this.dxPrev = 0;
      this.tPrev = tMs;
      return value;
    }
    const dt = Math.max((tMs - this.tPrev) / 1000, 1e-3);
    const dx = (value - this.xPrev) / dt;
    const edx = this.dxPrev + alpha(this.dCutoff, dt) * (dx - this.dxPrev);
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const x = this.xPrev + alpha(cutoff, dt) * (value - this.xPrev);
    this.xPrev = x;
    this.dxPrev = edx;
    this.tPrev = tMs;
    return x;
  }
}

/** One filter per landmark per axis per side, plus a heavier filter for hand scale (depth). */
export class HandSmoother {
  constructor(smooth, smoothDepth) {
    this.smooth = smooth;
    this.smoothDepth = smoothDepth;
    this.filters = { left: null, right: null };
    this.depth = { left: new OneEuroFilter(smoothDepth), right: new OneEuroFilter(smoothDepth) };
  }

  _make(side) {
    return Array.from({ length: 21 }, () => [
      new OneEuroFilter(this.smooth),
      new OneEuroFilter(this.smooth),
      new OneEuroFilter(this.smooth),
    ]);
  }

  /** @returns a new frame whose hands have smoothed landmarks and `scaleSmooth`. */
  apply(frame, now) {
    const out = { ...frame };
    for (const side of /** @type {const} */ (['left', 'right'])) {
      const hand = frame[side];
      if (!hand) {
        this.filters[side] = null;
        this.depth[side].reset();
        out[side] = null;
        continue;
      }
      if (!this.filters[side]) this.filters[side] = this._make(side);
      const fs = this.filters[side];
      const t = hand.stale ? frame.t : frame.t;
      const lm = hand.lm.map((p, i) => {
        const f = fs[i];
        for (const k of f) {
          k.minCutoff = this.smooth.minCutoff;
          k.beta = this.smooth.beta;
          k.dCutoff = this.smooth.dCutoff;
        }
        return { x: f[0].filter(p.x, t), y: f[1].filter(p.y, t), z: f[2].filter(p.z, t) };
      });
      const d = this.depth[side];
      d.minCutoff = this.smoothDepth.minCutoff;
      d.beta = this.smoothDepth.beta;
      d.dCutoff = this.smoothDepth.dCutoff;
      const scaleSmooth = d.filter(handScale(lm), t);
      out[side] = { ...hand, lm, scaleSmooth };
    }
    return out;
  }
}
