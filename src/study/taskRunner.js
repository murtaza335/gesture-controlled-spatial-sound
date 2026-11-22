// @ts-check
const byName = (st, name) => st.sources.find((s) => s.name === name);
const near = (v, target, tol) => Math.abs(v - target) <= tol;

/** Study tasks. `check(state)` is true while the state is within tolerance. */
export const TASKS = [
  { id: 'T1', text: 'Move “Drums” to 60° right', hint: '±10°', check: (st) => { const s = byName(st, 'Drums'); return !!s && near(s.az, 60, 10); } },
  { id: 'T2', text: 'Move “Bass” to 45° left and close (within 1 m)', hint: '±10°, ≤ 1.0 m', check: (st) => { const s = byName(st, 'Bass'); return !!s && near(s.az, -45, 10) && s.dist <= 1.0; } },
  { id: 'T3', text: 'Set Bass to +6 dB on “Pad”', hint: '±1.5 dB', check: (st) => { const s = byName(st, 'Pad'); return !!s && near(s.params.bass, 6, 1.5); } },
  { id: 'T4', text: 'Set Filter to about half (50%) on “Drums”', hint: '±8%', check: (st) => { const s = byName(st, 'Drums'); return !!s && near(s.params.filter, 0.5, 0.08); } },
  {
    id: 'T5',
    text: 'Switch to “Rain and Bells” and put the bells straight ahead',
    hint: '±10°',
    check: (st) => st.tracks[st.trackIndex]?.name === 'Rain and Bells' && (() => { const s = byName(st, 'Bells'); return !!s && near(s.az, 0, 10); })(),
  },
];

/**
 * Runs TASKS in order. A task succeeds when its check holds continuously for `holdMs`.
 * `setup()` resets the app to a clean state before each task; `getState()` returns the store state.
 */
export function createTaskRunner({ getState, logger, setup, onUpdate, holdMs = 1000, tasks = TASKS }) {
  let running = false;
  let index = 0;
  let startAt = 0;
  let okSince = null;
  let firstOk = null;
  let counts = { grabs: 0, adjusts: 0 };
  let results = [];

  const emit = (extra = {}) =>
    onUpdate?.({ running, index, total: tasks.length, task: tasks[index], startAt, holdProgress: 0, results, ...extra });

  function begin(now) {
    setup(tasks[index]);
    startAt = now;
    okSince = null;
    firstOk = null;
    counts = { grabs: 0, adjusts: 0 };
    logger?.setContext({ task_id: tasks[index].id });
    logger?.log('task_start', { extra: { text: tasks[index].text } });
    emit();
  }

  function complete(success, now) {
    const t = tasks[index];
    const timeMs = Math.round((success ? firstOk : now) - startAt);
    const rec = { id: t.id, success, timeMs, ...counts };
    results.push(rec);
    logger?.log('task_end', { value: success ? 1 : 0, extra: { time_ms: timeMs, grabs: counts.grabs, adjusts: counts.adjusts } });
    index++;
    if (index >= tasks.length) {
      running = false;
      logger?.setContext({ task_id: '' });
      emit({ done: true });
    } else begin(now);
  }

  return {
    get running() { return running; },
    get results() { return results; },
    start(now = performance.now()) {
      running = true;
      index = 0;
      results = [];
      begin(now);
    },
    abort() {
      if (!running) return;
      running = false;
      logger?.log('task_abort');
      logger?.setContext({ task_id: '' });
      emit({ aborted: true });
    },
    giveUp(now = performance.now()) {
      if (running) complete(false, now);
    },
    /** Count an interaction (grab / adjust / slider move) for the current task. */
    note(type) {
      if (type === 'grab') counts.grabs++;
      else counts.adjusts++;
    },
    update(now) {
      if (!running) return;
      const ok = tasks[index].check(getState());
      if (ok) {
        okSince ??= now;
        firstOk ??= now;
        const p = (now - okSince) / holdMs;
        if (p >= 1) return complete(true, now);
        emit({ holdProgress: p });
      } else {
        okSince = null;
        firstOk = null;
        emit();
      }
    },
  };
}
