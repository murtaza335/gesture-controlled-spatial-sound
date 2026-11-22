import { sphericalToCartesian } from '../mapping/handToAudio.js';

/** Short non-speech audio cues for accessibility mode. Played through the master bus (not spatialized, except pointAt). */
export function createEarcons(engine) {
  function out() {
    return engine.masterGain;
  }

  /** One enveloped oscillator blip. `at` = seconds from now. */
  function blip(freq, at, dur, { type = 'sine', gain = 0.18, to = null, dest = out() } = {}) {
    const ctx = engine.ctx;
    if (!ctx || !dest) return;
    const t = ctx.currentTime + at;
    const o = new OscillatorNode(ctx, { type, frequency: freq });
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = new GainNode(ctx, { gain: 0 });
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  return {
    grab() { blip(660, 0, 0.1); blip(880, 0.09, 0.14); },
    release() { blip(880, 0, 0.1); blip(660, 0.09, 0.14); },
    track() { for (let i = 0; i < 3; i++) blip(740, i * 0.11, 0.08, { type: 'triangle' }); },
    reset() { blip(140, 0, 0.25, { gain: 0.4, to: 50 }); },
    tick() { blip(1800, 0, 0.025, { gain: 0.07, type: 'square' }); },
    miss() { blip(220, 0, 0.12, { type: 'sawtooth', gain: 0.08 }); },
    hover() { blip(1040, 0, 0.05, { gain: 0.1 }); },
    /** "Pointing" cue: a short blip placed at the cursor's azimuth, so you can hear where your hand is. */
    pointAt(az) {
      const ctx = engine.ctx;
      if (!ctx) return;
      const p = sphericalToCartesian(az, 0, 1.5);
      const panner = new PannerNode(ctx, { panningModel: 'HRTF', distanceModel: 'inverse', positionX: p.x, positionY: p.y, positionZ: p.z });
      panner.connect(out());
      blip(520, 0, 0.07, { gain: 0.14, dest: panner });
      setTimeout(() => panner.disconnect(), 300);
    },
  };
}
