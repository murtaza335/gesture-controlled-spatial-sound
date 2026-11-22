import { describe, it, expect } from 'vitest';
import { susScore, SUS_ITEMS } from '../src/study/sus.js';
import { createTaskRunner, TASKS } from '../src/study/taskRunner.js';

describe('SUS', () => {
  it('has the 10 standard items', () => expect(SUS_ITEMS).toHaveLength(10));
  it('best possible answers score 100', () => {
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
  });
  it('worst possible answers score 0', () => {
    expect(susScore([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
  });
  it('all neutral scores 50', () => {
    expect(susScore(Array(10).fill(3))).toBe(50);
  });
  it('rejects incomplete or invalid answers', () => {
    expect(susScore([3, 3])).toBeNaN();
    expect(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 9])).toBeNaN();
  });
});

const mkState = () => ({
  trackIndex: 0,
  tracks: [{ name: 'Demo Band' }, { name: 'Rain and Bells' }],
  sources: [
    { id: 0, name: 'Drums', az: 0, el: 0, dist: 1.5, params: { bass: 0, filter: 1 } },
    { id: 1, name: 'Bass', az: -40, el: 0, dist: 1.5, params: { bass: 0, filter: 1 } },
    { id: 2, name: 'Pad', az: 60, el: 0, dist: 1.5, params: { bass: 0, filter: 1 } },
  ],
});

describe('task checks', () => {
  it('T1 needs Drums near 60°', () => {
    const st = mkState();
    expect(TASKS[0].check(st)).toBe(false);
    st.sources[0].az = 55;
    expect(TASKS[0].check(st)).toBe(true);
  });
  it('T2 needs az ≈ −45 and dist ≤ 1', () => {
    const st = mkState();
    st.sources[1].az = -45;
    expect(TASKS[1].check(st)).toBe(false);
    st.sources[1].dist = 0.9;
    expect(TASKS[1].check(st)).toBe(true);
  });
  it('T3 / T4 check tone parameters', () => {
    const st = mkState();
    st.sources[2].params.bass = 6.5;
    expect(TASKS[2].check(st)).toBe(true);
    st.sources[0].params.filter = 0.55;
    expect(TASKS[3].check(st)).toBe(true);
    st.sources[0].params.filter = 0.8;
    expect(TASKS[3].check(st)).toBe(false);
  });
});

describe('task runner', () => {
  it('succeeds only after the check holds for 1 s, and logs the end', () => {
    const st = mkState();
    const log = [];
    const runner = createTaskRunner({
      getState: () => st,
      logger: { log: (e, f) => log.push([e, f]), setContext() {} },
      setup: () => {},
    });
    runner.start(0);
    st.sources[0].az = 60;
    runner.update(100);
    runner.update(600);
    expect(runner.results).toHaveLength(0); // not held long enough
    runner.update(1200);
    expect(runner.results).toHaveLength(1);
    expect(runner.results[0]).toMatchObject({ id: 'T1', success: true, timeMs: 100 });
    expect(log.some(([e]) => e === 'task_end')).toBe(true);
  });

  it('resets the hold if the state leaves tolerance', () => {
    const st = mkState();
    const runner = createTaskRunner({ getState: () => st, setup: () => {} });
    runner.start(0);
    st.sources[0].az = 60;
    runner.update(100);
    st.sources[0].az = 0;
    runner.update(700);
    st.sources[0].az = 60;
    runner.update(800);
    runner.update(1500);
    expect(runner.results).toHaveLength(0);
  });

  it('give up records a failure and moves on; all five tasks end the run', () => {
    const st = mkState();
    const runner = createTaskRunner({ getState: () => st, setup: () => {} });
    runner.start(0);
    for (let i = 0; i < 5; i++) runner.giveUp(1000 * (i + 1));
    expect(runner.running).toBe(false);
    expect(runner.results.map((r) => r.success)).toEqual([false, false, false, false, false]);
  });
});
