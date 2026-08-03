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
 * `enablePointerLock` additionally requests Pointer Lock on canvas click,
 * which is the conventional free-fly control scheme: the view keeps turning
 * past the window edge and no button has to stay held while the movement
 * keys are used. Locking is only enabled for the free camera - agent POV
 * keeps plain dragging so its toolbar (다른 에이전트로 전환) stays clickable
 * without pressing ESC first. The drag path below is kept in either case:
 * the browser can refuse a lock request (it rejects one issued right after
 * an ESC exit) and it is what still works on touch.
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
export function useDragLook(resetKey?: unknown, enablePointerLock = false) {
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

    const isLocked = () => document.pointerLockElement === el;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (enablePointerLock && !isLocked()) {
        // Returns a promise in current browsers, undefined in older ones;
        // a rejection just means we stay on the drag path below.
        void (el.requestPointerLock() as unknown as Promise<void> | undefined)?.catch(() => {});
      }
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      e.preventDefault();
    };
    const onPointerMove = (e: PointerEvent) => {
      // While locked the pointer has no meaningful client position, so the
      // per-event movement deltas are the only usable signal.
      const locked = isLocked();
      if (!locked && !dragging) return;
      const dx = locked ? e.movementX : e.clientX - lastX;
      const dy = locked ? e.movementY : e.clientY - lastY;
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
      // Leaving the mode (or unmounting) must not strand the page with a
      // captured pointer the user can only free with ESC.
      if (document.pointerLockElement === el) document.exitPointerLock();
    };
  }, [gl, enablePointerLock]);

  return { yaw, pitch };
}
