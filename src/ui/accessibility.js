/**
 * Accessibility mode: earcons + speech. Every method is a no-op unless `a11yMode` is on.
 * Speech cancels pending utterances before speaking so it never queues up.
 */
export function createAccessibility({ store, earcons }) {
  const on = () => store.state.a11yMode;
  const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;

  function speak(text) {
    if (!on() || !hasSpeech) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  return {
    speak,
    grab() { if (on()) earcons.grab(); },
    release() { if (on()) earcons.release(); },
    miss() { if (on()) earcons.miss(); },
    hover(name) {
      if (!on()) return;
      earcons.hover();
      speak(name);
    },
    select(label) { speak(label); },
    /** Spoken after a value adjustment ends, e.g. "Bass plus 6". */
    adjustEnd(label, valueText) { speak(`${label} ${valueText.replace('+', 'plus ').replace('-', 'minus ')}`); },
    track(name) {
      if (!on()) return;
      earcons.track();
      speak(name);
    },
    reset() { if (on()) earcons.reset(); },
    tick() { if (on()) earcons.tick(); },
    pointAt(az) { if (on()) earcons.pointAt(az); },
  };
}
