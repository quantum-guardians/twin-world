import type { NodeKind } from "./types";

export const KIND_COLOR: Record<NodeKind, string> = {
  normal: "#5b6270",
  entrance: "#3fa76b",
  exit: "#c95b5b",
  destination: "#c9a13f",
};

export const KIND_LABEL: Record<NodeKind, string> = {
  normal: "일반",
  entrance: "출입구",
  exit: "출구",
  destination: "목적지",
};
