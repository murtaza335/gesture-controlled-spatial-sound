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
