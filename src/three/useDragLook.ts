import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

const LOOK_SENSITIVITY = 0.0035; // radians per pixel of drag
const MAX_PITCH = Math.PI / 2 - 0.05;

/**
 * Click-and-drag look (yaw/pitch offsets from pointer movement), shared by
 * AgentPovCamera and FreeCamera. `resetKey` clears the accumulated
 * yaw/pitch whenever it changes (e.g. switching to a different followed
 * agent) so a new view starts facing forward.
 *
 * pointerdown is scoped to the canvas (so dragging a toolbar button
 * doesn't start a look-drag), but pointermove/pointerup listen on
 * `window`: relying on setPointerCapture alone turned out not to be
 * enough for a real mouse in a real browser (looked fine when driven by
 * synthetic automation events, but a live drag never registered) - the
 * missing piece was that without preventDefault, the browser's own
 * default drag/selection handling can intercept the gesture before our
 * pointermove ever sees continuous deltas. window-level listeners plus
 * preventDefault sidestep that regardless of what the pointer passes over
 * mid-drag.
 */
export function useDragLook(resetKey?: unknown) {
  const yaw = useRef(0);
  const pitch = useRef(0);
  const { gl } = useThree();

  useEffect(() => {
    yaw.current = 0;
    pitch.current = 0;
  }, [resetKey]);

  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      e.preventDefault();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      yaw.current -= dx * LOOK_SENSITIVITY;
      pitch.current = THREE.MathUtils.clamp(pitch.current - dy * LOOK_SENSITIVITY, -MAX_PITCH, MAX_PITCH);
      e.preventDefault();
    };
    const onPointerUp = () => {
      dragging = false;
    };

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    const previousTouchAction = el.style.touchAction;
    el.style.touchAction = "none";

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      el.style.touchAction = previousTouchAction;
    };
  }, [gl]);

  return { yaw, pitch };
}
