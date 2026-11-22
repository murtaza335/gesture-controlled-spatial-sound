// @ts-check
import { fingerCount, palmCenter, pinchRatio } from './features.js';

/** Pinch state machine with hysteresis (ON < OFF) and onset debounce. */
function createPinchMachine(cfg) {
  let state = 'idle'; // idle | open | pinching
  let candidateSince = null;
  return {
    get state() {
      return state;
    },
    /** @returns {'start'|'end'|null} */
    update(ratio, present, now) {
      if (!present) {
        const was = state === 'pinching';
        state = 'idle';
        candidateSince = null;
        return was ? 'end' : null;
      }
      if (state === 'idle') state = 'open';
      if (state === 'open') {
        if (ratio < cfg.PINCH_ON) {
          if (candidateSince === null) candidateSince = now;
          if (now - candidateSince >= cfg.PINCH_DEBOUNCE_MS) {
            state = 'pinching';
            candidateSince = null;
            return 'start';
          }
        } else candidateSince = null;
      } else if (state === 'pinching' && ratio > cfg.PINCH_OFF) {
        state = 'open';
        return 'end';
      }
      return null;
    },
  };
}

/**
 * Per-hand gesture state machines. Pure: takes frames + timestamps.
 * @param {any} cfg CONFIG (read live, so debug sliders take effect)
 */
export function createRecognizer(cfg) {
  const rightPinch = createPinchMachine(cfg);
  const leftPinch = createPinchMachine(cfg);

  return {
    update(frame, now) {
      const events = [];
      const out = { right: null, left: null, events };
      for (const [side, machine] of /** @type {const} */ ([
        ['right', rightPinch],
        ['left', leftPinch],
      ])) {
        const hand = frame[side];
        const ratio = hand ? pinchRatio(hand.lm) : 1;
        const palm = hand ? palmCenter(hand.lm) : null;
        const change = machine.update(ratio, !!hand, now);
        if (change === 'start') events.push({ type: side === 'right' ? 'grabStart' : 'adjustStart', side, palm });
        if (change === 'end') events.push({ type: side === 'right' ? 'grabEnd' : 'adjustEnd', side });
        out[side] = hand
          ? {
              state: machine.state,
              palm,
              scale: hand.scaleSmooth ?? 0,
              ratio,
              count: fingerCount(hand.lm),
            }
          : { state: 'idle', palm: null, scale: 0, ratio: 1, count: 0 };
      }
      return out;
    },
  };
}
