import { useEffect, useMemo, useRef, useState } from "react";
import type { Venue } from "../domain/types";
import { VenueSimulation, type SimulationOptions } from "./engine";
import { FIXED_DT_MS } from "./socialForce";
import { useSkipAhead } from "./useSkipAhead";

// A frame that resumes after the tab was backgrounded can have an
// arbitrarily large elapsed delta; capping the catch-up steps avoids a
// "spiral of death" where each frame takes longer than the last trying to
// simulate an ever-growing backlog.
const MAX_STEPS_PER_FRAME = 12;
/** Fixed ticks in one second of simulated time - the denominator that turns
 * a measured tick rate back into a playback multiplier. */
const TICKS_PER_SIMULATED_SECOND = 1000 / FIXED_DT_MS;
/** Wall-clock window the achieved rate is averaged over. Short enough to
 * react when the crowd thickens, long enough not to flicker. */
const ACHIEVED_RATE_WINDOW_MS = 500;

export interface VenueSimulationControls {
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  /** Multiplier the loop actually achieved over the last half second. Below
   * the selected rate whenever the machine, not the selection, is the
   * binding constraint. */
  achievedRate: number;
  reset: () => void;
  /** Runs the rest of the simulation to its settled end with no rendering,
   * one time-boxed slice per animation frame - see useSkipAhead.ts.
   * Ignored if a skip is already in progress. */
  skipAhead: () => void;
  /** Stops a running skip where it is. */
  cancelSkip: () => void;
  /** True while a skip is running, so UI can disable controls that would
   * fight it and show progress instead. */
  skipping: boolean;
  /** 0 to 1 across the skip budget. */
  skipProgress: number;
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
  const [achievedRate, setAchievedRate] = useState(1);
  const simulation = useMemo(
    () => new VenueSimulation(venue, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [venue, options.population, options.seed, options.urgency, options.scenarioMode, resetToken]
  );

  const playingRef = useRef(playing);
  playingRef.current = playing;
  const playbackRateRef = useRef(playbackRate);
  playbackRateRef.current = playbackRate;

  useEffect(() => {
    let raf = 0;
    let lastTime: number | null = null;
    let accumulatorMs = 0;
    let ticksInWindow = 0;
    let windowStartedAt = performance.now();

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
      // Drop time the loop could not spend. Without this the accumulator
      // grows without bound whenever the requested rate exceeds what the
      // machine can tick, and the debt never clears: dialling the rate
      // back down would leave the simulation sprinting to repay a backlog
      // of minutes. Falling behind should mean "as fast as it can go",
      // not "owe the difference forever".
      accumulatorMs = Math.min(accumulatorMs, FIXED_DT_MS * MAX_STEPS_PER_FRAME);

      ticksInWindow += steps;
      if (time - windowStartedAt >= ACHIEVED_RATE_WINDOW_MS) {
        const seconds = (time - windowStartedAt) / 1000;
        setAchievedRate(ticksInWindow / seconds / TICKS_PER_SIMULATED_SECOND);
        ticksInWindow = 0;
        windowStartedAt = time;
      }
      if (steps > 0) setVersion((v) => v + 1);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [simulation]);

  const { skipAhead, cancelSkip, skipping, skipProgress } = useSkipAhead(
    useMemo(() => [simulation], [simulation]),
    () => setVersion((v) => v + 1),
    () => setPlaying(false) // stop the animation loop from also ticking while we skip
  );

  const controls: VenueSimulationControls = {
    playing,
    setPlaying,
    playbackRate,
    setPlaybackRate,
    achievedRate,
    reset: () => setResetToken((t) => t + 1),
    skipAhead,
    cancelSkip,
    skipping,
    skipProgress,
  };

  return { simulation, controls, version };
}
