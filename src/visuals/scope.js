import { CONFIG } from '../config.js';

/** Waveform (left) + 64 log-spaced spectrum bars (right), from the master analyser. */
export function createScope(waveCanvas, specCanvas) {
  const wctx = waveCanvas.getContext('2d');
  const sctx = specCanvas.getContext('2d');
  let dpr = 1;
  const size = { ww: 0, wh: 0, sw: 0, sh: 0 };
  const bars = new Float32Array(CONFIG.SPECTRUM_BARS);
  let time = null;
  let freq = null;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, CONFIG.MAX_PIXEL_RATIO);
    for (const [c, kw, kh] of [[waveCanvas, 'ww', 'wh'], [specCanvas, 'sw', 'sh']]) {
      const r = c.getBoundingClientRect();
      size[kw] = r.width;
      size[kh] = r.height;
      c.width = Math.round(r.width * dpr);
      c.height = Math.round(r.height * dpr);
    }
  }
  const ro = new ResizeObserver(resize);
  ro.observe(waveCanvas);
  ro.observe(specCanvas);
  resize();

  return {
    render(analyser, sampleRate) {
      if (!analyser) return;
      if (!time) {
        time = new Uint8Array(analyser.fftSize);
        freq = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteTimeDomainData(time);
      analyser.getByteFrequencyData(freq);

      // waveform
      const { ww, wh, sw, sh } = size;
      wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      wctx.clearRect(0, 0, ww, wh);
      wctx.strokeStyle = 'rgba(255,255,255,0.07)';
      wctx.beginPath();
      wctx.moveTo(0, wh / 2);
      wctx.lineTo(ww, wh / 2);
      wctx.stroke();
      const grad = wctx.createLinearGradient(0, 0, ww, 0);
      grad.addColorStop(0, '#7aa2ff');
      grad.addColorStop(1, '#b58bff');
      wctx.strokeStyle = grad;
      wctx.lineWidth = 1.6;
      wctx.shadowColor = 'rgba(122,162,255,0.6)';
      wctx.shadowBlur = 6;
      wctx.beginPath();
      const step = Math.max(1, Math.floor(time.length / ww / 2));
      for (let i = 0, x = 0; i < time.length; i += step, x = (i / time.length) * ww) {
        const y = wh / 2 + ((time[i] - 128) / 128) * (wh / 2 - 4);
        if (i === 0) wctx.moveTo(x, y);
        else wctx.lineTo(x, y);
      }
      wctx.stroke();
      wctx.shadowBlur = 0;

      // spectrum: log-spaced bands 30 Hz … 16 kHz
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.clearRect(0, 0, sw, sh);
      const n = CONFIG.SPECTRUM_BARS;
      const binHz = sampleRate / analyser.fftSize;
      const lo = Math.log(30);
      const hi = Math.log(16000);
      const bw = sw / n;
      for (let b = 0; b < n; b++) {
        const f0 = Math.exp(lo + ((hi - lo) * b) / n);
        const f1 = Math.exp(lo + ((hi - lo) * (b + 1)) / n);
        const i0 = Math.max(0, Math.floor(f0 / binHz));
        const i1 = Math.min(freq.length - 1, Math.max(i0, Math.ceil(f1 / binHz)));
        let m = 0;
        for (let i = i0; i <= i1; i++) m = Math.max(m, freq[i]);
        const v = m / 255;
        // fast attack, smooth fall
        bars[b] = v > bars[b] ? v : bars[b] * 0.85 + v * 0.15;
        const hue = 25 + (185 * b) / n; // warm bass → cool treble
        const h = Math.max(2, bars[b] * (sh - 6));
        sctx.fillStyle = `hsl(${hue} 90% ${45 + bars[b] * 25}%)`;
        sctx.beginPath();
        sctx.roundRect(b * bw + 1, sh - h, Math.max(1, bw - 2), h, 2);
        sctx.fill();
      }
    },
  };
}
