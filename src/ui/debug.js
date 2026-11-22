/** Debug panel (toggle with D): fps, delegate, latency, per-hand measurements. */
export function createDebug(el) {
  let last = 0;
  return {
    toggle(on) {
      el.hidden = !on;
    },
    update(now, info) {
      if (el.hidden || now - last < 250) return;
      last = now;
      const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '–');
      const hand = (h) => (h && h.state !== 'idle' ? `${h.state.padEnd(8)} ratio ${fmt(h.ratio)}  fingers ${h.count}  scale ${fmt(h.scale, 3)}` : 'not detected');
      el.textContent = [
        `render fps   ${fmt(info.renderFps, 0)}`,
        `tracking fps ${fmt(info.trackFps, 0)}   ${fmt(info.trackMs, 1)} ms/frame`,
        `delegate     ${info.delegate}`,
        `latency      base ${fmt(info.latency.base * 1000, 0)} ms · output ${fmt(info.latency.output * 1000, 0)} ms`,
        `input        ${info.inputMode}   spatial ${info.spatialMode}`,
        `right hand   ${hand(info.gests?.right)}`,
        `left hand    ${hand(info.gests?.left)}`,
      ].join('\n');
    },
  };
}
