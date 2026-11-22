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

function pinkBuffer(ctx, seconds) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179;
    b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522;
    b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  // short fades so the loop seam doesn't click
  const f = Math.floor(ctx.sampleRate * 0.03);
  for (let i = 0; i < f; i++) {
    d[i] *= i / f;
    d[n - 1 - i] *= i / f;
  }
  return buf;
}

const RAIN_LEN = 16;
function rain(ctx) {
  const s = ctx.createBufferSource();
  s.buffer = pinkBuffer(ctx, RAIN_LEN);
  const hp = new BiquadFilterNode(ctx, { type: 'highpass', frequency: 300 });
  const lp = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 5000 });
  const g = ctx.createGain();
  g.gain.value = 0.7;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.2;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.2;
  lfo.connect(lfoGain).connect(g.gain);
  s.connect(hp).connect(lp).connect(g).connect(ctx.destination);
  s.start(0);
  lfo.start(0);
  const noise = noiseBuffer(ctx);
  for (let i = 0; i < 120; i++) {
    const t = Math.random() * (RAIN_LEN - 0.1);
    const n = ctx.createBufferSource();
    n.buffer = noise;
    const bp = new BiquadFilterNode(ctx, { type: 'bandpass', frequency: 3000 + Math.random() * 5000, Q: 2 });
    const dg = ctx.createGain();
    env(dg, t, 0.15 + Math.random() * 0.2, 0.001, 0.02);
    n.connect(bp).connect(dg).connect(ctx.destination);
    n.start(t, Math.random() * 0.5, 0.05);
  }
}

const PENTATONIC = [69, 72, 74, 76, 79, 81];
function bells(ctx) {
  for (let t = 0.4; t < RAIN_LEN - 3; t += 1.2 + Math.random() * 0.6) {
    const f0 = midi(PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)]);
    for (const [k, amp] of [[1, 1], [2.76, 0.5], [5.4, 0.25]]) {
      const o = ctx.createOscillator();
      o.frequency.value = f0 * k;
      const g = ctx.createGain();
      env(g, t, 0.3 * amp, 0.003, 2.5 / k);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 3);
    }
  }
}

const NOISE_LEN = 4.8;
function testNoise(ctx) {
  const pink = pinkBuffer(ctx, NOISE_LEN);
  for (let t = 0; t < NOISE_LEN - 0.3; t += 0.6) {
    const s = ctx.createBufferSource();
    s.buffer = pink;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1, t + 0.01);
    g.gain.setValueAtTime(1, t + 0.23);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.25);
    s.connect(g).connect(ctx.destination);
    s.start(t, t, 0.26);
  }
}

async function render(fn, len = LEN) {
  const ctx = new OfflineAudioContext(1, Math.floor(SR * len), SR);
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

export async function buildRainAndBells() {
  const [r, b] = await Promise.all([render(rain, RAIN_LEN), render(bells, RAIN_LEN)]);
  return {
    name: 'Rain and Bells',
    stems: [
      { name: 'Rain', buffer: r, az: 0, el: 0, dist: 3 },
      { name: 'Bells', buffer: b, az: 50, el: 0, dist: 1.5 },
    ],
  };
}

export async function buildTestNoise() {
  const n = await render(testNoise, NOISE_LEN);
  return { name: 'Test Noise', stems: [{ name: 'Noise', buffer: n, az: 0, el: 0, dist: 1.5 }] };
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
