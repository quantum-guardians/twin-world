import { describe, expect, it } from "vitest";
import {
  chooseHeuristicMotion,
  collisionDistanceToAgent,
  collisionDistanceToWall,
  type VisionNeighbor,
  type VisionParams,
} from "./visionHeuristic";

const PARAMS: VisionParams = {
  phiRad: (75 * Math.PI) / 180,
  horizonM: 8,
  rayCount: 21,
  rightBias: 0.02,
  tauS: 0.5,
};

const SELF_RADIUS = 0.2;
const SPEED = 1.25;

function staticNeighbor(x: number, y: number, radius = 0.2): VisionNeighbor {
  return { x, y, vx: 0, vy: 0, radius };
}

describe("collisionDistanceToAgent", () => {
  it("returns the gap distance for a static obstacle dead ahead", () => {
    const f = collisionDistanceToAgent(0, 0, 1, 0, SPEED, SELF_RADIUS, staticNeighbor(5, 0));
    expect(f).toBeCloseTo(5 - 0.4, 5); // center gap minus summed radii
  });

  it("returns 0 when discs already overlap", () => {
    const f = collisionDistanceToAgent(0, 0, 1, 0, SPEED, SELF_RADIUS, staticNeighbor(0.3, 0));
    expect(f).toBe(0);
  });

  it("returns Infinity for an obstacle far off the walking line", () => {
    const f = collisionDistanceToAgent(0, 0, 1, 0, SPEED, SELF_RADIUS, staticNeighbor(0, 5));
    expect(f).toBe(Infinity);
  });

  it("returns Infinity when the other agent is moving away faster", () => {
    const other: VisionNeighbor = { x: 5, y: 0, vx: 2, vy: 0, radius: 0.2 };
    const f = collisionDistanceToAgent(0, 0, 1, 0, SPEED, SELF_RADIUS, other);
    expect(f).toBe(Infinity);
  });

  it("halves the collision distance against a head-on walker at equal speed", () => {
    const other: VisionNeighbor = { x: 5, y: 0, vx: -SPEED, vy: 0, radius: 0.2 };
    const f = collisionDistanceToAgent(0, 0, 1, 0, SPEED, SELF_RADIUS, other);
    // Closing speed 2×SPEED over a 4.6 m gap; self covers half of it.
    expect(f).toBeCloseTo(4.6 / 2, 5);
  });
});

describe("collisionDistanceToWall", () => {
  const wall = { a: { x: 2, y: -1 }, b: { x: 2, y: 1 } };

  it("returns ray distance minus the agent radius for a frontal wall", () => {
    expect(collisionDistanceToWall(0, 0, 1, 0, SELF_RADIUS, wall)).toBeCloseTo(1.8, 5);
  });

  it("misses a wall behind the agent", () => {
    expect(collisionDistanceToWall(0, 0, -1, 0, SELF_RADIUS, wall)).toBe(Infinity);
  });

  it("misses a wall segment outside its span", () => {
    const shifted = { a: { x: 2, y: 5 }, b: { x: 2, y: 7 } };
    expect(collisionDistanceToWall(0, 0, 1, 0, SELF_RADIUS, shifted)).toBe(Infinity);
  });

  it("misses a parallel wall", () => {
    const parallel = { a: { x: 0, y: 1 }, b: { x: 5, y: 1 } };
    expect(collisionDistanceToWall(0, 0, 1, 0, SELF_RADIUS, parallel)).toBe(Infinity);
  });
});

