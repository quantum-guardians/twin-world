/**
 * Uniform spatial hash over agent positions. Every physics/steering query
 * in the simulation is short-range (body contact ~0.4 m, crush pressure
 * ~0.5 m, vision horizon 8 m), so scanning all N agents per agent - the
 * previous O(N²) inner loops - wastes almost every comparison once crowds
 * reach the thousands. A grid rebuild is O(N) and near-free compared to
 * one pairwise sweep; queries then touch only the cells overlapping the
 * search radius.
 *
 * Determinism: cells store indices in insertion order and queries iterate
 * cells in a fixed row-major order, so for identical input the callback
 * sequence - and therefore floating-point accumulation order - is
 * reproducible run-to-run (the engine's fixed-seed guarantee relies on it).
 */
export class SpatialGrid {
  private readonly cells = new Map<number, number[]>();
  private readonly xs: number[] = [];
  private readonly ys: number[] = [];
  private readonly cellSize: number;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  clear(): void {
    this.cells.clear();
    this.xs.length = 0;
    this.ys.length = 0;
  }

  private key(cx: number, cy: number): number {
    // Supports |coordinate| up to ~2^20 cells without collision.
    return (cx + 1_048_576) * 2_097_152 + (cy + 1_048_576);
  }

  insert(index: number, x: number, y: number): void {
    this.xs[index] = x;
    this.ys[index] = y;
    const k = this.key(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
    const bucket = this.cells.get(k);
    if (bucket) bucket.push(index);
    else this.cells.set(k, [index]);
  }

  /**
   * Invokes `callback(j)` for every inserted index whose position lies
   * within `radius` of (x, y) - exact distance filtering included, so the
   * callback sees no cell-level false positives. The center index itself
   * is reported too when inserted; callers filter self/ordering as needed.
   */
  forEachInRadius(x: number, y: number, radius: number, callback: (index: number) => void): void {
    const minCx = Math.floor((x - radius) / this.cellSize);
    const maxCx = Math.floor((x + radius) / this.cellSize);
    const minCy = Math.floor((y - radius) / this.cellSize);
    const maxCy = Math.floor((y + radius) / this.cellSize);
    const radiusSq = radius * radius;

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.cells.get(this.key(cx, cy));
        if (!bucket) continue;
        for (const j of bucket) {
          const dx = this.xs[j] - x;
          const dy = this.ys[j] - y;
          if (dx * dx + dy * dy <= radiusSq) callback(j);
        }
      }
    }
  }
}
