import type { Point } from "../domain/corridors";
import { isPointInWalkableArea, type Corridor, type JunctionHub } from "../domain/corridors";
import { addAgent, type DesiredMotion, type SfmWorld } from "./socialForce";
import type { NodeKind, Venue, VenueNode } from "../domain/types";
import { edgeLength } from "../domain/venueGraph";
import {
  AGENT_LANE_OFFSET,
  AGENT_MAX_SPEED,
  AGENT_SPEED_VARIANCE_MAX,
  AGENT_SPEED_VARIANCE_MIN,
  ARRIVAL_RADIUS,
  STUCK_BOOST_MAX,
  STUCK_JITTER_MAX_RAD,
  STUCK_PATIENCE_TICKS,
  STUCK_RAMP_TICKS,
  STUCK_SOCIAL_FORCE_MIN,
} from "../domain/simPresets";

/**
 * Route-finding and per-tick steering, ported from simulation_react's
 * src/simulation/agents.ts (see docs/agent-movement.md). The physics
 * (stepSocialForce) is unchanged; what differs from the original is spawn
 * source/target selection, which there picked random *leaf* nodes (its
 * graph had no node typing) and here uses twin-world's typed nodes:
 * entrances spawn agents, destination/exit nodes are where they're headed
 * (plan FR-04/FR-05). continueArrivedAgents (give a new destination and
 * keep flowing) was intentionally not ported: the plan requires a finite
 * population per run so baseline vs. MR2S-optimized comparisons share
 * identical arrival conditions - an agent that arrives should stay
 * arrived, not keep re-touring indefinitely.
 */

function rotateDirection(ex: number, ey: number, theta: number): { ex: number; ey: number } {
  if (theta === 0) return { ex, ey };
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return { ex: ex * cos - ey * sin, ey: ex * sin + ey * cos };
}

/** Returns the next node shifted to the right of the directed path segment,
 * so opposing flows on the same edge get separate physical lanes. */
function rightLaneTarget(from: Point | undefined, to: Point): Point {
  if (!from) return to;
  const sx = to.x - from.x;
  const sy = to.y - from.y;
  const length = Math.hypot(sx, sy);
  if (length <= 1e-9) return to;
  return {
    x: to.x - (sy / length) * AGENT_LANE_OFFSET,
    y: to.y + (sx / length) * AGENT_LANE_OFFSET,
  };
}

function rightNormal(from: Point, to: Point): Point {
  const sx = to.x - from.x;
  const sy = to.y - from.y;
  const length = Math.hypot(sx, sy);
  if (length <= 1e-9) return { x: 0, y: 0 };
  return { x: -sy / length, y: sx / length };
}

export interface AdjacencyEntry {
  to: string;
  weight: number;
}

/** Builds directed pathfinding adjacency from a venue's edges: a
 * "forward"/"reverse" edge becomes one-way, "bidirectional" becomes both
 * directions. Weight is the edge's physical length in meters. */
export function buildAdjacency(venue: Venue): Map<string, AdjacencyEntry[]> {
  const adjacency = new Map<string, AdjacencyEntry[]>();
  for (const node of venue.nodes) adjacency.set(node.id, []);
  for (const edge of venue.edges) {
    const weight = Math.max(edgeLength(venue, edge), 1e-6);
    if (edge.direction !== "reverse") {
      adjacency.get(edge.fromNodeId)?.push({ to: edge.toNodeId, weight });
    }
    if (edge.direction !== "forward") {
      adjacency.get(edge.toNodeId)?.push({ to: edge.fromNodeId, weight });
    }
  }
  return adjacency;
}

/** Plain-array Dijkstra - fine at the node counts this app targets (tens to
 * low hundreds); returns null if startId/endId are disconnected. */
