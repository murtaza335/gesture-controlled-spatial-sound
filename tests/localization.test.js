import { describe, it, expect } from 'vitest';
import { makeTrials, summarize, createLocalizationTest } from '../src/study/localizationTest.js';

describe('makeTrials', () => {
  it('front block has 21 trials, each of 7 azimuths three times', () => {
    const t = makeTrials('front');
    expect(t).toHaveLength(21);
    for (const az of [-90, -60, -30, 0, 30, 60, 90]) expect(t.filter((x) => x === az)).toHaveLength(3);
  });
  it('is shuffled (not in sorted order)', () => {
    const t = makeTrials('front', (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })());
    expect(t).not.toEqual([...t].sort((a, b) => a - b));
  });
  it('front/back block has 12 trials at ±30 and ±150', () => {
    const t = makeTrials('frontback');
    expect(t).toHaveLength(12);
    expect(new Set(t)).toEqual(new Set([-150, -30, 30, 150]));
  });
});

describe('summarize', () => {
  it('computes mean absolute error per mode and the confusion rate', () => {
    const s = summarize([
      { block: 'front', mode: 'hrtf', absError: 10, rtMs: 1000 },
      { block: 'front', mode: 'hrtf', absError: 20, rtMs: 2000 },
      { block: 'front', mode: 'stereo', absError: 5, rtMs: 900 },
      { block: 'frontback', mode: 'hrtf', confused: true },
      { block: 'frontback', mode: 'hrtf', confused: false },
    ]);
    expect(s.front.hrtf.meanAbsError).toBe(15);
    expect(s.front.stereo.meanAbsError).toBe(5);
    expect(s.frontBack.confusionRate).toBe(0.5);
  });
});

describe('localization controller', () => {
  const fakeEngine = { spatialMode: 'hrtf', makeBurst: () => ({}), playOneShot: () => Promise.resolve() };
  const mkRng = () => { let s = 3; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

  it('runs all 21 trials and produces a summary', () => {
    const ev = [];
    const logger = { log: (e) => ev.push(e), setContext() {} };
    const test = createLocalizationTest({ engine: fakeEngine, logger, rng: mkRng() });
    let now = 0;
    test.start({ block: 'front' }, now);
    for (let guard = 0; guard < 2000 && test.running; guard++) {
      now += 50;
      test.tick(now);
      if (test.state.waiting) test.respond(0, now);
    }
    expect(test.running).toBe(false);
    expect(test.results).toHaveLength(21);
    expect(test.state.summary.front.hrtf.n).toBe(21);
    expect(ev.filter((e) => e === 'loc_response')).toHaveLength(21);
  });

  it('ignores responses of the wrong kind', () => {
    const test = createLocalizationTest({ engine: fakeEngine, rng: mkRng() });
    test.start({ block: 'frontback' }, 0);
    test.tick(2000);
    expect(test.respond(0, 2100)).toBe(false);
    expect(test.respondFB('front', 2100)).toBe(true);
  });
});
