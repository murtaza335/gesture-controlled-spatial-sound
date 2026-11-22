import { CONFIG } from '../config.js';

const TUNABLES = [
  { label: 'Smooth cutoff', obj: CONFIG.SMOOTH, key: 'minCutoff', min: 0.1, max: 5, step: 0.05 },
  { label: 'Smooth beta', obj: CONFIG.SMOOTH, key: 'beta', min: 0, max: 2, step: 0.05 },
  { label: 'Depth cutoff', obj: CONFIG.SMOOTH_DEPTH, key: 'minCutoff', min: 0.05, max: 2, step: 0.05 },
  { label: 'Pinch ON', obj: CONFIG, key: 'PINCH_ON', min: 0.1, max: 0.4, step: 0.01 },
  { label: 'Pinch OFF', obj: CONFIG, key: 'PINCH_OFF', min: 0.2, max: 0.6, step: 0.01 },
  { label: 'Swipe speed', obj: CONFIG, key: 'SWIPE_MIN_SPEED', min: 0.5, max: 4, step: 0.1 },
];

const PLOT_N = 150;

/** Debug panel (toggle with D): stats, raw vs filtered plot, and live tuning sliders. */
export function createDebug(el) {
  el.innerHTML = `
    <pre class="dbg-text"></pre>
    <div class="dbg-plot-label"><span class="raw">raw</span> vs <span class="flt">filtered</span> · right palm x</div>
    <canvas class="dbg-plot" width="300" height="64"></canvas>
    <div class="dbg-sliders"></div>
    <button class="btn sm-text dbg-copy">Copy values</button>`;
  const text = el.querySelector('.dbg-text');
  const canvas = el.querySelector('.dbg-plot');
  const ctx = canvas.getContext('2d');
  const box = el.querySelector('.dbg-sliders');
  const raw = [];
  const flt = [];

  for (const t of TUNABLES) {
    const row = document.createElement('label');
    row.className = 'dbg-row';
    row.innerHTML = `<span>${t.label}</span><input type="range" min="${t.min}" max="${t.max}" step="${t.step}"><output></output>`;
    const input = row.querySelector('input');
    const out = row.querySelector('output');
    input.value = String(t.obj[t.key]);
    out.textContent = Number(t.obj[t.key]).toFixed(2);
    input.addEventListener('input', () => {
      t.obj[t.key] = Number(input.value);
      out.textContent = Number(input.value).toFixed(2);
    });
    box.appendChild(row);
  }
  el.querySelector('.dbg-copy').addEventListener('click', async () => {
    const s = TUNABLES.map((t) => `${t.key}: ${Number(t.obj[t.key]).toFixed(2)}`).join('\n');
    try {
      await navigator.clipboard.writeText(s);
    } catch {
      /* clipboard unavailable */
    }
  });

  function drawPlot() {
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    for (const [arr, color] of [[raw, 'rgba(255,138,138,0.9)'], [flt, 'rgba(94,224,160,0.95)']]) {
      if (arr.length < 2) continue;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      arr.forEach((v, i) => {
        const x = (i / (PLOT_N - 1)) * W;
        const y = H - 4 - Math.min(1, Math.max(0, v)) * (H - 8);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
  }

  let last = 0;
  return {
    toggle(on) {
      el.hidden = !on;
    },
    /** `info.rawX` / `info.fltX`: right-hand palm x before / after smoothing (or null). */
    update(now, info) {
      if (el.hidden) return;
      if (info.rawX != null) {
        raw.push(info.rawX);
        flt.push(info.fltX ?? info.rawX);
        if (raw.length > PLOT_N) {
          raw.shift();
          flt.shift();
        }
        drawPlot();
      }
      if (now - last < 250) return;
      last = now;
      const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '–');
      const hand = (h) => (h && h.state !== 'idle' ? `${h.state.padEnd(8)} ratio ${fmt(h.ratio)}  fingers ${h.count}  scale ${fmt(h.scale, 3)}` : 'not detected');
      text.textContent = [
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
