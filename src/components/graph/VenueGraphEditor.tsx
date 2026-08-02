import { useCallback, useEffect, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type EdgeMouseHandler,
  type NodeChange,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Venue } from "../../domain/types";
import {
  decorateEdgesForRender,
  decorateNodesForRender,
  deriveVenue,
  initialFlowEdges,
  initialFlowNodes,
  type VenueFlowEdge,
  type VenueFlowNode,
} from "../../graph/toFlowElements";
import { venueNodeTypes } from "./VenueNode";
import { NodeInspector } from "./NodeInspector";
import { EdgeInspector } from "./EdgeInspector";
import { applyMr2sResponse, buildMr2sRequest, buildVertexMapping, isDisconnectedScore } from "../../domain/mr2sAdapter";
import { optimizeMr2s } from "../../api/mr2sClient";

export interface VenueGraphEditorProps {
  venue: Venue;
  onChange: (venue: Venue) => void;
  onExport: () => void;
}

function nextEdgeId(edges: VenueFlowEdge[]): string {
  let candidate = edges.length + 1;
  while (edges.some((e) => e.id === `e${candidate}`)) candidate += 1;
  return `e${candidate}`;
}

function GraphCanvas({ venue, onChange, onExport }: VenueGraphEditorProps) {
  const { screenToFlowPosition } = useReactFlow();
  // xyflow owns this state so it can attach measured dimensions to each
  // node; rebuilding the array from `venue` every render (as an earlier
  // version did) dropped those measurements and broke drag/connect
  // (React Flow error #015, "trying to drag a node that is not
  // initialized"). `venue` is only the initial seed here - see the
  // useEffect below for how edits flow back up to the parent.
  const [flowNodes, setFlowNodes] = useState<VenueFlowNode[]>(() => initialFlowNodes(venue));
  const [flowEdges, setFlowEdges] = useState<VenueFlowEdge[]>(() => initialFlowEdges(venue));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [addNodeMode, setAddNodeMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mr2sLoading, setMr2sLoading] = useState(false);
  const [mr2sMessage, setMr2sMessage] = useState<string | null>(null);
  const [mr2sScores, setMr2sScores] = useState<{ optimized: number; bidirectional: number } | null>(null);

  useEffect(() => {
    onChange(deriveVenue(venue, flowNodes, flowEdges));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowNodes, flowEdges]);

  const onNodesChange = useCallback((changes: NodeChange<VenueFlowNode>[]) => {
    setFlowNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange<VenueFlowEdge>[]) => {
    setFlowEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    const { source, target } = connection;
    if (!source || !target) return;
    if (source === target) {
      setError("edge endpoints must be different nodes");
      return;
    }
    setError(null);
    setFlowEdges((eds) => {
      const duplicate = eds.some(
        (e) => (e.source === source && e.target === target) || (e.source === target && e.target === source)
      );
      if (duplicate) {
        setError("an edge already connects these two nodes");
        return eds;
      }
      const newEdge: VenueFlowEdge = {
        id: nextEdgeId(eds),
        source,
        target,
        data: { width: 8, direction: "bidirectional" },
      };
      return [...eds, newEdge];
    });
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    setSelectedEdgeId(null);
    setSelectedNodeId(node.id);
  }, []);

  const onEdgeClick: EdgeMouseHandler = useCallback((_evt, edge) => {
    setSelectedNodeId(null);
    setSelectedEdgeId(edge.id);
  }, []);

  const onPaneClick = useCallback(
    (evt: React.MouseEvent) => {
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      if (!addNodeMode) return;
      const position = screenToFlowPosition({ x: evt.clientX, y: evt.clientY });
      setFlowNodes((nds) => [
        ...nds,
        {
          id: `n${Date.now().toString(36)}`,
          type: "venueNode",
          position,
          data: { kind: "normal", label: "새 노드", selected: false },
        },
      ]);
      setAddNodeMode(false);
    },
    [addNodeMode, screenToFlowPosition]
  );

  const handleOptimize = useCallback(async () => {
    setMr2sLoading(true);
    setMr2sMessage(null);
    setMr2sScores(null);
    try {
      const currentVenue = deriveVenue(venue, flowNodes, flowEdges);
      if (currentVenue.edges.length === 0) {
        throw new Error("최적화할 간선이 없습니다. 먼저 그래프를 그려주세요.");
      }
      const mapping = buildVertexMapping(currentVenue);
      const request = buildMr2sRequest(currentVenue, mapping);
      const response = await optimizeMr2s(request);
      const optimizedVenue = applyMr2sResponse(currentVenue, response, mapping);

      setFlowEdges((eds) =>
        eds.map((e) => {
          const match = optimizedVenue.edges.find((oe) => oe.id === e.id);
          return match ? { ...e, data: { ...e.data!, direction: match.direction } } : e;
        })
      );
      setMr2sScores({ optimized: response.optimized_graph_score, bidirectional: response.bidirectional_graph_score });
      if (isDisconnectedScore(response.optimized_graph_score)) {
        setMr2sMessage("최적화 결과가 강연결이 아닙니다 - 일부 구간이 서로 도달 불가능할 수 있습니다.");
      }
    } catch (err) {
      setMr2sMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setMr2sLoading(false);
    }
  }, [venue, flowNodes, flowEdges]);

  const selectedNode = flowNodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedEdge = flowEdges.find((e) => e.id === selectedEdgeId) ?? null;
  const selectedEdgeNodes = selectedEdge
    ? {
        from: flowNodes.find((n) => n.id === selectedEdge.source),
        to: flowNodes.find((n) => n.id === selectedEdge.target),
      }
    : null;
  const selectedEdgeLength =
    selectedEdgeNodes?.from && selectedEdgeNodes?.to
      ? Math.hypot(
          selectedEdgeNodes.to.position.x - selectedEdgeNodes.from.position.x,
          selectedEdgeNodes.to.position.y - selectedEdgeNodes.from.position.y
        ) * venue.scaleMetersPerUnit
      : 0;

  return (
    <div className="graph-editor">
      <div className="graph-toolbar">
        <button
          type="button"
          className={addNodeMode ? "toggle-button active" : "toggle-button"}
          onClick={() => setAddNodeMode((v) => !v)}
        >
          {addNodeMode ? "노드 배치 모드 (캔버스 클릭)" : "+ 노드 추가"}
        </button>
        <span className="graph-toolbar-hint">간선 연결: 노드 가장자리를 드래그해 다른 노드에 연결</span>
        <button type="button" className="toggle-button" onClick={onExport}>
          JSON 내보내기
        </button>
        <button type="button" className="toggle-button" onClick={handleOptimize} disabled={mr2sLoading}>
          {mr2sLoading ? "MR2S 최적화 중..." : "MR2S 일방통행 최적화"}
        </button>
        {mr2sScores && (
          <span className="graph-toolbar-hint">
            APSP {mr2sScores.bidirectional.toFixed(0)} → {isDisconnectedScore(mr2sScores.optimized) ? "연결 불가" : mr2sScores.optimized.toFixed(0)}
          </span>
        )}
        {error && <span className="graph-toolbar-error">{error}</span>}
        {mr2sMessage && <span className="graph-toolbar-error">{mr2sMessage}</span>}
      </div>
      <div className="graph-canvas-row">
        <div className="graph-canvas">
          <ReactFlow
            nodes={decorateNodesForRender(flowNodes, selectedNodeId)}
            edges={decorateEdgesForRender(flowNodes, flowEdges, selectedEdgeId)}
            nodeTypes={venueNodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onPaneClick={onPaneClick}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
        </div>
        <aside className="graph-sidebar">
          {selectedNode && (
            <NodeInspector
              node={{
                id: selectedNode.id,
                x: selectedNode.position.x,
                y: selectedNode.position.y,
                kind: selectedNode.data.kind,
                label: selectedNode.data.label,
              }}
              onChangeKind={(kind) =>
                setFlowNodes((nds) =>
                  nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, kind } } : n))
                )
              }
              onChangeLabel={(label) =>
                setFlowNodes((nds) =>
                  nds.map((n) => (n.id === selectedNode.id ? { ...n, data: { ...n.data, label } } : n))
                )
              }
              onDelete={() => {
                setFlowNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                setFlowEdges((eds) =>
                  eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id)
                );
                setSelectedNodeId(null);
              }}
            />
          )}
          {selectedEdge && (
            <EdgeInspector
              edge={{
                id: selectedEdge.id,
                fromNodeId: selectedEdge.source,
                toNodeId: selectedEdge.target,
                width: selectedEdge.data!.width,
                direction: selectedEdge.data!.direction,
              }}
              lengthMeters={selectedEdgeLength}
              onChangeWidth={(width) =>
                setFlowEdges((eds) =>
                  eds.map((e) => (e.id === selectedEdge.id ? { ...e, data: { ...e.data!, width } } : e))
                )
              }
              onChangeDirection={(direction) =>
                setFlowEdges((eds) =>
                  eds.map((e) => (e.id === selectedEdge.id ? { ...e, data: { ...e.data!, direction } } : e))
                )
              }
              onDelete={() => {
                setFlowEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
                setSelectedEdgeId(null);
              }}
            />
          )}
          {!selectedNode && !selectedEdge && (
            <div className="inspector-panel inspector-empty">
              <p>노드나 간선을 선택하면 속성을 편집할 수 있습니다.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export function VenueGraphEditor(props: VenueGraphEditorProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
