export function hasSpeakingVolume(samples: Uint8Array, threshold = 0.035): boolean {
  if (!samples.length) return false;
  let sum = 0;
  for (const sample of samples) {
    const normalized = (sample - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / samples.length) >= threshold;
}
