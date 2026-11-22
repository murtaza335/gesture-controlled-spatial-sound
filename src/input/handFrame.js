// @ts-check
/**
 * @typedef {{x:number, y:number, z:number}} Point  user-view coords (already mirrored), y down
 * @typedef {{side:'left'|'right', lm:Point[], score:number, stale?:boolean, scaleSmooth?:number}} HandData
 * @typedef {{t:number, left:HandData|null, right:HandData|null, source:'camera'|'mouse'}} HandFrame
 */

/**
 * Converts raw MediaPipe results into HandFrames.
 * Mirrors x once, fixes handedness, and keeps lost hands alive for a grace period.
 */
export function createHandFrameBuilder(cfg) {
  const last = { left: null, right: null };
  const seenAt = { left: -Infinity, right: -Infinity };

  return {
    /** @param {any} result MediaPipe HandLandmarkerResult @param {number} t */
    build(result, t) {
      const lists = result?.landmarks ?? [];
      const handed = result?.handedness ?? result?.handednesses ?? [];
      const hands = lists.map((raw, i) => {
        const lm = raw.map((p) => ({ x: 1 - p.x, y: p.y, z: p.z }));
        const cat = handed[i]?.[0];
        let side = cat?.categoryName === 'Left' ? 'left' : 'right';
        // The raw video is unmirrored, so MediaPipe's label is swapped.
        if (cfg.HANDEDNESS_SWAP) side = side === 'left' ? 'right' : 'left';
        return { side, lm, score: cat?.score ?? 0 };
      });

      // Two hands with the same label: assign by position (larger mirrored wrist x = right hand).
      if (hands.length === 2 && hands[0].side === hands[1].side) {
        const [a, b] = hands;
        const aIsRight = a.lm[0].x > b.lm[0].x;
        a.side = aIsRight ? 'right' : 'left';
        b.side = aIsRight ? 'left' : 'right';
      }

      for (const side of /** @type {const} */ (['left', 'right'])) {
        const hand = hands.find((h) => h.side === side);
        if (hand) {
          last[side] = hand;
          seenAt[side] = t;
        } else if (last[side] && t - seenAt[side] <= cfg.HAND_LOST_GRACE_MS) {
          last[side] = { ...last[side], stale: true };
        } else {
          last[side] = null;
        }
      }
      return { t, left: last.left, right: last.right, source: 'camera' };
    },
  };
}
