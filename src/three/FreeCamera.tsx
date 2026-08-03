import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useDragLook } from "./useDragLook";
import { AXIS_BY_KEY, BOOST_KEYS, MIN_ALTITUDE, flySpeed } from "./flyControls";

/**
 * Free-fly camera: WASD/arrow keys move along the current facing
 * direction (projected onto the horizontal plane, so looking up/down
 * doesn't send the camera into the ground or sky), Space/E and Q move
 * straight up and down along world up, and mouse look (useDragLook, with
 * pointer lock on click) controls facing. A third way to explore the scene
 * alongside the fixed overview and the agent-attached POV - starts from
 * wherever the camera currently is (VenueScene remounts the camera to the
 * overview position when entering this mode fresh from the overview, so
 * no separate initial-position prop is needed here).
 */
export function FreeCamera() {
  const { camera } = useThree();
  const { yaw, pitch } = useDragLook(undefined, true);
  const keysDown = useRef(new Set<string>());
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const forward = useRef(new THREE.Vector3());
  const right = useRef(new THREE.Vector3());
  const move = useRef(new THREE.Vector3());

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!AXIS_BY_KEY[e.code] && !BOOST_KEYS.has(e.code)) return;
      keysDown.current.add(e.code);
      e.preventDefault(); // arrow keys and Space otherwise scroll the page
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
    let u = 0;
    let boosting = false;
    for (const code of keysDown.current) {
      if (BOOST_KEYS.has(code)) boosting = true;
      const axis = AXIS_BY_KEY[code];
      if (!axis) continue;
      f += axis[0];
      r += axis[1];
      u += axis[2];
    }
    if (f === 0 && r === 0 && u === 0) return;

    forward.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.current.y = 0;
    if (forward.current.lengthSq() > 1e-9) forward.current.normalize();

    right.current.set(1, 0, 0).applyQuaternion(camera.quaternion);
    right.current.y = 0;
    if (right.current.lengthSq() > 1e-9) right.current.normalize();

    move.current.set(0, 0, 0).addScaledVector(forward.current, f).addScaledVector(right.current, r);
    move.current.y += u;
    if (move.current.lengthSq() > 1e-9) {
      move.current.normalize().multiplyScalar(flySpeed(camera.position.y, boosting) * delta);
      camera.position.add(move.current);
      camera.position.y = Math.max(camera.position.y, MIN_ALTITUDE);
    }
  });

  return null;
}