export function shortestPath(
  adjacency: Map<string, AdjacencyEntry[]>,
  startId: string,
  endId: string
): string[] | null {
  if (!adjacency.has(startId) || !adjacency.has(endId)) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const visited = new Set<string>();
  for (const id of adjacency.keys()) dist.set(id, Infinity);
  dist.set(startId, 0);

  for (;;) {
    let currentId: string | null = null;
    let currentDist = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < currentDist) {
        currentDist = d;
        currentId = id;
      }
    }
    if (currentId === null || currentId === endId) break;
    visited.add(currentId);

    for (const { to, weight } of adjacency.get(currentId) ?? []) {
      if (visited.has(to)) continue;
      const alt = currentDist + weight;
      if (alt < (dist.get(to) ?? Infinity)) {
        dist.set(to, alt);
        prev.set(to, currentId);
      }
    }
  }

  if ((dist.get(endId) ?? Infinity) === Infinity) return null;

  const path: string[] = [];
  let cur: string | undefined = endId;
  while (cur !== undefined) {
    path.unshift(cur);
    if (cur === startId) break;
    cur = prev.get(cur);
  }
  return path[0] === startId ? path : null;
}

function nodesOfKinds(venue: Venue, kinds: NodeKind[]): VenueNode[] {
  return venue.nodes.filter((n) => kinds.includes(n.kind));
}

/** Picks a spawn node (prefers "entrance") and a destination node (prefers
 * "destination"/"exit"), falling back to any node when a venue has none of
 * the preferred kind - e.g. a freshly started blank graph. */
export function pickSpawnTargetPair(
  venue: Venue,
  rng: () => number = Math.random
): [string, string] | null {
  const entrances = nodesOfKinds(venue, ["entrance"]);
  const targets = nodesOfKinds(venue, ["destination", "exit"]);
  const startPool = entrances.length > 0 ? entrances : venue.nodes;
  const targetPool = targets.length > 0 ? targets : venue.nodes;
  if (startPool.length === 0 || targetPool.length === 0) return null;

  const start = startPool[Math.floor(rng() * startPool.length)];
  let target = targetPool[Math.floor(rng() * targetPool.length)];
  let guard = 0;
  while (target.id === start.id && guard < 50) {
    target = targetPool[Math.floor(rng() * targetPool.length)];
    guard++;
  }
  return target.id === start.id ? null : [start.id, target.id];
}

export interface AgentRuntimeState {
  id: string;
  waypoints: Point[];
  waypointIndex: number;
  startNodeId: string;
  targetNodeId: string;
  state: "moving" | "arrived" | "dead";
  /** Multiplier on the base max speed, fixed for this agent's lifetime. */
  speedFactor?: number;
  /** Accumulated ticks without meaningful progress toward the waypoint. */
  stuckTicks?: number;
  /** Distance to the current waypoint on the previous fixed tick. */
  lastWaypointDistance?: number;
  /** Current normalized crowd-compression estimate. */
  pressure?: number;
  /** Consecutive-equivalent physics ticks spent above fatal pressure. */
  highPressureTicks?: number;
}

export interface SpawnAgentDeps {
  world: SfmWorld;
  venue: Venue;
  adjacency: Map<string, AdjacencyEntry[]>;
  rng?: () => number;
  lastValidPositions?: Map<string, Point>;
}

const MAX_SPAWN_PAIR_ATTEMPTS = 30;
const SPAWN_FORWARD_SPREAD_M = 0.5;
const SPAWN_LATERAL_JITTER_M = 0.05;

