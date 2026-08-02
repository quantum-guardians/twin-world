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
        {error && <span className="graph-toolbar-error">{error}</span>}
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
