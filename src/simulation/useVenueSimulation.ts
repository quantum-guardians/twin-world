import { useEffect, useMemo, useRef, useState } from "react";
import type { Venue } from "../domain/types";
import { VenueSimulation, type SimulationOptions } from "./engine";
import { FIXED_DT_MS } from "./socialForce";

// A frame that resumes after the tab was backgrounded can have an
// arbitrarily large elapsed delta; capping the catch-up steps avoids a
// "spiral of death" where each frame takes longer than the last trying to
// simulate an ever-growing backlog.
const MAX_STEPS_PER_FRAME = 12;

export interface VenueSimulationControls {
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  reset: () => void;
}

export interface VenueSimulationHandle {
  simulation: VenueSimulation;
  controls: VenueSimulationControls;
  /** Bumped on every physics tick so consumers re-render; the simulation's
   * own mutable state (agent positions) is not itself reactive. */
  version: number;
}

/** Drives a VenueSimulation with a real-time, fixed-timestep loop (see
 * FIXED_DT_MS) tied to requestAnimationFrame, mirroring the accumulator
 * pattern documented for simulation_react's TopViewCanvas.tsx. */
export function useVenueSimulation(venue: Venue, options: SimulationOptions): VenueSimulationHandle {
  const [playing, setPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [version, setVersion] = useState(0);
  const [resetToken, setResetToken] = useState(0);

  const simulation = useMemo(
    () => new VenueSimulation(venue, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [venue, options.population, options.seed, resetToken]
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
        simulation.tick(FIXED_DT_MS);
        accumulatorMs -= FIXED_DT_MS;
        steps++;
      }
      if (steps > 0) setVersion((v) => v + 1);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [simulation]);

  const controls: VenueSimulationControls = {
    playing,
    setPlaying,
    playbackRate,
    setPlaybackRate,
    reset: () => setResetToken((t) => t + 1),
  };

  return { simulation, controls, version };
}