export function spawnAgent(id: string, deps: SpawnAgentDeps): AgentRuntimeState | null {
  const { world, venue, adjacency, rng = Math.random } = deps;
  const nodePositions = new Map(venue.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

  let start: string | undefined;
  let target: string | undefined;
  let path: string[] | null = null;
  for (let attempt = 0; attempt < MAX_SPAWN_PAIR_ATTEMPTS; attempt++) {
    const pair = pickSpawnTargetPair(venue, rng);
    if (!pair) return null;
    path = shortestPath(adjacency, pair[0], pair[1]);
    if (path) {
      [start, target] = pair;
      break;
    }
  }
  if (!path || !start || !target) return null;

  const waypoints = path.map((nodeId) => nodePositions.get(nodeId)).filter((p): p is Point => p !== undefined);
  if (waypoints.length === 0) return null;

  const secondWaypoint = waypoints[1];
  const normal = secondWaypoint ? rightNormal(waypoints[0], secondWaypoint) : { x: 0, y: 0 };
  const segmentLength = secondWaypoint
    ? Math.hypot(secondWaypoint.x - waypoints[0].x, secondWaypoint.y - waypoints[0].y)
    : 0;
  const forward = secondWaypoint
    ? {
        x: (secondWaypoint.x - waypoints[0].x) / Math.max(segmentLength, 1e-9),
        y: (secondWaypoint.y - waypoints[0].y) / Math.max(segmentLength, 1e-9),
      }
    : { x: 0, y: 0 };
  const forwardDistance = rng() * Math.min(SPAWN_FORWARD_SPREAD_M, segmentLength * 0.2);
  const lateralDistance = AGENT_LANE_OFFSET + (rng() * 2 - 1) * SPAWN_LATERAL_JITTER_M;
  const startPos: Point = {
    x: waypoints[0].x + forward.x * forwardDistance + normal.x * lateralDistance,
    y: waypoints[0].y + forward.y * forwardDistance + normal.y * lateralDistance,
  };
  addAgent(world, id, startPos.x, startPos.y);
  deps.lastValidPositions?.set(id, { x: startPos.x, y: startPos.y });

  const speedFactor = AGENT_SPEED_VARIANCE_MIN + rng() * (AGENT_SPEED_VARIANCE_MAX - AGENT_SPEED_VARIANCE_MIN);

  return {
    id,
    waypoints,
    waypointIndex: Math.min(1, waypoints.length - 1),
    startNodeId: start,
    targetNodeId: target,
    state: waypoints.length > 1 ? "moving" : "arrived",
    speedFactor,
  };
}

/**
 * Computes each moving agent's desired direction + speed toward its current
 * waypoint, advancing waypoints and arrival state as a side effect. Call
 * once per fixed physics tick, in the same accumulator loop as
 * stepSocialForce - checking arrival only at render cadence lets a slow
 * frame overshoot several ticks past a waypoint, which reads as the agent
 * doubling back.
 */
export function computeDesiredDirections(
  agents: AgentRuntimeState[],
  world: SfmWorld,
  maxSpeed: number = AGENT_MAX_SPEED,
  arrivalRadius: number = ARRIVAL_RADIUS
): Map<string, DesiredMotion> {
  const desired = new Map<string, DesiredMotion>();

  for (const agent of agents) {
    if (agent.state !== "moving") continue;
    const sfmAgent = world.agents.get(agent.id);
    if (!sfmAgent) continue;

    const waypoint = agent.waypoints[agent.waypointIndex];
    if (!waypoint) {
      agent.state = "arrived";
      continue;
    }

    const baseSpeed = maxSpeed * (agent.speedFactor ?? 1);

    let previousWaypoint = agent.waypoints[agent.waypointIndex - 1];
    let laneTarget = rightLaneTarget(previousWaypoint, waypoint);
    let dx = laneTarget.x - sfmAgent.position.x;
    let dy = laneTarget.y - sfmAgent.position.y;
    let dist = Math.hypot(dx, dy);

    const passedWaypoint =
      previousWaypoint !== undefined &&
      (sfmAgent.position.x - waypoint.x) * (waypoint.x - previousWaypoint.x) +
        (sfmAgent.position.y - waypoint.y) * (waypoint.y - previousWaypoint.y) >=
        0;

    if (dist < arrivalRadius || passedWaypoint) {
      if (agent.waypointIndex >= agent.waypoints.length - 1) {
        agent.state = "arrived";
        continue;
      }
      agent.waypointIndex += 1;
      agent.lastWaypointDistance = undefined;
      const next = agent.waypoints[agent.waypointIndex];
      previousWaypoint = agent.waypoints[agent.waypointIndex - 1];
      laneTarget = rightLaneTarget(previousWaypoint, next);
      dx = laneTarget.x - sfmAgent.position.x;
      dy = laneTarget.y - sfmAgent.position.y;
      dist = Math.hypot(dx, dy);
      if (dist <= 1e-9) continue;
    }

    const goalEx = dx / dist;
    const goalEy = dy / dist;

    const expectedProgressPerTick = baseSpeed / 60;
    const actualProgress =
      agent.lastWaypointDistance === undefined ? expectedProgressPerTick : agent.lastWaypointDistance - dist;
    agent.lastWaypointDistance = dist;
    const isMakingProgress = actualProgress >= expectedProgressPerTick * 0.1;
    agent.stuckTicks = isMakingProgress ? Math.max(0, (agent.stuckTicks ?? 0) - 4) : (agent.stuckTicks ?? 0) + 1;
    const ticksPastPatience = Math.max(0, agent.stuckTicks - STUCK_PATIENCE_TICKS);
    const impatience = Math.min(1, ticksPastPatience / STUCK_RAMP_TICKS);
    const speed = baseSpeed * (1 + impatience * STUCK_BOOST_MAX);
    const socialScale = 1 - impatience * (1 - STUCK_SOCIAL_FORCE_MIN);

    const theta = impatience * STUCK_JITTER_MAX_RAD;

    desired.set(agent.id, {
      ...rotateDirection(goalEx, goalEy, theta),
      speed,
      socialScale,
      minForwardSpeed: baseSpeed * (0.4 + impatience * 0.4),
    });
  }

  return desired;
}

/** Keeps Social Force lateral motion near the current directed lane without
 * rewinding longitudinal progress. */
export function constrainAgentsToRoutes(
  agents: AgentRuntimeState[],
  world: SfmWorld,
  maxLateralDistance = 0.4
): void {
  for (const agent of agents) {
    if (agent.state !== "moving") continue;
    const body = world.agents.get(agent.id);
    const from = agent.waypoints[agent.waypointIndex - 1];
    const to = agent.waypoints[agent.waypointIndex];
    if (!body || !from || !to) continue;

    const normal = rightNormal(from, to);
    const laneStart = { x: from.x + normal.x * AGENT_LANE_OFFSET, y: from.y + normal.y * AGENT_LANE_OFFSET };
    const laneEnd = { x: to.x + normal.x * AGENT_LANE_OFFSET, y: to.y + normal.y * AGENT_LANE_OFFSET };
    const sx = laneEnd.x - laneStart.x;
    const sy = laneEnd.y - laneStart.y;
    const lengthSq = sx * sx + sy * sy;
    if (lengthSq <= 1e-9) continue;
    const t = Math.max(
      0,
      Math.min(1, ((body.position.x - laneStart.x) * sx + (body.position.y - laneStart.y) * sy) / lengthSq)
    );
    const nearest = { x: laneStart.x + sx * t, y: laneStart.y + sy * t };
    const dx = body.position.x - nearest.x;
    const dy = body.position.y - nearest.y;
    const lateralDistance = Math.hypot(dx, dy);
    if (lateralDistance <= maxLateralDistance) continue;
    const scale = maxLateralDistance / lateralDistance;
    body.position.x = nearest.x + dx * scale;
    body.position.y = nearest.y + dy * scale;
  }
}

const CONTAINMENT_TOLERANCE = 0.1;

/**
 * Hard "never visibly tunnel" guarantee: any agent whose center has ended
 * up outside the walkable floor is snapped back to the last position where
 * it was inside, with velocity zeroed. Call once per fixed tick, after
 * stepSocialForce.
 */
export function enforceContainment(
  world: SfmWorld,
  corridors: Corridor[],
  hubs: JunctionHub[],
  lastValidPositions: Map<string, Point>
): void {
  for (const [id, agent] of world.agents) {
    if (isPointInWalkableArea(agent.position, corridors, hubs, CONTAINMENT_TOLERANCE)) {
      lastValidPositions.set(id, { x: agent.position.x, y: agent.position.y });
      continue;
    }
    const lastValid = lastValidPositions.get(id);
    if (!lastValid) continue;
    agent.position.x = lastValid.x;
    agent.position.y = lastValid.y;
    agent.velocity.x = 0;
    agent.velocity.y = 0;
  }
}
