// @ts-check
export const FRONT_AZIMUTHS = [-90, -60, -30, 0, 30, 60, 90];
export const FRONTBACK_AZIMUTHS = [-150, -30, 30, 150];
const REPEATS = 3;

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 'front' → 7 azimuths × 3 = 21 shuffled trials. 'frontback' → ±30 / ±150 × 3 = 12 shuffled trials. */
export function makeTrials(block, rng = Math.random) {
  const azs = block === 'frontback' ? FRONTBACK_AZIMUTHS : FRONT_AZIMUTHS;
  const all = [];
  for (const az of azs) for (let r = 0; r < REPEATS; r++) all.push(az);
  return shuffle(all, rng);
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

/**
 * results: [{ block, mode, target, response?, absError?, rtMs, confused? }]
 * → mean absolute error per spatial mode (front block) and front/back confusion rate.
 */
export function summarize(results) {
  const byMode = {};
  for (const r of results.filter((x) => x.block === 'front')) {
    (byMode[r.mode] ??= []).push(r);
  }
  const front = Object.fromEntries(
    Object.entries(byMode).map(([m, rs]) => [m, { n: rs.length, meanAbsError: mean(rs.map((r) => r.absError)), meanRtMs: mean(rs.map((r) => r.rtMs)) }]),
  );
  const fb = results.filter((x) => x.block === 'frontback');
  const fbByMode = {};
  for (const r of fb) (fbByMode[r.mode] ??= []).push(r);
  return {
    front,
    frontBack: {
      n: fb.length,
      confusionRate: fb.length ? fb.filter((r) => r.confused).length / fb.length : NaN,
      byMode: Object.fromEntries(Object.entries(fbByMode).map(([m, rs]) => [m, rs.filter((r) => r.confused).length / rs.length])),
    },
  };
}

/**
 * Localization test controller. UI-agnostic: call `tick(now)` every frame,
 * `respond(az, now)` when the user points + pinches (front block), `respondFB('front'|'back', now)` for the other block.
 */
export function createLocalizationTest({ engine, logger, onUpdate, rng = Math.random, replayMs = 2200, gapMs = 700 }) {
  let burst = null;
  let running = false;
  let block = 'front';
  let trials = [];
  let index = 0;
  let mode = 'hrtf';
  let playedAt = 0; // first play of the current trial
  let lastPlay = 0;
  let waiting = false; // awaiting a response
  let nextAt = 0;
  let results = [];
  let summary = null;

  const state = () => ({ running, block, index, total: trials.length, mode, waiting, summary, prompt: promptText() });
  const emit = () => onUpdate?.(state());

  function promptText() {
    if (!running) return '';
    return block === 'front'
      ? 'Point where the sound came from, then pinch (or click)'
      : 'Did it come from the FRONT or the BACK? Press F or B';
  }

  function play(now) {
    const t = trials[index];
    lastPlay = now;
    engine.playOneShot(burst, t, 0, 1.5);
  }

  function finish() {
    running = false;
    waiting = false;
    summary = summarize(results);
    logger?.log('loc_done', { extra: summary });
    emit();
  }

  function advance(now) {
    index++;
    if (index >= trials.length) return finish();
    waiting = false;
    nextAt = now + gapMs;
    emit();
  }

  return {
    get running() { return running; },
    get state() { return state(); },
    get results() { return results; },
    clear() { results = []; summary = null; },
    /** @param {{block?: 'front'|'frontback'}} opts */
    start({ block: b = 'front' } = {}, now = performance.now()) {
      burst = engine.makeBurst();
      block = b;
      mode = engine.spatialMode;
      trials = makeTrials(b, rng);
      index = 0;
      running = true;
      waiting = false;
      summary = null;
      nextAt = now + 800;
      logger?.setContext({ task_id: 'LOC' });
      logger?.log('loc_start', { extra: { block, mode, trials: trials.length } });
      emit();
    },
    cancel() {
      if (!running) return;
      running = false;
      waiting = false;
      logger?.log('loc_cancel');
      emit();
    },
    tick(now) {
      if (!running) return;
      if (!waiting && now >= nextAt) {
        waiting = true;
        playedAt = now;
        play(now);
        emit();
      } else if (waiting && now - lastPlay >= replayMs) {
        play(now); // gentle replay until answered; response time counts from the first play
      }
    },
    /** Front block: response azimuth from the right-hand cursor. */
    respond(az, now = performance.now()) {
      if (!running || !waiting || block !== 'front') return false;
      const target = trials[index];
      const absError = Math.abs(az - target);
      const rec = { block, mode, target, response: az, absError, rtMs: Math.round(now - playedAt) };
      results.push(rec);
      logger?.log('loc_response', { az: Math.round(az * 10) / 10, value: Math.round(absError * 10) / 10, extra: { target, rt_ms: rec.rtMs, mode, trial: index + 1 } });
      advance(now);
      return true;
    },
    respondFB(choice, now = performance.now()) {
      if (!running || !waiting || block !== 'frontback') return false;
      const target = trials[index];
      const truth = Math.abs(target) <= 90 ? 'front' : 'back';
      const rec = { block, mode, target, answer: choice, confused: choice !== truth, rtMs: Math.round(now - playedAt) };
      results.push(rec);
      logger?.log('loc_fb', { value: rec.confused ? 1 : 0, extra: { target, answer: choice, rt_ms: rec.rtMs, mode, trial: index + 1 } });
      advance(now);
      return true;
    },
  };
}
