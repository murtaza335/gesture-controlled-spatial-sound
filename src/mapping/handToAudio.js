// @ts-check
const DEG = Math.PI / 180;

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function mapRange(v, inMin, inMax, outMin, outMax, clampOut = true) {
  const t = (v - inMin) / (inMax - inMin);
  const out = outMin + t * (outMax - outMin);
  if (!clampOut) return out;
  return clamp(out, Math.min(outMin, outMax), Math.max(outMin, outMax));
}

/** min * (max/min)^t, for frequency and distance. */
export function expMap(t, min, max) {
  return min * Math.pow(max / min, t);
}

/** Palm position + hand scale → direction in degrees and distance in metres. */
export function handToSpherical(palm, scale, cal) {
  const az = mapRange(palm.x, cal.xMin, cal.xMax, cal.azMin, cal.azMax);
  const el = mapRange(palm.y, cal.yMax, cal.yMin, cal.elMin, cal.elMax);
  const t = clamp((scale - cal.scaleFar) / (cal.scaleNear - cal.scaleFar), 0, 1);
  const dist = expMap(1 - t, cal.distMin, cal.distMax);
  return { az, el, dist };
}

/** Listener at origin facing −Z, +X right, +Y up. */
export function sphericalToCartesian(azDeg, elDeg, dist) {
  const az = azDeg * DEG;
  const el = elDeg * DEG;
  return {
    x: dist * Math.sin(az) * Math.cos(el),
    y: dist * Math.sin(el),
    z: -dist * Math.cos(az) * Math.cos(el),
  };
}
