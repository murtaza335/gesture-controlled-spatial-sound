// @ts-check
import { expMap } from '../mapping/handToAudio.js';

const db = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} dB`;
const pct = (v) => `${Math.round(v * 100)}%`;

/** Parameter definitions: ranges, defaults, display formatting. `fingers` is the left-hand select count. */
export const PARAMS = {
  bass: { key: 'bass', label: 'Bass', min: -12, max: 12, default: 0, step: 0.5, unit: 'dB', fingers: 1, format: db },
  treble: { key: 'treble', label: 'Treble', min: -12, max: 12, default: 0, step: 0.5, unit: 'dB', fingers: 2, format: db },
  pitch: {
    key: 'pitch', label: 'Pitch', min: -12, max: 12, default: 0, step: 0.5, unit: 'st', fingers: 3,
    format: (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)} st`,
  },
  filter: { key: 'filter', label: 'Filter', min: 0, max: 1, default: 1, step: 0.01, unit: '', fingers: 4, format: (v) => `${Math.round(expMap(v, 200, 20000))} Hz` },
  reverb: { key: 'reverb', label: 'Reverb', min: 0, max: 1, default: 0.15, step: 0.01, unit: '', fingers: 5, format: pct },
  mid: { key: 'mid', label: 'Mid', min: -12, max: 12, default: 0, step: 0.5, unit: 'dB', fingers: null, format: db },
  gain: { key: 'gain', label: 'Volume', min: 0, max: 1.5, default: 1, step: 0.01, unit: '', fingers: null, format: pct },
};

export const PARAM_KEYS = Object.keys(PARAMS);

export function defaultParams() {
  return Object.fromEntries(PARAM_KEYS.map((k) => [k, PARAMS[k].default]));
}
