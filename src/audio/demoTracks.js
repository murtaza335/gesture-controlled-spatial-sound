// Procedural demo audio via OfflineAudioContext. No asset files, no licensing.
const SR = 44100;
const BPM = 100;
const BEAT = 60 / BPM; // 0.6 s
const BAR = BEAT * 4; // 2.4 s
const BARS = 8;
const LEN = BAR * BARS; // 19.2 s

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

function noiseBuffer(ctx, seconds = 1) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(gain, t, peak, attack, decay) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function drums(ctx) {
  const noise = noiseBuffer(ctx);
  for (let b = 0; b < BARS * 4; b++) {
    const t = b * BEAT;
    if (b % 4 === 0 || b % 4 === 2) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      env(g, t, 1, 0.002, 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 0.4);
    } else {
      const s = ctx.createBufferSource();
      s.buffer = noise;
      const f = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 1800, Q: 0.8 });
      const g = ctx.createGain();
      env(g, t, 0.7, 0.002, 0.15);
      s.connect(f).connect(g).connect(ctx.destination);
      s.start(t, Math.random() * 0.5, 0.25);
    }
  }
  for (let i = 0; i < BARS * 8; i++) {
    const t = i * BEAT * 0.5;
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const f = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 7000 });
    const g = ctx.createGain();
    env(g, t, i % 2 ? 0.18 : 0.3, 0.001, 0.04);
    s.connect(f).connect(g).connect(ctx.destination);
    s.start(t, Math.random() * 0.5, 0.08);
  }
}

const ROOTS = [33, 29, 36, 31]; // A1 F1 C2 G1, two bars each
const CHORDS = [
  [57, 60, 64], // Am
  [53, 57, 60], // F
  [60, 64, 67], // C
  [55, 59, 62], // G
];

function bass(ctx) {
  const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 600 });
  lp.connect(ctx.destination);
  for (let i = 0; i < BARS * 8; i++) {
    const t = i * BEAT * 0.5;
    const root = ROOTS[Math.floor(i / 16)];
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = midi(root);
    const g = ctx.createGain();
    env(g, t, 0.8, 0.005, 0.25);
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + 0.35);
  }
}

function pad(ctx) {
  const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 1200 });
  lp.connect(ctx.destination);
  for (let c = 0; c < 4; c++) {
    const t = c * BAR * 2;
    const dur = BAR * 2;
    for (const [i, m] of CHORDS[c].entries()) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(m);
      o.detune.value = (i - 1) * 9;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.5);
      g.gain.setValueAtTime(0.2, t + dur - 1);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }
}

function lead(ctx) {
  const pattern = [0, 1, 2, 1];
  for (let i = 0; i < BARS * 16; i++) {
    const t = i * BEAT * 0.25;
    const chord = CHORDS[Math.floor(i / 32)];
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = midi(chord[pattern[i % 4]] + 12);
    const g = ctx.createGain();
    env(g, t, 0.6, 0.004, 0.12);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + 0.2);
  }
}

async function render(fn) {
  const ctx = new OfflineAudioContext(1, Math.floor(SR * LEN), SR);
  fn(ctx);
  const buf = await ctx.startRendering();
  // Normalize to a consistent peak.
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  const k = peak > 0 ? 0.8 / peak : 1;
  for (let i = 0; i < d.length; i++) d[i] *= k;
  return buf;
}

/** Builds the Demo Band: 4 stems of identical length so they loop in sync. */
export async function buildDemoBand() {
  const [d, b, p, l] = await Promise.all([render(drums), render(bass), render(pad), render(lead)]);
  return {
    name: 'Demo Band',
    stems: [
      { name: 'Drums', buffer: d, az: 0, el: 0, dist: 1.5 },
      { name: 'Bass', buffer: b, az: -40, el: 0, dist: 1.5 },
      { name: 'Pad', buffer: p, az: 60, el: 0, dist: 1.5 },
      { name: 'Lead', buffer: l, az: -70, el: 15, dist: 1.5 },
    ],
  };
}
