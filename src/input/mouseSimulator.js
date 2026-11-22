import { CONFIG } from '../config.js';
import { makeHand, fingers, FIST } from '../../tests/fixtures/handFixtures.js';
import { palmCenter } from '../gestures/features.js';

/**
 * Fake hands from mouse + keyboard so every feature works without a camera.
 *  - mouse over the stage = right palm; wheel = depth; button = pinch
 *  - Alt + fast horizontal move = swipe (swipes are off otherwise, so mouse flicks don't change track)
 *  - keys 1–5 / 0 = left-hand finger count / fist (Esc hides the left hand)
 *  - hold Shift = left pinch; the left hand then follows the mouse's vertical position
 */
export function createMouseSimulator(stageEl, getPlot) {
  const sim = {
    enabled: false,
    fx: 0.5, // pointer position in plot fractions (0..1, y down)
    fy: 0.5,
    scale: 0.19,
    pinchTarget: 0,
    pinch: 0,
    down: false,
    leftCount: null,
    leftPinch: 0,
    shift: false,
    alt: false,
    leftY: 0.5,
  };

  const onMove = (e) => {
    const r = stageEl.getBoundingClientRect();
    const p = getPlot();
    sim.fx = (e.clientX - r.left - p.x) / p.w;
    sim.fy = (e.clientY - r.top - p.y) / p.h;
    sim.alt = e.altKey;
    sim.shift = e.shiftKey;
  };
  stageEl.addEventListener('pointerdown', (e) => {
    if (!sim.enabled) return;
    onMove(e);
    if (e.shiftKey) return; // shift = left hand
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
    if (e.key === 'Shift') sim.shift = true;
    if (e.key === 'Alt') sim.alt = true;
    if (/^[0-5]$/.test(e.key)) sim.leftCount = Number(e.key);
    if (e.key === 'Escape') sim.leftCount = null;
  });
  window.addEventListener('keyup', (e) => {
    if (e.key === 'Shift') sim.shift = false;
    if (e.key === 'Alt') sim.alt = false;
  });
  window.addEventListener('blur', () => {
    sim.shift = false;
    sim.alt = false;
  });

  function handAt(fx, fy, scale, extended, pinch) {
    const m = CONFIG.MAP;
    const target = { x: m.xMin + fx * (m.xMax - m.xMin), y: m.yMin + fy * (m.yMax - m.yMin) };
    const lm0 = makeHand({ wrist: { x: 0, y: 0 }, scale, extended, pinch });
    const c = palmCenter(lm0);
    return lm0.map((p) => ({ x: p.x - c.x + target.x, y: p.y - c.y + target.y, z: 0 }));
  }

  const clamp01 = (v) => Math.min(1, Math.max(0, v));

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
      const right = {
        side: 'right',
        score: 1,
        lm: handAt(clamp01(sim.fx), clamp01(sim.fy), sim.scale, [true, true, true, true, true], sim.pinch),
      };

      // left hand: visible while Shift is held or a finger count was chosen
      const leftTarget = sim.shift ? 1 : 0;
      sim.leftPinch += (leftTarget - sim.leftPinch) * 0.5;
      if (sim.leftPinch < 0.01) sim.leftPinch = 0;
      if (sim.shift) sim.leftY = clamp01(sim.fy);
      let left = null;
      if (sim.shift || sim.leftCount !== null) {
        const count = sim.leftCount ?? 2;
        const ext = count === 0 ? FIST : fingers(count);
        left = { side: 'left', score: 1, lm: handAt(0.12, sim.leftY, 0.17, ext, sim.leftPinch) };
      }
      return { t: now, left, right, source: 'mouse', noSwipe: !sim.alt };
    },
  };
}
