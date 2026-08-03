import type { NodeKind } from "./types";

/** Node kind colors, shared by the graph editor's chips and the 3D markers.
 * Chosen to hold contrast on the light surfaces of both. */
export const KIND_COLOR: Record<NodeKind, string> = {
  normal: "#6b7480",
  entrance: "#0f9d63",
  exit: "#d93a30",
  destination: "#e0a013",
};

export const KIND_LABEL: Record<NodeKind, string> = {
  normal: "일반",
  entrance: "출입구",
  exit: "출구",
  destination: "목적지",
};
