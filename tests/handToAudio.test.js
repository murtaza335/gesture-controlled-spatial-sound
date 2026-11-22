import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { handToSpherical, sphericalToCartesian, mapRange, expMap } from '../src/mapping/handToAudio.js';

const cal = CONFIG.MAP;

describe('handToAudio', () => {
  it('center palm → az 0, edges → ±90', () => {
    expect(handToSpherical({ x: 0.5, y: 0.5 }, 0.19, cal).az).toBeCloseTo(0, 5);
    expect(handToSpherical({ x: 0.2, y: 0.5 }, 0.19, cal).az).toBeCloseTo(-90, 5);
    expect(handToSpherical({ x: 0.8, y: 0.5 }, 0.19, cal).az).toBeCloseTo(90, 5);
  });

  it('hand up raises elevation (y inverted)', () => {
    const up = handToSpherical({ x: 0.5, y: 0.2 }, 0.19, cal).el;
    const down = handToSpherical({ x: 0.5, y: 0.8 }, 0.19, cal).el;
    expect(up).toBeGreaterThan(down);
  });

  it('closer hand → smaller distance', () => {
    const near = handToSpherical({ x: 0.5, y: 0.5 }, 0.28, cal).dist;
    const far = handToSpherical({ x: 0.5, y: 0.5 }, 0.1, cal).dist;
    expect(near).toBeCloseTo(cal.distMin, 5);
    expect(far).toBeCloseTo(cal.distMax, 5);
  });

  it('spherical → cartesian', () => {
    const r = sphericalToCartesian(90, 0, 1);
    expect(r.x).toBeCloseTo(1);
    expect(r.z).toBeCloseTo(0);
    const f = sphericalToCartesian(0, 0, 1);
    expect(f.z).toBeCloseTo(-1);
  });

  it('mapRange clamps and expMap spans range', () => {
    expect(mapRange(2, 0, 1, 0, 10)).toBe(10);
    expect(expMap(0, 200, 20000)).toBeCloseTo(200);
    expect(expMap(1, 200, 20000)).toBeCloseTo(20000);
  });
});
