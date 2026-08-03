import type { Venue } from "./types";

export interface Point {
  x: number;
  y: number;
}

/** A street strip generated from one graph edge: a rectangle `width` wide
 * running from `a` to `b`, shortened at both ends so it stops at the rim of
 * each endpoint's junction hub instead of overlapping it. Ported from
 * simulation_react's src/simulation/corridors.ts and adapted to the
 * twin-world Venue model - there `width` came from an edge weight via
 * computeCorridorWidth, here the user authors it directly in meters. */
export interface Corridor {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  width: number;
  /** Endpoints shortened to sit just outside each node's junction hub. */
  a: Point;
  b: Point;
  /** Original (unshortened) node centers. */
  fullA: Point;
  fullB: Point;
  length: number;
  angle: number;
}

export interface JunctionHub {
  nodeId: string;
  center: Point;
  radius: number;
}

export interface BuildCorridorsResult {
  corridors: Corridor[];
  hubs: JunctionHub[];
}

const HUB_PADDING = 0.3; // meters

/** Turns a Venue's nodes/edges into a corridor floor plan: each edge becomes
 * a rectangular street strip, and each node becomes a "hub" disk sized to
 * the widest incident street so strips never leave a visible gap where they
 * meet a junction. */
export function buildCorridors(venue: Venue): BuildCorridorsResult {
  const positionById = new Map(venue.nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

  const maxHalfWidthByNode = new Map<string, number>();
  for (const edge of venue.edges) {
    const halfWidth = edge.width / 2;
    maxHalfWidthByNode.set(
      edge.fromNodeId,
      Math.max(maxHalfWidthByNode.get(edge.fromNodeId) ?? 0, halfWidth)
    );
    maxHalfWidthByNode.set(
      edge.toNodeId,
      Math.max(maxHalfWidthByNode.get(edge.toNodeId) ?? 0, halfWidth)
    );
  }

  const hubs: JunctionHub[] = [];
  for (const [nodeId, halfWidth] of maxHalfWidthByNode) {
    const center = positionById.get(nodeId);
    if (!center) continue;
    hubs.push({ nodeId, center, radius: halfWidth + HUB_PADDING });
  }
  const hubByNode = new Map(hubs.map((h) => [h.nodeId, h]));

  const corridors: Corridor[] = [];
  for (const edge of venue.edges) {
    const fullA = positionById.get(edge.fromNodeId);
    const fullB = positionById.get(edge.toNodeId);
    if (!fullA || !fullB) continue;

    const dx = fullB.x - fullA.x;
    const dy = fullB.y - fullA.y;
    const fullLength = Math.hypot(dx, dy) || 1e-6;
    const angle = Math.atan2(dy, dx);
    const ux = dx / fullLength;
    const uy = dy / fullLength;

    const radiusA = hubByNode.get(edge.fromNodeId)?.radius ?? 0;
    const radiusB = hubByNode.get(edge.toNodeId)?.radius ?? 0;
    const shortenedLength = Math.max(fullLength - radiusA - radiusB, 0);

    const a: Point = { x: fullA.x + ux * radiusA, y: fullA.y + uy * radiusA };
    const b: Point = { x: fullB.x - ux * radiusB, y: fullB.y - uy * radiusB };

    corridors.push({
      id: edge.id,
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      width: edge.width,
      a,
      b,
      fullA,
      fullB,
      length: shortenedLength,
      angle,
    });
  }

  return { corridors, hubs };
}

/** True if `point` lies inside the corridor's (rotated) floor rectangle,
 * optionally inflated by `tolerance` on every side. */
export function pointInCorridor(point: Point, corridor: Corridor, tolerance = 0): boolean {
  const dx = point.x - corridor.a.x;
  const dy = point.y - corridor.a.y;
  const cos = Math.cos(-corridor.angle);
  const sin = Math.sin(-corridor.angle);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  return (
    localX >= -tolerance &&
    localX <= corridor.length + tolerance &&
    Math.abs(localY) <= corridor.width / 2 + tolerance
  );
}

/** True if `point` lies inside the corridor's full node-center-to-node-center
 * rectangle (not shortened at hub rims). Walkability must use this variant:
 * the shortened rectangle leaves unwalkable wedge gaps between a hub disk's
 * rim and the rectangle's corners, and an agent walking wide of the
 * centerline gets containment-pinned there forever. */
export function pointInFullCorridor(point: Point, corridor: Corridor, tolerance = 0): boolean {
  const dx = point.x - corridor.fullA.x;
  const dy = point.y - corridor.fullA.y;
  const cos = Math.cos(-corridor.angle);
  const sin = Math.sin(-corridor.angle);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;
  const fullLength = Math.hypot(corridor.fullB.x - corridor.fullA.x, corridor.fullB.y - corridor.fullA.y);
  return (
    localX >= -tolerance &&
    localX <= fullLength + tolerance &&
    Math.abs(localY) <= corridor.width / 2 + tolerance
  );
}

/** True if `point` is on the walkable floor: inside any corridor rectangle
 * or any hub disk (inflated by `tolerance`). */
export function isPointInWalkableArea(
  point: Point,
  corridors: Corridor[],
  hubs: JunctionHub[],
  tolerance = 0
): boolean {
  for (const hub of hubs) {
    if (Math.hypot(point.x - hub.center.x, point.y - hub.center.y) <= hub.radius + tolerance) {
      return true;
    }
  }
  for (const corridor of corridors) {
    if (pointInFullCorridor(point, corridor, tolerance)) return true;
  }
  return false;
}

/** A wall as a bare line segment, for the social-force wall repulsion. */
export interface WallSegment {
  a: Point;
  b: Point;
}

/**
 * Flattens the corridor floor plan into two side-wall segments per
 * corridor (offset +-width/2 along the perpendicular). Ported from
 * simulation_react's corridors.ts, but deliberately omits that file's hub
 * rim wall tessellation: its own comment in socialForce.ts explains hub
 * rim chords create collision wedges that can pin a pressured agent, and
 * the hard walkable-area containment pass (enforceContainment) already
 * stops agents from escaping through a hub disk, so runtime physics only
 * ever needs the corridor side walls.
 */
export function buildWallSegments(corridors: Corridor[]): WallSegment[] {
  const segments: WallSegment[] = [];

  for (const corridor of corridors) {
    if (corridor.length <= 0) continue;
    const halfWidth = corridor.width / 2;
    const perpX = -Math.sin(corridor.angle);
    const perpY = Math.cos(corridor.angle);
    for (const side of [1, -1]) {
      segments.push({
        a: { x: corridor.a.x + perpX * halfWidth * side, y: corridor.a.y + perpY * halfWidth * side },
        b: { x: corridor.b.x + perpX * halfWidth * side, y: corridor.b.y + perpY * halfWidth * side },
      });
    }
  }

  return segments;
}
