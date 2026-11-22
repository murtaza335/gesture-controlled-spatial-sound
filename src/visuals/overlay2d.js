import { HAND_CONNECTIONS } from '../gestures/features.js';

const COLORS = { right: '90,169,255', left: '255,162,77' };

/** Camera-card overlay: draws the hand skeletons (mirrored coords already) over the video. */
export function createOverlay(canvas) {
  const ctx = canvas.getContext('2d');
  const fade = { left: 0, right: 0 };

  return {
    render(frame, gests) {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      for (const side of ['right', 'left']) {
        const hand = frame?.[side];
        fade[side] += ((hand ? 1 : 0) - fade[side]) * 0.25;
        if (!hand || fade[side] < 0.03) continue;
        const col = COLORS[side];
        const a = (hand.stale ? 0.4 : 1) * fade[side];
        const lm = hand.lm;
        const pinching = gests?.[side]?.state === 'pinching';

        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${col},${0.85 * a})`;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = `rgba(${col},0.8)`;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        for (const [i, j] of HAND_CONNECTIONS) {
          ctx.moveTo(lm[i].x * W, lm[i].y * H);
          ctx.lineTo(lm[j].x * W, lm[j].y * H);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle = `rgba(255,255,255,${0.9 * a})`;
        for (const p of lm) {
          ctx.beginPath();
          ctx.arc(p.x * W, p.y * H, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }

        if (pinching) {
          ctx.strokeStyle = `rgba(255,255,255,${a})`;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.moveTo(lm[4].x * W, lm[4].y * H);
          ctx.lineTo(lm[8].x * W, lm[8].y * H);
          ctx.stroke();
          ctx.fillStyle = `rgba(${col},${a})`;
          ctx.beginPath();
          ctx.arc(((lm[4].x + lm[8].x) / 2) * W, ((lm[4].y + lm[8].y) / 2) * H, 9, 0, Math.PI * 2);
          ctx.fill();
        }

        if (side === 'left' && gests?.left) {
          ctx.font = '700 26px Inter, system-ui, sans-serif';
          ctx.fillStyle = `rgba(${col},${a})`;
          ctx.fillText(String(gests.left.count), lm[0].x * W + 12, lm[0].y * H + 8);
        }
      }
    },
  };
}