describe("chooseHeuristicMotion", () => {
  it("walks straight at full desired speed on a free path", () => {
    const motion = chooseHeuristicMotion({
      x: 0,
      y: 0,
      radius: SELF_RADIUS,
      goalEx: 1,
      goalEy: 0,
      desiredSpeed: SPEED,
      neighbors: [],
      walls: [],
      params: PARAMS,
    });
    expect(motion.ex).toBeCloseTo(1, 6);
    expect(motion.ey).toBeCloseTo(0, 6);
    expect(motion.speed).toBeCloseTo(SPEED, 6);
    expect(motion.clearance).toBe(PARAMS.horizonM);
  });

  it("swerves (rightward on symmetric geometry) around a blocker dead ahead", () => {
    const motion = chooseHeuristicMotion({
      x: 0,
      y: 0,
      radius: SELF_RADIUS,
      goalEx: 1,
      goalEy: 0,
      desiredSpeed: SPEED,
      neighbors: [staticNeighbor(1, 0)],
      walls: [],
      params: PARAMS,
    });
    // Positive θ rotates toward the right normal (see rightNormal in
    // agents.ts): (1,0) → (cosθ, sinθ), so a rightward swerve has ey > 0.
    expect(motion.ey).toBeGreaterThan(0.1);
    expect(motion.clearance).toBeGreaterThan(1);
  });

  it("slides diagonally along a wide frontal wall instead of walking straight into it", () => {
    const nearWall = { a: { x: 0.5, y: -10 }, b: { x: 0.5, y: 10 } };
    const motion = chooseHeuristicMotion({
      x: 0,
      y: 0,
      radius: SELF_RADIUS,
      goalEx: 1,
      goalEy: 0,
      desiredSpeed: SPEED,
      neighbors: [],
      walls: [nearWall],
      params: PARAMS,
    });
    // Minimizing d(α) trades a little detour for more clearance: the agent
    // angles steeply along the wall (rightward under the tie-break bias)
    // rather than marching straight at it.
    expect(motion.ex).toBeGreaterThan(0);
    expect(motion.ey).toBeGreaterThan(0.5);
    expect(motion.clearance).toBeGreaterThan(0.3);
  });

  it("slows to stopping speed when every visible direction is blocked", () => {
    // Narrow vision field so all rays hit the wall at ~0.3 m of clearance.
    const narrow: VisionParams = { ...PARAMS, phiRad: (5 * Math.PI) / 180, rayCount: 3 };
    const nearWall = { a: { x: 0.5, y: -10 }, b: { x: 0.5, y: 10 } };
    const motion = chooseHeuristicMotion({
      x: 0,
      y: 0,
      radius: SELF_RADIUS,
      goalEx: 1,
      goalEy: 0,
      desiredSpeed: SPEED,
      neighbors: [],
      walls: [nearWall],
      params: narrow,
    });
    expect(motion.clearance).toBeLessThan(0.35);
    expect(motion.speed).toBeCloseTo(motion.clearance / narrow.tauS, 5);
    expect(motion.speed).toBeLessThan(0.75);
  });

  it("breaks a perfectly symmetric head-on encounter to the right", () => {
    const oncoming: VisionNeighbor = { x: 4, y: 0, vx: -SPEED, vy: 0, radius: 0.2 };
    const motion = chooseHeuristicMotion({
      x: 0,
      y: 0,
      radius: SELF_RADIUS,
      goalEx: 1,
      goalEy: 0,
      desiredSpeed: SPEED,
      neighbors: [oncoming],
      walls: [],
      params: PARAMS,
    });
    expect(motion.ey).toBeGreaterThan(0);
  });

  it("sidesteps at shuffle speed when in contact with the obstacle ahead", () => {
    const motion = chooseHeuristicMotion({
      x: 0,
      y: 0,
      radius: SELF_RADIUS,
      goalEx: 1,
      goalEy: 0,
      desiredSpeed: SPEED,
      neighbors: [staticNeighbor(0.35, 0)],
      walls: [],
      params: PARAMS,
    });
    // The whole ±75° vision field presses into the touching body, so the
    // widened yield scan takes over: slow shuffle away from the contact.
    expect(motion.speed).toBeGreaterThan(0);
    expect(motion.speed).toBeLessThanOrEqual(SPEED * 0.25);
    // Chosen direction must not press further into the neighbor ahead.
    expect(motion.ex).toBeLessThanOrEqual(0);
  });
});
