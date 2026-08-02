import type { Venue } from "./types";
import { applyOptimizedDirections, edgeLength } from "./venueGraph";
import type { Mr2sRequest, Mr2sResponse } from "../api/mr2sClient";

/**
 * MR2S's API takes integer vertex ids and doesn't know about node
 * coordinates (see docs/API.md / BACKEND_REFERENCE.md: "MR2S API는 정점
 * 좌표를 받지 않는다" - plan's technical constraints). twin-world's node
 * ids are strings ("n1", ...), so this mapping is the only place the two
 * id spaces meet; build one right before a request and reuse it to
 * translate the response back.
 */
export interface VertexMapping {
  idToVertex: Map<string, number>;
  vertexToId: Map<number, string>;
}

export function buildVertexMapping(venue: Venue): VertexMapping {
  const idToVertex = new Map<string, number>();
  const vertexToId = new Map<number, string>();
  venue.nodes.forEach((node, index) => {
    const vertex = index + 1;
    idToVertex.set(node.id, vertex);
    vertexToId.set(vertex, node.id);
  });
  return { idToVertex, vertexToId };
}

/** Edge.length (meters) rounded to the nearest integer >= 1, per plan:
 * "Edge.length 또는 합의된 이동 비용을 정수 weight로 변환해 전달한다." */
export function buildMr2sRequest(venue: Venue, mapping: VertexMapping): Mr2sRequest {
  return {
    edges: venue.edges.map((edge) => ({
      vertices: [mapping.idToVertex.get(edge.fromNodeId)!, mapping.idToVertex.get(edge.toNodeId)!] as [
        number,
        number,
      ],
      weight: Math.max(1, Math.round(edgeLength(venue, edge))),
    })),
  };
}

/** Applies an MR2S response's directions back onto the venue that
 * generated the request. Throws if the response references a vertex id
 * the mapping never issued - that would mean the request/response pair
 * don't actually match, which should never happen but must not silently
 * produce a corrupted venue if it somehow does. */
export function applyMr2sResponse(venue: Venue, response: Mr2sResponse, mapping: VertexMapping): Venue {
  const pairs = response.edges.map((edge) => {
    const fromNodeId = mapping.vertexToId.get(edge._from);
    const toNodeId = mapping.vertexToId.get(edge.to);
    if (!fromNodeId || !toNodeId) {
      throw new Error(`MR2S response referenced unknown vertex ${edge._from}->${edge.to}`);
    }
    return { fromNodeId, toNodeId };
  });
  return applyOptimizedDirections(venue, pairs);
}

/** -1 signals the optimized directed graph isn't strongly connected (see
 * BACKEND_REFERENCE.md: "-1은 오류가 아니라 연결 불가 의미"). Not thrown as
 * an error - the caller still gets a usable direction set, just with a
 * warning to surface, since MR2S's own APSP scoring failing doesn't mean
 * the directions are unusable for this app's purposes. */
export function isDisconnectedScore(score: number): boolean {
  return score === -1;
}
