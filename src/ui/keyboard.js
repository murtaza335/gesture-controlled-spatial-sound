import { PARAMS, PARAM_KEYS } from '../audio/params.js';

const BY_FINGERS = Object.fromEntries(PARAM_KEYS.filter((k) => PARAMS[k].fingers).map((k) => [PARAMS[k].fingers, k]));

/** Global shortcuts. Ignored while typing in an input. `actions.state()` returns the store state. */
export function installKeyboard(actions) {
  window.addEventListener('keydown', (e) => {
    const tag = e.target?.tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type !== 'range') || e.ctrlKey || e.metaKey || e.altKey) return;
    const st = actions.state();
    if (!st.started) return;
    const key = e.key.toLowerCase();
    switch (key) {
      case ' ':
        if (tag === 'BUTTON' || tag === 'SELECT') return;
        e.preventDefault();
        actions.togglePlay();
        break;
      case '[': actions.changeTrack(-1); break;
      case ']': actions.changeTrack(1); break;
      case 's': actions.toggleSpatial(); break;
      case 'm': actions.toggleInput(); break;
      case 'd': actions.toggleDebug(); break;
      case 'v': actions.swapView(); break;
      case 'c': actions.startCalibration(); break;
      case 'a': actions.toggleA11y(); break;
      case 'x': actions.toggleScreenOff(); break;
      case 'f': actions.fb('front'); break;
      case 'b': actions.fb('back'); break;
      case 'enter':
        if (tag === 'BUTTON' || tag === 'SELECT') return;
        actions.giveUp();
        break;
      case 'escape':
        actions.cancelCalibration();
        actions.cancelStudy();
        break;
      case 'h':
      case '?': actions.showHelp(); break;
      case '1': case '2': case '3': case '4': case '5':
        if (st.inputMode !== 'mouse') actions.selectParam(BY_FINGERS[key]);
        break;
      case 'arrowup':
      case 'arrowdown': {
        if (tag === 'INPUT') return; // let a focused slider handle it
        e.preventDefault();
        const def = PARAMS[st.selectedParam];
        const f = st.sources.find((s) => s.id === st.focusedSourceId);
        if (f) actions.setParam(st.selectedParam, f.params[st.selectedParam] + (key === 'arrowup' ? 1 : -1) * def.step * (def.max - def.min > 5 ? 2 : 5));
        break;
      }
      case 'arrowleft':
      case 'arrowright': {
        if (tag === 'INPUT') return;
        e.preventDefault();
        const f = st.sources.find((s) => s.id === st.focusedSourceId);
        if (f) actions.setPosition(f.id, { az: f.az + (key === 'arrowright' ? 10 : -10) });
        break;
      }
      default: break;
    }
  });
}
