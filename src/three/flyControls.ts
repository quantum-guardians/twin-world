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
 * vector by FreeCamera. Space/Q for vertical and Shift to boost follow the
 * Unity scene-view convention. Ctrl is deliberately not a boost key: the
 * browser closes the tab on Ctrl+W before the page sees the event. */
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
  KeyE: [0, 0, 1],
  KeyQ: [0, 0, -1],
};

export const BOOST_KEYS = new Set(["ShiftLeft", "ShiftRight"]);

/** The key listener is on window, so W/A/S/D typed into the scenario
 * textarea would otherwise fly the camera - and preventDefault would eat
 * the character. Ignore keys aimed at a text field. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as (Partial<HTMLElement> & { tagName?: string }) | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
}

/** Range of the toolbar speed slider, as a multiplier on the base speed. */
export const MIN_SPEED_SCALE = 0.25;
export const MAX_SPEED_SCALE = 4;
export const SPEED_SCALE_STEP = 0.25;

/** Free-fly speed in m/s. The camera enters this mode at the overview
 * position - hundreds of meters up over a large venue - where a fixed
 * street-level speed reads as barely moving, so speed scales with altitude
 * (capped), the toolbar slider scales it explicitly, and the boost key
 * multiplies on top. */
export function flySpeed(altitudeY: number, boosting: boolean, speedScale = 1): number {
  const altitudeScale = THREE.MathUtils.clamp(
    altitudeY / SPEED_REFERENCE_ALTITUDE,
    1,
    MAX_ALTITUDE_SPEED_SCALE
  );
  return MOVE_SPEED * altitudeScale * speedScale * (boosting ? BOOST_MULTIPLIER : 1);
}
