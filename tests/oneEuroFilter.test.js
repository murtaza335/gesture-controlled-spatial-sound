import { describe, it, expect } from 'vitest';
import { OneEuroFilter } from '../src/filters/oneEuroFilter.js';

describe('OneEuroFilter', () => {
  it('keeps constant input constant', () => {
    const f = new OneEuroFilter({ minCutoff: 1, beta: 0.5 });
    let v = 0;
    for (let i = 0; i < 50; i++) v = f.filter(0.4, i * 16);
    expect(v).toBeCloseTo(0.4, 6);
  });

  it('converges after a step', () => {
    const f = new OneEuroFilter({ minCutoff: 1.5, beta: 0.5 });
    for (let i = 0; i < 10; i++) f.filter(0, i * 16);
    let v = 0;
    for (let i = 10; i < 200; i++) v = f.filter(1, i * 16);
    expect(v).toBeGreaterThan(0.99);
  });

  it('higher beta lags less on a ramp', () => {
    const run = (beta) => {
      const f = new OneEuroFilter({ minCutoff: 1, beta });
      let v = 0;
      for (let i = 0; i < 60; i++) v = f.filter(i * 0.02, i * 16);
      return 59 * 0.02 - v; // lag
    };
    expect(run(2)).toBeLessThan(run(0));
  });
});
