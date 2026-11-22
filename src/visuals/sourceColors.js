const HUES = [28, 335, 265, 190, 140, 55];

export function sourceHue(id) {
  return HUES[id % HUES.length];
}

export function sourceColor(id, l = 62, a = 1) {
  return `hsla(${sourceHue(id)}, 90%, ${l}%, ${a})`;
}
