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

/** Right-hand swipe: fast, mostly horizontal move over a short window, with cooldown. */
function createSwipeDetector(cfg) {
  let hist = [];
  let lastSwipe = -Infinity;
  return {
    reset() {
      hist = [];
    },
    /** @returns {'left'|'right'|null} */
    update(palm, now) {
      hist.push({ t: now, x: palm.x, y: palm.y });
      while (hist.length && now - hist[0].t > cfg.SWIPE_WINDOW_MS) hist.shift();
      if (now - lastSwipe < cfg.SWIPE_COOLDOWN_MS || hist.length < 2) return null;
      const a = hist[0];
      const b = hist[hist.length - 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dt = (b.t - a.t) / 1000;
      if (dt <= 0) return null;
      if (Math.abs(dx) > cfg.SWIPE_MIN_DIST && Math.abs(dx) / dt > cfg.SWIPE_MIN_SPEED && Math.abs(dy) < 0.5 * Math.abs(dx)) {
        lastSwipe = now;
        hist = [];
        return dx > 0 ? 'right' : 'left';
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
  const swipe = createSwipeDetector(cfg);

  // left-hand select / fist state
  let countSince = 0;
  let lastCount = -1;
  let selectFired = false;
  let fistFired = false;
  let lastLeftPinchEnd = -Infinity;

  return {
    update(frame, now) {
      const events = [];
      const out = { right: null, left: null, events };

      // ---- right hand ----
      {
        const hand = frame.right;
        const ratio = hand ? pinchRatio(hand.lm) : 1;
        const palm = hand ? palmCenter(hand.lm) : null;
        const change = rightPinch.update(ratio, !!hand, now);
        if (change === 'start') events.push({ type: 'grabStart', side: 'right', palm });
        if (change === 'end') events.push({ type: 'grabEnd', side: 'right' });
        if (hand && palm && rightPinch.state === 'open' && !hand.stale && !frame.noSwipe) {
          const dir = swipe.update(palm, now);
          if (dir) events.push({ type: 'swipe', side: 'right', dir });
        } else swipe.reset();
        out.right = hand
          ? { state: rightPinch.state, palm, scale: hand.scaleSmooth ?? 0, ratio, count: fingerCount(hand.lm) }
          : { state: 'idle', palm: null, scale: 0, ratio: 1, count: 0 };
      }

      // ---- left hand ----
      {
        const hand = frame.left;
        const ratio = hand ? pinchRatio(hand.lm) : 1;
        const palm = hand ? palmCenter(hand.lm) : null;
        const count = hand ? fingerCount(hand.lm) : 0;
        const change = leftPinch.update(ratio, !!hand, now);
        if (change === 'start') events.push({ type: 'adjustStart', side: 'left', y: palm.y });
        if (change === 'end') {
          events.push({ type: 'adjustEnd', side: 'left' });
          lastLeftPinchEnd = now;
        }
        const pinching = leftPinch.state === 'pinching';

        if (!hand || pinching) {
          lastCount = -1;
          selectFired = false;
          fistFired = false;
        } else {
          if (count !== lastCount) {
            lastCount = count;
            countSince = now;
            selectFired = false;
            fistFired = false;
          }
          const held = now - countSince;
          const settled = now - lastLeftPinchEnd >= cfg.SELECT_AFTER_PINCH_MS;
          if (count >= 1 && count <= 5 && held >= cfg.SELECT_HOLD_MS && !selectFired && settled) {
            selectFired = true;
            events.push({ type: 'select', side: 'left', count });
          }
          if (count === 0 && held >= cfg.FIST_HOLD_MS && !fistFired) {
            fistFired = true;
            events.push({ type: 'reset', side: 'left' });
          }
        }
        out.left = hand
          ? { state: leftPinch.state, palm, scale: hand.scaleSmooth ?? 0, ratio, count, holdMs: lastCount >= 0 ? now - countSince : 0 }
          : { state: 'idle', palm: null, scale: 0, ratio: 1, count: 0, holdMs: 0 };
      }
      return out;
    },
  };
}
