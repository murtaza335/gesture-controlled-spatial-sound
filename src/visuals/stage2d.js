import { CONFIG } from '../config.js';
import { sourceColor } from './sourceColors.js';

const AZ_MIN = CONFIG.MAP.azMin;
const AZ_MAX = CONFIG.MAP.azMax;
const EL_MIN = CONFIG.MAP.elMin;
const EL_MAX = CONFIG.MAP.elMax;
const M = { l: 44, r: 44, t: 28, b: 40 };

const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

/** 2D stage: azimuth × elevation map with animated sources and a hand cursor. */
export function createStage(canvas) {
  const ctx = canvas.getContext('2d');
  let w = 0;
  let h = 0;
  let dpr = 1;
  const disp = new Map(); // id → { x, y, r, lvl, trail, lastRing }
  const rings = []; // expanding ripples
  const cur = { x: -100, y: -100, pinch: 0, vis: 0, lastGrab: false };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, CONFIG.MAX_PIXEL_RATIO + 0.5);
    const r = canvas.getBoundingClientRect();
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  const plot = () => ({ x: M.l, y: M.t, w: Math.max(10, w - M.l - M.r), h: Math.max(10, h - M.t - M.b) });
  const toPx = (az, el) => {
    const p = plot();
    return {
      x: p.x + ((az - AZ_MIN) / (AZ_MAX - AZ_MIN)) * p.w,
      y: p.y + ((EL_MAX - el) / (EL_MAX - EL_MIN)) * p.h,
    };
  };
  const unit = () => {
    const p = plot();
    return (p.w + p.h) / 2;
  };

  function radiusFor(dist) {
    return 16 + 30 / Math.pow(Math.max(dist, 0.5), 0.8);
  }

  function ring(x, y, id, strong = false) {
    rings.push({ x, y, id, r: 10, life: 1, strong });
  }

  return {
    resize,
    /** Plot area in CSS px relative to the canvas (what az/el actually span). */
    plotRect: plot,
    /** Nearest source to an az/el, in stage-normalized units (GRAB_RADIUS is a fraction of `unit`). */
    nearest(az, el, sources) {
      const c = toPx(az, el);
      let best = null;
      let bestD = Infinity;
      for (const s of sources) {
        const p = toPx(s.az, s.el);
        const d = Math.hypot(p.x - c.x, p.y - c.y) / unit();
        if (d < bestD) {
          bestD = d;
          best = s;
        }
      }
      return { source: best, d: bestD };
    },
    /** Visual burst on a source (grab / release). */
    burst(id, strong = true) {
      const d = disp.get(id);
      if (!d) return;
      ring(d.x, d.y, id, strong);
      if (strong) ring(d.x, d.y, id, true);
    },

    render(now, dt, st) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const p = plot();
      const t = now / 1000;

      // --- grid ---
      ctx.lineWidth = 1;
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      for (let az = AZ_MIN; az <= AZ_MAX; az += 30) {
        const x = toPx(az, 0).x;
        ctx.strokeStyle = az === 0 ? 'rgba(122,162,255,0.28)' : 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.moveTo(x, p.y);
        ctx.lineTo(x, p.y + p.h);
        ctx.stroke();
        ctx.fillStyle = 'rgba(139,147,168,0.8)';
        ctx.fillText(`${az > 0 ? '+' : ''}${az}°`, x, p.y + p.h + 18);
      }
      ctx.textAlign = 'right';
      for (const el of [-30, 0, 30]) {
        const y = toPx(0, el).y;
        ctx.strokeStyle = el === 0 ? 'rgba(122,162,255,0.28)' : 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.moveTo(p.x, y);
        ctx.lineTo(p.x + p.w, y);
        ctx.stroke();
        ctx.fillStyle = 'rgba(139,147,168,0.8)';
        ctx.fillText(`${el > 0 ? '+' : ''}${el}°`, p.x - 8, y + 4);
      }

      // --- cursor smoothing ---
      const c = st.cursor;
      if (c) {
        const target = toPx(c.az, c.el);
        if (cur.vis < 0.05) {
          cur.x = target.x;
          cur.y = target.y;
        }
        cur.x = damp(cur.x, target.x, 40, dt);
        cur.y = damp(cur.y, target.y, 40, dt);
        cur.vis = damp(cur.vis, 1, 14, dt);
        cur.pinch = damp(cur.pinch, st.pinching ? 1 : 0, 28, dt);
      } else {
        cur.vis = damp(cur.vis, 0, 10, dt);
        cur.pinch = damp(cur.pinch, 0, 20, dt);
      }

      // --- sources ---
      const seen = new Set();
      for (const s of st.sources) {
        seen.add(s.id);
        const target = toPx(s.az, s.el);
        let d = disp.get(s.id);
        if (!d) {
          d = { x: target.x, y: target.y, r: 0, lvl: 0, trail: [], lastRing: 0, appear: 0 };
          disp.set(s.id, d);
        }
        const grabbed = st.grabbedId === s.id;
        d.x = damp(d.x, target.x, grabbed ? 30 : 14, dt);
        d.y = damp(d.y, target.y, grabbed ? 30 : 14, dt);
        d.appear = damp(d.appear, 1, 6, dt);
        const lvl = st.levels.get(s.id) ?? 0;
        d.lvl = damp(d.lvl, lvl, lvl > d.lvl ? 30 : 8, dt);
        d.r = damp(d.r, radiusFor(s.dist), 10, dt);

        if (grabbed) {
          d.trail.push({ x: d.x, y: d.y, t: now });
        }
        while (d.trail.length && now - d.trail[0].t > 450) d.trail.shift();

        if (d.lvl > 0.1 && now - d.lastRing > 520) {
          d.lastRing = now;
          ring(d.x, d.y, s.id);
        }
      }
      for (const id of [...disp.keys()]) if (!seen.has(id)) disp.delete(id);

      // ripples
      for (let i = rings.length - 1; i >= 0; i--) {
        const rg = rings[i];
        rg.r += (rg.strong ? 150 : 60) * dt;
        rg.life -= dt * (rg.strong ? 1.8 : 1.1);
        if (rg.life <= 0) {
          rings.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = sourceColor(rg.id, 65, rg.life * (rg.strong ? 0.7 : 0.35));
        ctx.lineWidth = rg.strong ? 2.5 : 1.5;
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, rg.r, 0, Math.PI * 2);
        ctx.stroke();
      }

      for (const s of st.sources) {
        const d = disp.get(s.id);
        const grabbed = st.grabbedId === s.id;
        const focused = st.focusedId === s.id;
        const hover = st.hoverId === s.id && !grabbed;
        const r = d.r * d.appear * (1 + d.lvl * 0.7) * (grabbed ? 1.12 : 1);

        // trail
        if (d.trail.length > 1) {
          ctx.lineCap = 'round';
          for (let i = 1; i < d.trail.length; i++) {
            const a = 1 - (now - d.trail[i].t) / 450;
            ctx.strokeStyle = sourceColor(s.id, 62, Math.max(0, a) * 0.5);
            ctx.lineWidth = 2 + a * 8;
            ctx.beginPath();
            ctx.moveTo(d.trail[i - 1].x, d.trail[i - 1].y);
            ctx.lineTo(d.trail[i].x, d.trail[i].y);
            ctx.stroke();
          }
        }

        // glow
        const glow = ctx.createRadialGradient(d.x, d.y, r * 0.2, d.x, d.y, r * (2.6 + d.lvl * 2));
        glow.addColorStop(0, sourceColor(s.id, 60, 0.45 + d.lvl * 0.4));
        glow.addColorStop(1, sourceColor(s.id, 60, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(d.x, d.y, r * (2.6 + d.lvl * 2), 0, Math.PI * 2);
        ctx.fill();

        // body
        const body = ctx.createRadialGradient(d.x - r * 0.3, d.y - r * 0.35, r * 0.1, d.x, d.y, r);
        body.addColorStop(0, sourceColor(s.id, 80, 1));
        body.addColorStop(1, sourceColor(s.id, 52, 1));
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        ctx.fill();

        // grabbed: bright outer ring
        if (grabbed) {
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.arc(d.x, d.y, r + 5, 0, Math.PI * 2);
          ctx.stroke();
        }
        // focused: rotating dashed ring
        if (focused && !grabbed) {
          ctx.save();
          ctx.setLineDash([6, 7]);
          ctx.lineDashOffset = -t * 14;
          ctx.strokeStyle = sourceColor(s.id, 75, 0.85);
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(d.x, d.y, r + 7, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        // hover: "grab range" lights up
        if (hover) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 6);
          ctx.strokeStyle = `rgba(255,255,255,${0.35 + pulse * 0.4})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(d.x, d.y, r + 10 + pulse * 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        // label
        ctx.textAlign = 'center';
        ctx.font = `600 ${focused ? 13 : 12}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = focused || grabbed ? '#fff' : 'rgba(232,236,246,0.8)';
        ctx.fillText(s.name, d.x, d.y + r + 22);
        if (grabbed) {
          ctx.font = '11px ui-monospace, monospace';
          ctx.fillStyle = 'rgba(232,236,246,0.7)';
          ctx.fillText(`${Math.round(s.az)}°  ${Math.round(s.el)}°  ${s.dist.toFixed(1)}m`, d.x, d.y + r + 38);
        }
      }

      // --- cursor ---
      if (cur.vis > 0.02) {
        const a = cur.vis;
        const pin = cur.pinch;
        const radius = lerp(24, 8, pin);
        const rangeR = CONFIG.GRAB_RADIUS * unit();
        // grab range halo (fades when pinched)
        ctx.save();
        ctx.setLineDash([3, 8]);
        ctx.lineDashOffset = -t * 10;
        ctx.strokeStyle = `rgba(90,169,255,${0.28 * a * (1 - pin * 0.8)})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, rangeR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.strokeStyle = `rgba(90,169,255,${a})`;
        ctx.fillStyle = `rgba(90,169,255,${a * (0.15 + pin * 0.6)})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(90,169,255,0.9)';
        ctx.shadowBlur = 10 + pin * 14;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        const g = radius + 8;
        const k = 6;
        ctx.beginPath();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          ctx.moveTo(cur.x + dx * g, cur.y + dy * g);
          ctx.lineTo(cur.x + dx * (g + k), cur.y + dy * (g + k));
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      if (cur.lastGrab !== !!st.pinching) {
        cur.lastGrab = !!st.pinching;
        if (st.pinching) {
          // pinch ripple at the cursor, even when nothing grabbed
          rings.push({ x: cur.x, y: cur.y, id: 3, r: 6, life: 0.8, strong: true });
        }
      }
    },
  };
}
