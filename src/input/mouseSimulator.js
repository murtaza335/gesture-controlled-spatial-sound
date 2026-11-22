import { CONFIG } from '../config.js';
import { makeHand, fingers, FIST } from '../../tests/fixtures/handFixtures.js';
import { palmCenter } from '../gestures/features.js';

/**
 * Fake hands from mouse + keyboard so every feature works without a camera.
 * Mouse over the stage = right palm position, wheel = depth, button = pinch.
 * Keys 1–5 / 0 = left hand finger count / fist.
 */
export function createMouseSimulator(stageEl, getPlot) {
  const sim = {
    enabled: false,
    fx: 0.5, // pointer position in stage fractions (0..1, y down)
    fy: 0.5,
    scale: 0.19,
    pinchTarget: 0,
    pinch: 0,
    down: false,
    leftCount: null,
    pointerInside: false,
  };

  const onMove = (e) => {
    const r = stageEl.getBoundingClientRect();
    const p = getPlot();
    sim.fx = (e.clientX - r.left - p.x) / p.w;
    sim.fy = (e.clientY - r.top - p.y) / p.h;
    sim.pointerInside = sim.fx >= 0 && sim.fx <= 1 && sim.fy >= 0 && sim.fy <= 1;
  };
  stageEl.addEventListener('pointerdown', (e) => {
    if (!sim.enabled) return;
    onMove(e);
    sim.down = true;
    sim.pinchTarget = 1;
    stageEl.setPointerCapture?.(e.pointerId);
  });
  window.addEventListener('pointermove', (e) => sim.enabled && onMove(e));
  window.addEventListener('pointerup', () => {
    sim.down = false;
    sim.pinchTarget = 0;
  });
  stageEl.addEventListener(
    'wheel',
    (e) => {
      if (!sim.enabled) return;
      e.preventDefault();
      sim.scale = Math.min(0.3, Math.max(0.09, sim.scale * Math.exp(-e.deltaY * 0.0012)));
    },
    { passive: false },
  );
  window.addEventListener('keydown', (e) => {
    if (!sim.enabled || e.target?.tagName === 'INPUT') return;
    if (/^[0-5]$/.test(e.key)) sim.leftCount = Number(e.key);
    if (e.key === 'Escape') sim.leftCount = null;
  });

  function handAt(fx, fy, scale, extended, pinch) {
    const m = CONFIG.MAP;
    const target = { x: m.xMin + fx * (m.xMax - m.xMin), y: m.yMin + fy * (m.yMax - m.yMin) };
    const lm0 = makeHand({ wrist: { x: 0, y: 0 }, scale, extended, pinch });
    const c = palmCenter(lm0);
    return lm0.map((p) => ({ x: p.x - c.x + target.x, y: p.y - c.y + target.y, z: 0 }));
  }

  return {
    sim,
    get enabled() {
      return sim.enabled;
    },
    setEnabled(v) {
      sim.enabled = v;
      if (!v) {
        sim.down = false;
        sim.pinchTarget = 0;
      }
    },
    getFrame(now) {
      sim.pinch += (sim.pinchTarget - sim.pinch) * 0.5;
      if (sim.pinch < 0.01) sim.pinch = 0;
      const fx = Math.min(1, Math.max(0, sim.fx));
      const fy = Math.min(1, Math.max(0, sim.fy));
      const right = {
        side: 'right',
        score: 1,
        lm: handAt(fx, fy, sim.scale, [true, true, true, true, true], sim.pinch),
      };
      let left = null;
      if (sim.leftCount !== null) {
        const ext = sim.leftCount === 0 ? FIST : fingers(sim.leftCount);
        left = { side: 'left', score: 1, lm: handAt(0.12, 0.5, 0.17, ext, 0) };
      }
      return { t: now, left, right, source: 'mouse' };
    },
  };
}
