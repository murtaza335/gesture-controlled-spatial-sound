import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createCalibration, finalizeCalibration } from '../src/gestures/calibration.js';

const D = CONFIG.MAP;
const good = { left: 0.1, right: 0.9, high: 0.1, low: 0.9, near: 0.3, far: 0.1 };

describe('finalizeCalibration', () => {
  it('trims a 5% margin inward', () => {
    const r = finalizeCalibration(good, D);
    expect(r.ok).toBe(true);
    expect(r.map.xMin).toBeCloseTo(0.14, 5);
    expect(r.map.xMax).toBeCloseTo(0.86, 5);
    expect(r.map.scaleNear).toBeCloseTo(0.29, 5);
    expect(r.map.azMin).toBe(D.azMin); // untouched fields kept
  });
  it('rejects a tiny left/right reach', () => {
    const r = finalizeCalibration({ ...good, left: 0.45, right: 0.55 }, D);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/left\/right/i);
  });
  it('rejects similar near/far sizes', () => {
    const r = finalizeCalibration({ ...good, near: 0.2, far: 0.18 }, D);
    expect(r.ok).toBe(false);
  });
});

describe('calibration flow', () => {
  const targets = [
    { x: 0.1, y: 0.5, s: 0.2 }, { x: 0.9, y: 0.5, s: 0.2 },
    { x: 0.5, y: 0.1, s: 0.2 }, { x: 0.5, y: 0.9, s: 0.2 },
    { x: 0.5, y: 0.5, s: 0.3 }, { x: 0.5, y: 0.5, s: 0.1 },
  ];

  it('completes after six still holds', () => {
    const cal = createCalibration();
    cal.start();
    let t = 0;
    let res;
    for (const p of targets) {
      for (let i = 0; i < 160 && !(res && res.done); i++) {
        t += 16;
        res = cal.update({ palm: { x: p.x, y: p.y }, scale: p.s }, t, D);
      }
      t += 1000; // confirmation pause
    }
    expect(res.done).toBe(true);
    expect(res.ok).toBe(true);
    expect(res.map.xMax - res.map.xMin).toBeGreaterThan(0.6);
  });

  it('does not record while the hand keeps moving', () => {
    const cal = createCalibration();
    cal.start();
    let r;
    for (let t = 16; t < 3000; t += 16) r = cal.update({ palm: { x: 0.1 + (t % 200) / 1000, y: 0.5 }, scale: 0.2 }, t, D);
    expect(r.step).toBe(0);
  });

  it('waits when no hand is visible', () => {
    const cal = createCalibration();
    cal.start();
    let r;
    for (let t = 16; t < 2000; t += 16) r = cal.update(null, t, D);
    expect(r.step).toBe(0);
    expect(r.note).toMatch(/hand/i);
  });
});
