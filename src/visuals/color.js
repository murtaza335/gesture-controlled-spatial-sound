// @ts-check
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Maps a frequency spectrum to a colour: bass-heavy → warm orange, treble-heavy → cool blue.
 * @param {Uint8Array|number[]} freqBytes  analyser byte frequency data (0..255)
 * @returns {{hue:number, light:number, energy:number}} hue in degrees, light = HSL lightness %, energy 0..1
 */
export function spectrumToColor(freqBytes, sampleRate, fftSize) {
  const binHz = sampleRate / fftSize;
  let bassSum = 0, bassN = 0, trebSum = 0, trebN = 0, all = 0;
  for (let i = 0; i < freqBytes.length; i++) {
    const f = i * binHz;
    const v = freqBytes[i];
    all += v;
    if (f < 250) { bassSum += v; bassN++; }
    else if (f > 2000) { trebSum += v; trebN++; }
  }
  const bass = bassN ? bassSum / bassN : 0;
  const treble = trebN ? trebSum / trebN : 0;
  const ratio = treble / (bass + treble + 1e-6);
  const energy = freqBytes.length ? all / freqBytes.length / 255 : 0;
  return { hue: lerp(25, 210, ratio), light: 35 + 35 * energy, energy };
}
