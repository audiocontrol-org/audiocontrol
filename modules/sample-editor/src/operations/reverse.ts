/**
 * Reverse the sample.
 * Creates a new Int16Array with samples in reverse order.
 */
export function reverseSamples(samples: Int16Array): Int16Array {
  const result = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    result[i] = samples[samples.length - 1 - i];
  }
  return result;
}
