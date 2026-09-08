import { useEffect, useMemo, useRef, useState } from "react";
import type { Venue } from "../domain/types";
import { VenueSimulation, type SimulationOptions } from "./engine";
import { FIXED_DT_MS } from "./socialForce";
import { useSkipAhead } from "./useSkipAhead";

const MAX_STEPS_PER_FRAME = 12;

export interface PairedSimulationControls {
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  reset: () => void;
  /** Runs all three scenarios to their settled end without drawing them,
   * one time-boxed slice per animation frame (see useSkipAhead.ts).
   * Pauses playback first so the render loop's own tick calls cannot
   * interleave with the skip. */
  skipAhead: () => void;
  /** Stops a running skip where it is. The three engines keep whatever
   * state they reached, so the numbers on screen stay truthful. */
  cancelSkip: () => void;
  /** True while a skip is running - callers disable the controls that
   * would fight it and show progress instead. */
  skipping: boolean;
  /** 0 to 1 across the skip budget, for a progress readout. */
  skipProgress: number;
}

export interface TripleVenueSimulationHandle {
  baseline: VenueSimulation;
  robbins: VenueSimulation;
  optimized: VenueSimulation;
  controls: PairedSimulationControls;
}

/**
 * Runs three VenueSimulation instances - baseline (all-bidirectional),
 * Robbins (one-way, no optimization - the fair one-way baseline per
 * Robbins' 1939 theorem) and MR2S-optimized - on a single shared clock, so
 * the three-way comparison advances tick for tick in lockstep (plan
 * FR-09: "기준안과 최적화안이 같은 랜덤 시드와 조건으로 실행됨", extended
 * here to all three variants). All three must therefore be constructed
 * with the same `options` (population, seed) by the caller - this hook
 * doesn't enforce that itself, it just ticks whatever three engines it's
 * given at the same rate.
 *
 * Three simulations means three times the per-tick physics cost of the
 * original baseline/optimized pair, and the comparison view now renders
 * three live WebGL scenes at once instead of toggling between two - see
 * ComparisonView's doc comment. That added cost is exactly why
 * `controls.skipAhead` exists: jumping straight to the settled end state
 * is the practical way to read the comparison, rather than watching all
 * three scenes play out live.
 */
export function usePairedVenueSimulation(
  baselineVenue: Venue,
  robbinsVenue: Venue,
  optimizedVenue: Venue,
  options: SimulationOptions
): TripleVenueSimulationHandle {
  const [playing, setPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [, setVersion] = useState(0);
  const [resetToken, setResetToken] = useState(0);

  const baseline = useMemo(
    () => new VenueSimulation(baselineVenue, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baselineVenue, options.population, options.seed, options.urgency, options.scenarioMode, resetToken]
  );
  const robbins = useMemo(
    () => new VenueSimulation(robbinsVenue, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [robbinsVenue, options.population, options.seed, options.urgency, options.scenarioMode, resetToken]
  );
  const optimized = useMemo(
    () => new VenueSimulation(optimizedVenue, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optimizedVenue, options.population, options.seed, options.urgency, options.scenarioMode, resetToken]
  );

  const playingRef = useRef(playing);
  playingRef.current = playing;
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  useEffect(() => {
    let raf = 0;
    let lastTime: number | null = null;
    let accumulatorMs = 0;

    const frame = (time: number) => {
      raf = requestAnimationFrame(frame);
      if (lastTime === null) {
        lastTime = time;
        return;
      }
      const deltaMs = time - lastTime;
      lastTime = time;
      if (!playingRef.current) return;

      accumulatorMs += deltaMs * playbackRateRef.current;
      let steps = 0;
      while (accumulatorMs >= FIXED_DT_MS && steps < MAX_STEPS_PER_FRAME) {
        baseline.tick(FIXED_DT_MS);
        robbins.tick(FIXED_DT_MS);
        optimized.tick(FIXED_DT_MS);
        accumulatorMs -= FIXED_DT_MS;
        steps++;
      }
      if (steps > 0) setVersion((v) => v + 1);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [baseline, robbins, optimized]);

  const { skipAhead, cancelSkip, skipping, skipProgress } = useSkipAhead(
    useMemo(() => [baseline, robbins, optimized], [baseline, robbins, optimized]),
    () => setVersion((v) => v + 1),
    () => setPlaying(false) // stop the animation loop from also ticking while we skip
  );

  const controls: PairedSimulationControls = {
    playing,
    setPlaying,
    playbackRate,
    setPlaybackRate,
    reset: () => setResetToken((t) => t + 1),
    skipAhead,
    cancelSkip,
    skipping,
    skipProgress,
  };

  return { baseline, robbins, optimized, controls };
}
