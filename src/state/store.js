/**
 * Tiny observable store. `set(patch)` shallow-merges and notifies subscribers.
 */
export function createStore(initial) {
  const state = { ...initial };
  const subs = new Set();
  return {
    state,
    set(patch) {
      Object.assign(state, patch);
      for (const fn of subs) fn(state, patch);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export const store = createStore({
  started: false,
  inputMode: 'mouse', // 'camera' | 'mouse'
  spatialMode: 'hrtf', // 'hrtf' | 'stereo'
  trackIndex: 0,
  tracks: [],
  sources: [], // { id, name, az, el, dist, params }
  focusedSourceId: 0,
  grabbedSourceId: null,
  hoverSourceId: null,
  selectedParam: 'bass',
  cursor: { right: null, left: null },
  playing: true,
  debug: false,
  hint: '',
});
