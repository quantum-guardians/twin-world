/** Deterministic PRNG (mulberry32) so procedurally generated content
 * (buildings, later agent spawns/scenarios) is reproducible from a seed -
 * required for comparing baseline vs. MR2S-optimized runs under identical
 * conditions (see plan: "동일한 시드·인원·목적지 분포"). */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
