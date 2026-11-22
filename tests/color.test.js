import { describe, it, expect } from 'vitest';
import { spectrumToColor } from '../src/visuals/color.js';

const SR = 44100;
const FFT = 512;
const bins = FFT / 2;
const make = (fn) => Uint8Array.from({ length: bins }, (_, i) => fn((i * SR) / FFT));

describe('spectrumToColor', () => {
  it('bass-only spectrum → warm hue near 25', () => {
    const c = spectrumToColor(make((f) => (f < 250 ? 200 : 0)), SR, FFT);
    expect(c.hue).toBeCloseTo(25, 0);
  });
  it('treble-only spectrum → cool hue near 210', () => {
    const c = spectrumToColor(make((f) => (f > 2000 ? 200 : 0)), SR, FFT);
    expect(c.hue).toBeCloseTo(210, 0);
  });
  it('silence → energy 0 and dim', () => {
    const c = spectrumToColor(make(() => 0), SR, FFT);
    expect(c.energy).toBe(0);
    expect(c.light).toBe(35);
  });
  it('louder → brighter', () => {
    const quiet = spectrumToColor(make(() => 20), SR, FFT);
    const loud = spectrumToColor(make(() => 220), SR, FFT);
    expect(loud.light).toBeGreaterThan(quiet.light);
  });
});
