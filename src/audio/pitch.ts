/** Equal-tempered teaching references; these are not a model of raga intonation. */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function hzToMidi(hz: number): number {
  return hz > 0 && Number.isFinite(hz) ? 69 + 12 * Math.log2(hz / 440) : Number.NaN;
}

export function midiName(midi: number): string {
  if (!Number.isFinite(midi)) return '—';
  const rounded = Math.round(midi);
  const names = ['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'];
  return `${names[((rounded % 12) + 12) % 12]}${Math.floor(rounded / 12) - 1}`;
}

export function centsError(detectedHz: number, targetHz: number): number {
  return detectedHz > 0 && targetHz > 0 && Number.isFinite(detectedHz + targetHz)
    ? 1200 * Math.log2(detectedHz / targetHz)
    : Number.NaN;
}

export type PitchDetection = { hz: number | null; confidence: number; rms: number };

/**
 * YIN cumulative mean-normalised difference, with parabolic period refinement.
 * Bounds intentionally cover common bansuri fundamentals (65–2200 Hz).
 * The result is pitch evidence, never evidence of correct fingering or onset.
 */
export function detectPitch(samples: Float32Array, sampleRate: number): PitchDetection {
  if (samples.length < 256 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return { hz: null, confidence: 0, rms: 0 };
  }
  let mean = 0;
  for (const sample of samples) mean += sample;
  mean /= samples.length;
  let power = 0;
  for (const sample of samples) power += (sample - mean) ** 2;
  const rms = Math.sqrt(power / samples.length);
  if (!Number.isFinite(rms) || rms < 0.003) return { hz: null, confidence: 0, rms: rms || 0 };

  const half = Math.floor(samples.length / 2);
  const maxLag = Math.min(half - 1, Math.ceil(sampleRate / 65));
  const minLag = Math.max(2, Math.floor(sampleRate / 2200));
  const differences = new Float64Array(maxLag + 1);
  differences[0] = 1;
  let sum = 0;
  for (let lag = 1; lag <= maxLag; lag++) {
    let difference = 0;
    for (let i = 0; i < half; i++) {
      const delta = samples[i] - samples[i + lag];
      difference += delta * delta;
    }
    sum += difference;
    differences[lag] = sum > 0 ? (difference * lag) / sum : 1;
  }
  let period = -1;
  let best = minLag;
  for (let lag = minLag; lag < maxLag; lag++) {
    if (differences[lag] < differences[best]) best = lag;
    if (differences[lag] < 0.15) {
      while (lag + 1 < maxLag && differences[lag + 1] < differences[lag]) lag++;
      period = lag;
      break;
    }
  }
  if (period < 0) {
    return { hz: null, confidence: Math.max(0, 1 - differences[best]), rms };
  }
  const confidence = Math.max(0, Math.min(1, 1 - differences[period]));
  const left = differences[period - 1];
  const centre = differences[period];
  const right = differences[period + 1];
  const denominator = left - 2 * centre + right;
  const correction = denominator === 0 ? 0 : Math.max(-1, Math.min(1, (left - right) / (2 * denominator)));
  const hz = sampleRate / (period + correction);
  return { hz: hz >= 65 && hz <= 2200 && confidence >= 0.8 ? hz : null, confidence, rms };
}
