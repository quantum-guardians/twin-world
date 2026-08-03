import { useEffect, useMemo, useRef, useState } from "react";
import type { Venue } from "../domain/types";
import { VenueSimulation, type SimulationOptions } from "./engine";
import { FIXED_DT_MS } from "./socialForce";

const MAX_STEPS_PER_FRAME = 12;

export interface PairedSimulationControls {
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  reset: () => void;
}

export interface PairedVenueSimulationHandle {
  baseline: VenueSimulation;
  optimized: VenueSimulation;
  controls: PairedSimulationControls;
}

/**
 * Runs two VenueSimulation instances - one per venue variant - on a single
 * shared clock, so a baseline vs. MR2S-optimized comparison advances tick
 * for tick in lockstep (plan FR-09: "기준안과 최적화안이 같은 랜덤 시드와
 * 조건으로 실행됨"). Both must therefore be constructed with the same
 * `options` (population, seed) by the caller - this hook doesn't enforce
 * that itself, it just ticks whatever two engines it's given at the same
 * rate.
 */
export function usePairedVenueSimulation(
  baselineVenue: Venue,
  optimizedVenue: Venue,
  options: SimulationOptions
): PairedVenueSimulationHandle {
  const [playing, setPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [, setVersion] = useState(0);
  const [resetToken, setResetToken] = useState(0);

  const baseline = useMemo(
    () => new VenueSimulation(baselineVenue, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baselineVenue, options.population, options.seed, options.urgency, resetToken]
  );
  const optimized = useMemo(
    () => new VenueSimulation(optimizedVenue, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optimizedVenue, options.population, options.seed, options.urgency, resetToken]
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
        optimized.tick(FIXED_DT_MS);
        accumulatorMs -= FIXED_DT_MS;
        steps++;
      }
      if (steps > 0) setVersion((v) => v + 1);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [baseline, optimized]);

  const controls: PairedSimulationControls = {
    playing,
    setPlaying,
    playbackRate,
    setPlaybackRate,
    reset: () => setResetToken((t) => t + 1),
  };

  return { baseline, optimized, controls };
}
