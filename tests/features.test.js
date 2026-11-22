import { describe, it, expect } from 'vitest';
import { fingerCount, handScale, palmCenter, pinchRatio } from '../src/gestures/features.js';
import { makeHand, fingers, FIST } from './fixtures/handFixtures.js';

describe('features', () => {
  it('pinched hand has a small pinch ratio, open hand a large one', () => {
    expect(pinchRatio(makeHand({ pinch: 1 }))).toBeLessThan(0.1);
    expect(pinchRatio(makeHand({ pinch: 0 }))).toBeGreaterThan(0.6);
  });

  it('counts 0–5 fingers', () => {
    expect(fingerCount(makeHand({ extended: FIST }))).toBe(0);
    for (let n = 1; n <= 5; n++) {
      expect(fingerCount(makeHand({ extended: fingers(n) }))).toBe(n);
    }
  });

  it('scale grows with fixture scale', () => {
    expect(handScale(makeHand({ scale: 0.3 }))).toBeGreaterThan(handScale(makeHand({ scale: 0.15 })));
    expect(handScale(makeHand({ scale: 0.2 }))).toBeCloseTo(0.2, 3);
  });

  it('palm center follows the wrist', () => {
    const a = palmCenter(makeHand({ wrist: { x: 0.3, y: 0.7 } }));
    const b = palmCenter(makeHand({ wrist: { x: 0.6, y: 0.7 } }));
    expect(b.x - a.x).toBeCloseTo(0.3, 3);
  });
});
