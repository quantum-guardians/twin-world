import { useCallback, useEffect, useRef, useState } from "react";
import type { VenueSimulation } from "./engine";
import { fastForwardSlice, SKIP_AHEAD_SECONDS } from "./fastForward";

export interface SkipAheadHandle {
  /** Runs the rest of the scenario without drawing it. */
  skipAhead: () => void;
  /** Stops a running skip where it is; the simulations keep whatever state
   * they reached, so the numbers on screen stay truthful. */
  cancelSkip: () => void;
  skipping: boolean;
  /** 0 to 1 across the requested skip budget, for a progress readout. */
  skipProgress: number;
}

/**
 * Drives a skip-ahead one time-boxed slice per animation frame, shared by
 * the single-venue and three-way comparison hooks.
 *
 * Doing the whole skip in one call was the obvious implementation and the
 * wrong one: measured on this machine, three simulations at the demo
 * population of 300 advance 155 ticks per second, so a 1200-second skip is
 * roughly eight minutes during which a blocking call paints nothing and
 * the tab looks crashed. Slicing costs the same total time but keeps the
 * page responsive, lets the progress readout move, and lets the user stop
 * early once the comparison is obvious.
 *
 * `simulations` may be a fresh array each render; it is read through a ref
 * so a running skip always ticks the current engines and the callbacks
 * below stay stable.
 */
export function useSkipAhead(
  simulations: VenueSimulation[],
  /** Called after each slice so the caller can re-render its readouts. */
  onAdvance: () => void,
  /** Called once when a skip starts - the callers use it to pause playback
   * so the animation loop is not fighting the skip for the same clock. */
  onStart?: () => void,
  totalSeconds: number = SKIP_AHEAD_SECONDS
): SkipAheadHandle {
  const [skipping, setSkipping] = useState(false);
  const [skipProgress, setSkipProgress] = useState(0);

  const simulationsRef = useRef(simulations);
  simulationsRef.current = simulations;
  const onAdvanceRef = useRef(onAdvance);
  onAdvanceRef.current = onAdvance;
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  // Ref rather than state: the frame loop below reads this synchronously
  // and a state update would not be visible until the next render.
  const runningRef = useRef(false);
  const rafRef = useRef(0);

  const finish = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    setSkipping(false);
  }, []);

  const skipAhead = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setSkipping(true);
    setSkipProgress(0);
    onStartRef.current?.();

    let remaining = totalSeconds;
    const step = () => {
      if (!runningRef.current) return;
      const { advancedSeconds, settled } = fastForwardSlice(simulationsRef.current, remaining);
      remaining -= advancedSeconds;
      setSkipProgress(totalSeconds > 0 ? 1 - Math.max(remaining, 0) / totalSeconds : 1);
      onAdvanceRef.current();
      // advancedSeconds of 0 means there was nothing left to tick; without
      // this the loop would spin forever on an empty simulation list.
      if (settled || remaining <= 0 || advancedSeconds <= 0) {
        finish();
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [finish, totalSeconds]);

  // A skip must not outlive the component, or it keeps ticking engines
  // nothing is rendering any more.
  useEffect(() => finish, [finish]);

  return { skipAhead, cancelSkip: finish, skipping, skipProgress };
}
