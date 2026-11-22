import { CONFIG } from '../config.js';
import { SoundSource } from './soundSource.js';
import { makeImpulse } from './impulse.js';
import { buildDemoBand, buildRainAndBells, buildTestNoise } from './demoTracks.js';
import { defaultParams } from './params.js';

/**
 * The only audio surface other modules use.
 * Create via init() inside the Start click (browser autoplay rule).
 */
export const engine = {
  ctx: null,
  tracks: [],
  sources: new Map(),
  spatialMode: 'hrtf',
  analysers: { master: null, perSource: new Map() },

  async init() {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.sourcesBus = new GainNode(ctx);
    this.masterGain = new GainNode(ctx, { gain: 0.8 });
    const master = new AnalyserNode(ctx, { fftSize: CONFIG.ANALYSER_FFT, smoothingTimeConstant: 0.8 });
    this.analysers.master = master;
    this.sourcesBus.connect(this.masterGain).connect(master).connect(ctx.destination);
    this.impulse = makeImpulse(ctx);
    await ctx.resume();
    this.tracks = await Promise.all([buildDemoBand(), buildRainAndBells(), buildTestNoise()]);
  },

  /** Decodes a user file and appends it as a one-stem track. Rejects if it can't be decoded. */
  async addUploadedTrack(file) {
    const buffer = await this.ctx.decodeAudioData(await file.arrayBuffer());
    this.tracks.push({
      name: file.name.replace(/\.[^.]+$/, ''),
      stems: [{ name: 'Audio', buffer, az: 0, el: 0, dist: 1.5 }],
    });
    return this.tracks.length - 1;
  },

  get latency() {
    if (!this.ctx) return { base: 0, output: 0 };
    return { base: this.ctx.baseLatency ?? 0, output: this.ctx.outputLatency ?? 0 };
  },

  /** Builds SoundSources for a track; returns source descriptors for the store. */
  loadTrack(index) {
    for (const s of this.sources.values()) s.stop(0.2);
    this.sources.clear();
    this.analysers.perSource.clear();
    const track = this.tracks[index];
    const startAt = this.ctx.currentTime + 0.05;
    return track.stems.map((stem, id) => {
      const src = new SoundSource(this, { id, name: stem.name, buffer: stem.buffer, startAt });
      src.setSpatialMode(this.spatialMode);
      src.setPosition(stem.az, stem.el, stem.dist);
      for (const [k, v] of Object.entries(defaultParams())) src.setParam(k, v);
      this.sources.set(id, src);
      this.analysers.perSource.set(id, src.analyser);
      return { id, name: stem.name, az: stem.az, el: stem.el, dist: stem.dist, params: defaultParams() };
    });
  },

  setSourcePosition(id, az, el, dist) {
    this.sources.get(id)?.setPosition(az, el, dist);
  },

  setSourceParam(id, key, value) {
    this.sources.get(id)?.setParam(key, value);
  },

  setSpatialMode(mode) {
    this.spatialMode = mode;
    for (const s of this.sources.values()) s.setSpatialMode(mode);
  },

  setMasterGain(v) {
    this.masterGain?.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  },

  async togglePlay() {
    if (this.ctx.state === 'running') await this.ctx.suspend();
    else await this.ctx.resume();
    return this.ctx.state === 'running';
  },

  level(id) {
    return this.sources.get(id)?.getLevel() ?? 0;
  },
};
