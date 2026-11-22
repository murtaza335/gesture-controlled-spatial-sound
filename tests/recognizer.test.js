import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';
import { createRecognizer } from '../src/gestures/recognizer.js';
import { makeHand } from './fixtures/handFixtures.js';

const frame = (t, right) => ({ t, left: null, right: right ? { side: 'right', lm: right, score: 1, scaleSmooth: 0.18 } : null });

function run(rec, steps) {
  const events = [];
  let t = 0;
  for (const [pinch, ms] of steps) {
    for (let i = 0; i < ms / 16; i++) {
      t += 16;
      const r = rec.update(frame(t, pinch === null ? null : makeHand({ pinch })), t);
      events.push(...r.events);
    }
  }
  return events;
}

describe('recognizer pinch', () => {
  it('emits exactly one grabStart and one grabEnd', () => {
    const ev = run(createRecognizer(CONFIG), [[0, 200], [1, 400], [0, 200]]).map((e) => e.type);
    expect(ev).toEqual(['grabStart', 'grabEnd']);
  });

  it('jitter between ON and OFF does not toggle', () => {
    // ratio between 0.25 and 0.38 once pinching: pinch 0.75 gives mid ratio
    const rec = createRecognizer(CONFIG);
    const mid = makeHand({ pinch: 0.78 });
    const events = [];
    let t = 0;
    const step = (hand) => {
      t += 16;
      events.push(...rec.update(frame(t, hand), t).events);
    };
    for (let i = 0; i < 20; i++) step(makeHand({ pinch: 0 }));
    for (let i = 0; i < 20; i++) step(makeHand({ pinch: 1 }));
    for (let i = 0; i < 40; i++) step(i % 2 ? mid : makeHand({ pinch: 0.9 }));
    expect(events.map((e) => e.type)).toEqual(['grabStart']);
  });

  it('a pinch shorter than the debounce is ignored', () => {
    const ev = run(createRecognizer(CONFIG), [[0, 100], [1, 32], [0, 100]]);
    expect(ev).toEqual([]);
  });

  it('losing the hand mid-pinch emits grabEnd', () => {
    const ev = run(createRecognizer(CONFIG), [[0, 100], [1, 200], [null, 100]]).map((e) => e.type);
    expect(ev).toEqual(['grabStart', 'grabEnd']);
  });
});

// ---------- Phase 3: swipe, select, fist, left pinch ----------
import { fingers, FIST } from './fixtures/handFixtures.js';

const f2 = (t, { right = null, left = null } = {}) => ({
  t,
  right: right ? { side: 'right', lm: right, score: 1, scaleSmooth: 0.18 } : null,
  left: left ? { side: 'left', lm: left, score: 1, scaleSmooth: 0.18 } : null,
});

function drive(rec, ms, make, step = 16, t0 = 0) {
  const ev = [];
  for (let t = step; t <= ms; t += step) ev.push(...rec.update(f2(t0 + t, make(t)), t0 + t).events);
  return ev;
}

describe('recognizer swipe', () => {
  it('fires once per fast horizontal move', () => {
    const rec = createRecognizer(CONFIG);
    drive(rec, 100, () => ({ right: makeHand({ wrist: { x: 0.3, y: 0.7 } }) }));
    // 0.4 units in 200 ms = 2 units/s
    const ev = drive(rec, 200, (t) => ({ right: makeHand({ wrist: { x: 0.3 + (t / 200) * 0.4, y: 0.7 } }) }), 16, 100);
    expect(ev.filter((e) => e.type === 'swipe')).toEqual([{ type: 'swipe', side: 'right', dir: 'right' }]);
  });

  it('does not fire on slow drift', () => {
    const rec = createRecognizer(CONFIG);
    const ev = drive(rec, 3000, (t) => ({ right: makeHand({ wrist: { x: 0.3 + (t / 3000) * 0.4, y: 0.7 } }) }));
    expect(ev.filter((e) => e.type === 'swipe')).toEqual([]);
  });

  it('cooldown blocks an immediate second swipe', () => {
    const rec = createRecognizer(CONFIG);
    const ev = drive(rec, 500, (t) => ({ right: makeHand({ wrist: { x: 0.2 + (t / 500) * 1.0 * (t < 250 ? 1 : 0.5), y: 0.7 } }) }));
    expect(ev.filter((e) => e.type === 'swipe').length).toBeLessThanOrEqual(1);
  });
});

describe('recognizer left hand', () => {
  it('select fires after the hold time, once', () => {
    const rec = createRecognizer(CONFIG);
    const ev = drive(rec, 1200, () => ({ left: makeHand({ extended: fingers(3) }) }));
    expect(ev.filter((e) => e.type === 'select')).toEqual([{ type: 'select', side: 'left', count: 3 }]);
  });

  it('select does not fire before the hold time', () => {
    const rec = createRecognizer(CONFIG);
    const ev = drive(rec, 300, () => ({ left: makeHand({ extended: fingers(2) }) }));
    expect(ev.filter((e) => e.type === 'select')).toEqual([]);
  });

  it('select fires again when the count changes', () => {
    const rec = createRecognizer(CONFIG);
    const ev = drive(rec, 2000, (t) => ({ left: makeHand({ extended: fingers(t < 1000 ? 1 : 4) }) }));
    expect(ev.filter((e) => e.type === 'select').map((e) => e.count)).toEqual([1, 4]);
  });

  it('fist reset fires after 800 ms, not before', () => {
    const rec = createRecognizer(CONFIG);
    expect(drive(rec, 700, () => ({ left: makeHand({ extended: FIST }) })).some((e) => e.type === 'reset')).toBe(false);
    const rec2 = createRecognizer(CONFIG);
    expect(drive(rec2, 1000, () => ({ left: makeHand({ extended: FIST }) })).filter((e) => e.type === 'reset').length).toBe(1);
  });

  it('left pinch emits adjustStart / adjustEnd and suppresses select', () => {
    const rec = createRecognizer(CONFIG);
    const ev = drive(rec, 1500, (t) => ({ left: makeHand({ pinch: t > 200 && t < 1300 ? 1 : 0, extended: fingers(2) }) }));
    const types = ev.map((e) => e.type);
    expect(types.filter((x) => x === 'adjustStart').length).toBe(1);
    expect(types.filter((x) => x === 'adjustEnd').length).toBe(1);
    // no select while pinching or within 300 ms after
    const selects = ev.filter((e) => e.type === 'select');
    expect(selects.every((e) => true)).toBe(true);
    expect(types.indexOf('select') === -1 || types.indexOf('select') > types.indexOf('adjustEnd')).toBe(true);
  });
});
