import { CONFIG } from '../config.js';
import { PARAMS } from './params.js';
import { expMap, sphericalToCartesian, clamp } from '../mapping/handToAudio.js';

const EPS = 1e-4;

/** One stem: buffer → tone chain → reverb split → spatializer (HRTF or stereo) → analyser → bus. */
export class SoundSource {
  constructor(engine, { id, name, buffer, startAt }) {
    const ctx = engine.ctx;
    this.engine = engine;
    this.ctx = ctx;
    this.id = id;
    this.name = name;
    this.mode = 'hrtf';
    this.last = {};
    this.az = 0;
    this.el = 0;
    this.dist = 1;

    this.src = ctx.createBufferSource();
    this.src.buffer = buffer;
    this.src.loop = true;

    this.bass = new BiquadFilterNode(ctx, { type: 'lowshelf', frequency: 200 });
    this.mid = new BiquadFilterNode(ctx, { type: 'peaking', frequency: 1000, Q: 1 });
    this.treble = new BiquadFilterNode(ctx, { type: 'highshelf', frequency: 4000 });
    this.lowpass = new BiquadFilterNode(ctx, { type: 'lowpass', frequency: 20000, Q: 0.7 });
    this.dry = new GainNode(ctx);
    this.convolver = new ConvolverNode(ctx, { buffer: engine.impulse });
    this.wet = new GainNode(ctx);
    this.sourceGain = new GainNode(ctx, { gain: 0 });

    this.panner = new PannerNode(ctx, {
      panningModel: 'HRTF',
      distanceModel: 'inverse',
      refDistance: 1,
      maxDistance: 10,
      rolloffFactor: 1,
      coneInnerAngle: 360,
    });
    this.stereo = new StereoPannerNode(ctx);
    this.distGain = new GainNode(ctx);

    this.analyser = new AnalyserNode(ctx, { fftSize: CONFIG.SOURCE_ANALYSER_FFT, smoothingTimeConstant: 0.6 });
    this._buf = new Uint8Array(this.analyser.fftSize);

    this.src.connect(this.bass).connect(this.mid).connect(this.treble).connect(this.lowpass);
    this.lowpass.connect(this.dry).connect(this.sourceGain);
    this.lowpass.connect(this.convolver).connect(this.wet).connect(this.sourceGain);
    this.stereo.connect(this.distGain).connect(this.analyser);
    this.panner.connect(this.analyser);
    this.analyser.connect(engine.sourcesBus);
    this.sourceGain.connect(this.panner);

    this.src.start(startAt);
    // Fade in so track start never clicks.
    this.sourceGain.gain.setTargetAtTime(1, startAt, 0.05);
  }

  _set(param, key, target, tc, now = this.ctx.currentTime) {
    if (this.last[key] !== undefined && Math.abs(this.last[key] - target) < EPS) return;
    this.last[key] = target;
    param.setTargetAtTime(target, now, tc);
  }

  /** Smooth position update (degrees / metres). Never sets `.value` directly. */
  setPosition(az, el, dist) {
    this.az = az;
    this.el = el;
    this.dist = dist;
    const tc = CONFIG.AUDIO_RAMP_TC_POS;
    const p = sphericalToCartesian(az, el, dist);
    if (this.panner.positionX) {
      this._set(this.panner.positionX, 'px', p.x, tc);
      this._set(this.panner.positionY, 'py', p.y, tc);
      this._set(this.panner.positionZ, 'pz', p.z, tc);
    } else {
      this.panner.setPosition(p.x, p.y, p.z);
    }
    this._set(this.stereo.pan, 'pan', Math.sin((az * Math.PI) / 180), tc);
    this._set(this.distGain.gain, 'dg', clamp(1 / dist, 0, 1.5), tc);
  }

  setParam(key, v) {
    const tc = CONFIG.AUDIO_RAMP_TC_PARAM;
    switch (key) {
      case 'bass': this._set(this.bass.gain, key, v, tc); break;
      case 'mid': this._set(this.mid.gain, key, v, tc); break;
      case 'treble': this._set(this.treble.gain, key, v, tc); break;
      case 'pitch': this._set(this.src.playbackRate, key, Math.pow(2, v / 12), tc); break;
      case 'filter': this._set(this.lowpass.frequency, key, expMap(v, 200, 20000), tc); break;
      case 'reverb':
        this._set(this.wet.gain, 'wet', v, tc);
        this._set(this.dry.gain, 'dry', 1 - 0.5 * v, tc);
        break;
      case 'gain': this._set(this.sourceGain.gain, key, v, tc); break;
      default: break;
    }
  }

  setSpatialMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.sourceGain.disconnect();
    this.sourceGain.connect(mode === 'hrtf' ? this.panner : this.stereo);
  }

  /** RMS level 0..1 for visual pulsing. */
  getLevel() {
    this.analyser.getByteTimeDomainData(this._buf);
    let sum = 0;
    for (let i = 0; i < this._buf.length; i++) {
      const v = (this._buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.sqrt(sum / this._buf.length);
  }

  stop(fadeSec = 0.2) {
    const now = this.ctx.currentTime;
    this.sourceGain.gain.cancelScheduledValues(now);
    this.sourceGain.gain.setTargetAtTime(0, now, fadeSec / 4);
    setTimeout(() => {
      try { this.src.stop(); } catch { /* already stopped */ }
      this.analyser.disconnect();
      this.src.disconnect();
    }, fadeSec * 1000 + 100);
  }
}
