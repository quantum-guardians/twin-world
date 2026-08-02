import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useDragLook } from "./useDragLook";

const MOVE_SPEED = 30; // m/s - venues can span hundreds of meters, so this covers one in well under a minute

// [forward, right] contribution per key, combined below into a single move vector.
const AXIS_BY_KEY: Record<string, [number, number]> = {
  KeyW: [1, 0],
  KeyS: [-1, 0],
  KeyD: [0, 1],
  KeyA: [0, -1],
  ArrowUp: [1, 0],
  ArrowDown: [-1, 0],
  ArrowRight: [0, 1],
  ArrowLeft: [0, -1],
};

/**
 * Free-fly camera: WASD/arrow keys move along the current facing
 * direction (projected onto the horizontal plane, so looking up/down
 * doesn't send the camera into the ground or sky), click-and-drag
 * (useDragLook) controls facing. A third way to explore the scene
 * alongside the fixed overview and the agent-attached POV - starts from
 * wherever the camera currently is (VenueScene remounts the camera to the
 * overview position when entering this mode fresh from the overview, so
 * no separate initial-position prop is needed here).
 */
export function FreeCamera() {
  const { camera } = useThree();
  const { yaw, pitch } = useDragLook();
  const keysDown = useRef(new Set<string>());
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!AXIS_BY_KEY[e.code]) return;
      keysDown.current.add(e.code);
      e.preventDefault(); // arrow keys otherwise scroll the page
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysDown.current.delete(e.code);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      keysDown.current.clear();
    };
  }, []);

  useFrame((_, delta) => {
    euler.current.set(pitch.current, yaw.current, 0);
    camera.quaternion.setFromEuler(euler.current);

    let f = 0;
    let r = 0;
    for (const code of keysDown.current) {
      const axis = AXIS_BY_KEY[code];
      if (!axis) continue;
      f += axis[0];
      r += axis[1];
    }
    if (f === 0 && r === 0) return;

    forward.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.current.y = 0;
    if (forward.current.lengthSq() > 1e-9) forward.current.normalize();

    right.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
    right.current.y = 0;
    if (right.current.lengthSq() > 1e-9) right.current.normalize();

    move.current.set(0, 0, 0).addScaledVector(forward.current, f).addScaledVector(right.current, r);
    if (move.current.lengthSq() > 1e-9) {
      move.current.normalize().multiplyScalar(MOVE_SPEED * delta);
      camera.position.add(move.current);
    }
  });

  return null;
}
