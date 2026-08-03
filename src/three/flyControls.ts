import * as THREE from "three";

/** Key mapping and speed rule for the free-fly camera. Split out of
 * FreeCamera.tsx so the component file only exports a component (fast
 * refresh) and so the speed rule stays unit-testable without a renderer. */

const MOVE_SPEED = 30; // m/s - venues can span hundreds of meters, so this covers one in well under a minute
const BOOST_MULTIPLIER = 3;
/** Altitude at and below which the base speed applies, and the ceiling on
 * how much faster the camera flies when far above the venue. */
const SPEED_REFERENCE_ALTITUDE = 20; // m
const MAX_ALTITUDE_SPEED_SCALE = 8;

/** Keep the camera above the street rather than letting it sink under the
 * floor plane, where the view goes black with no obvious way back. */
export const MIN_ALTITUDE = 1.6; // m

/** [forward, right, up] contribution per key, combined into a single move
 * vector by FreeCamera. Space/Shift for vertical and Ctrl to boost follow
 * the usual free-fly convention (Minecraft creative, Unity scene view). */
export const AXIS_BY_KEY: Record<string, [number, number, number]> = {
  KeyW: [1, 0, 0],
  KeyS: [-1, 0, 0],
  KeyD: [0, 1, 0],
  KeyA: [0, -1, 0],
  ArrowUp: [1, 0, 0],
  ArrowDown: [-1, 0, 0],
  ArrowRight: [0, 1, 0],
  ArrowLeft: [0, -1, 0],
  Space: [0, 0, 1],
  ShiftLeft: [0, 0, -1],
  ShiftRight: [0, 0, -1],
};

export const BOOST_KEYS = new Set(["ControlLeft", "ControlRight"]);

/** Free-fly speed in m/s. The camera enters this mode at the overview
 * position - hundreds of meters up over a large venue - where a fixed
 * street-level speed reads as barely moving, so speed scales with altitude
 * (capped) and the boost key multiplies on top. */
export function flySpeed(altitudeY: number, boosting: boolean): number {
  const altitudeScale = THREE.MathUtils.clamp(
    altitudeY / SPEED_REFERENCE_ALTITUDE,
    1,
    MAX_ALTITUDE_SPEED_SCALE
  );
  return MOVE_SPEED * altitudeScale * (boosting ? BOOST_MULTIPLIER : 1);
}
