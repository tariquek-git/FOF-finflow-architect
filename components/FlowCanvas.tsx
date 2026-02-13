import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DrawingPath,
  Edge,
  EntityType,
  Node,
  OverlayMode,
  Position,
  ViewportTransform
} from '../types';
import DiagramNodeCard from './canvas/DiagramNodeCard';
import DiagramEdgePath from './canvas/DiagramEdgePath';
import CanvasOverlays from './canvas/CanvasOverlays';
import MiniMapPanel from './canvas/MiniMapPanel';
import { GRID_SIZE, MAX_ZOOM, MIN_ZOOM } from './canvas/canvasConstants';
import {
  SWIMLANE_HEIGHT,
  getClosestPortToPoint,
  getNodeDimensions,
  getPortPosition
} from './canvas/canvasGeometry';

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  drawings: DrawingPath[];
  selectedNodeIds: string[];
  selectedEdgeId: string | null;
  onSelectNodes: (ids: string[]) => void;
  onSelectEdge: (id: string | null) => void;
  onUpdateNodePosition: (id: string, pos: Position) => void;
  onBeginNodeMove: (ids: string[]) => void;
  onConnect: (sourceId: string, targetId: string, spIdx: number, tpIdx: number) => void;
  onAddNode: (type: EntityType, pos?: Position) => void;
  isDarkMode: boolean;
  showPorts: boolean;
  snapToGrid: boolean;
  activeTool: 'select' | 'draw' | 'text';
  onAddDrawing: (drawing: DrawingPath) => void;
  onOpenInspector: () => void;
  viewport: ViewportTransform;
  onViewportChange: (viewport: ViewportTransform) => void;
  onPointerWorldChange?: (position: Position | null) => void;
  showSwimlanes: boolean;
  swimlaneLabels: string[];
  gridMode: 'none' | 'lines' | 'dots';
  overlayMode: OverlayMode;
  showMinimap: boolean;
  exportLayerRef?: React.RefObject<HTMLDivElement | null>;
}

const AUTOSCROLL_EDGE_THRESHOLD = 40;
const AUTOSCROLL_MAX_SPEED = 16;

type PendingConnection = { nodeId: string; portIdx: number };
type PendingConnectionResolution = {
  nextPending: PendingConnection | null;
  edgeToCreate?: { sourceId: string; targetId: string; sourcePortIdx: number; targetPortIdx: number };
};

const isEditableTarget = (target: EventTarget | null): target is HTMLElement => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tagName = target.tagName;
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};

const resolvePendingConnectionFromNodeClick = (
  nodes: Node[],
  pendingConnection: PendingConnection | null,
  nodeId: string,
  clickWorld: Position
): PendingConnectionResolution => {
  const clickedNode = nodes.find((candidate) => candidate.id === nodeId);
  if (!clickedNode) return { nextPending: null };

  if (!pendingConnection) {
    return {
      nextPending: { nodeId, portIdx: getClosestPortToPoint(clickedNode, clickWorld) }
    };
  }

  if (pendingConnection.nodeId === nodeId) {
    return { nextPending: null };
  }

  const sourceNode = nodes.find((candidate) => candidate.id === pendingConnection.nodeId);
  if (!sourceNode) {
    return { nextPending: null };
  }

  const sourcePortIdx = pendingConnection.portIdx;
  const sourcePortPosition = getPortPosition(sourceNode, sourcePortIdx);
  const targetPortIdx = getClosestPortToPoint(clickedNode, sourcePortPosition);

  return {
    nextPending: null,
    edgeToCreate: {
      sourceId: sourceNode.id,
      targetId: clickedNode.id,
      sourcePortIdx,
      targetPortIdx
    }
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes,
  edges,
  drawings,
  selectedNodeIds,
  selectedEdgeId,
  onSelectNodes,
  onSelectEdge,
  onUpdateNodePosition,
  onBeginNodeMove,
  onConnect,
  onAddNode,
  isDarkMode,
  showPorts,
  snapToGrid,
  activeTool,
  onAddDrawing,
  onOpenInspector,
  viewport,
  onViewportChange,
  onPointerWorldChange,
  showSwimlanes,
  swimlaneLabels,
  gridMode,
  overlayMode,
  showMinimap,
  exportLayerRef
}) => {
  const [draggingNodes, setDraggingNodes] = useState<{
    ids: string[];
    pointerStart: Position;
    initialPositions: Record<string, Position>;
  } | null>(null);
  const [hasRecordedDragHistory, setHasRecordedDragHistory] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [selectionMarquee, setSelectionMarquee] = useState<{
    start: Position;
    current: Position;
    baseSelection: string[];
  } | null>(null);
  const [snapGuide, setSnapGuide] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [panningState, setPanningState] = useState<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [pointerWorld, setPointerWorld] = useState<Position | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef(viewport);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    if (!containerRef.current) return;

    const element = containerRef.current;
    const updateSize = () => {
      setCanvasSize({ width: element.clientWidth, height: element.clientHeight });
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - viewportRef.current.x) / viewportRef.current.zoom,
      y: (clientY - rect.top - viewportRef.current.y) / viewportRef.current.zoom
    };
  }, []);

  const nodeById = useMemo(() => {
    const map = new Map<string, Node>();
    for (const node of nodes) {
      map.set(node.id, node);
    }
    return map;
  }, [nodes]);

  const edgeGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const edge of edges) {
      const key = [edge.sourceId, edge.targetId].sort().join('-');
      if (!groups[key]) groups[key] = [];
      groups[key].push(edge.id);
    }
    return groups;
  }, [edges]);

  const activeConnectorHandleIds = useMemo(() => {
    if (!selectedEdgeId) return [];
    const selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
    if (!selectedEdge) return [];

    return [selectedEdge.sourceId, selectedEdge.targetId].filter((nodeId) => {
      const node = nodeById.get(nodeId);
      return !!node?.isConnectorHandle;
    });
  }, [selectedEdgeId, edges, nodeById]);

  const presentableNodes = useMemo(
    () => nodes.filter((node) => !node.isConnectorHandle || activeConnectorHandleIds.includes(node.id)),
    [nodes, activeConnectorHandleIds]
  );

  const worldViewportBounds = useMemo(() => {
    const width = canvasSize.width || 1;
    const height = canvasSize.height || 1;
    const zoom = viewport.zoom || 1;
    const padding = 220;

    const left = -viewport.x / zoom;
    const top = -viewport.y / zoom;
    const right = left + width / zoom;
    const bottom = top + height / zoom;

    return {
      minX: left - padding,
      minY: top - padding,
      maxX: right + padding,
      maxY: bottom + padding
    };
  }, [canvasSize.height, canvasSize.width, viewport.x, viewport.y, viewport.zoom]);

  const visibleNodeIds = useMemo(() => {
    const visibleIds = new Set<string>();

    for (const node of presentableNodes) {
      const { width, height } = getNodeDimensions(node);
      const intersects = !(
        node.position.x + width < worldViewportBounds.minX ||
        node.position.x > worldViewportBounds.maxX ||
        node.position.y + height < worldViewportBounds.minY ||
        node.position.y > worldViewportBounds.maxY
      );

      if (intersects || selectedNodeIds.includes(node.id) || pendingConnection?.nodeId === node.id) {
        visibleIds.add(node.id);
      }
    }

    return visibleIds;
  }, [pendingConnection?.nodeId, presentableNodes, selectedNodeIds, worldViewportBounds.maxX, worldViewportBounds.maxY, worldViewportBounds.minX, worldViewportBounds.minY]);

  const renderedNodes = useMemo(
    () => presentableNodes.filter((node) => visibleNodeIds.has(node.id)),
    [presentableNodes, visibleNodeIds]
  );

  const renderedEdges = useMemo(
    () =>
      edges.filter((edge) => {
        if (selectedEdgeId === edge.id) return true;
        const sourceNode = nodeById.get(edge.sourceId);
        const targetNode = nodeById.get(edge.targetId);
        if (sourceNode?.isConnectorHandle || targetNode?.isConnectorHandle) {
          return true;
        }
        return visibleNodeIds.has(edge.sourceId) || visibleNodeIds.has(edge.targetId);
      }),
    [edges, nodeById, selectedEdgeId, visibleNodeIds]
  );

  const selectedNodeSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  const selectedConnectedEdgeIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedNodeIds.length === 0) return ids;

    for (const edge of edges) {
      if (selectedNodeSet.has(edge.sourceId) || selectedNodeSet.has(edge.targetId)) {
        ids.add(edge.id);
      }
    }

    return ids;
  }, [edges, selectedNodeIds.length, selectedNodeSet]);

  const pendingSourceNode = useMemo(
    () => (pendingConnection ? nodeById.get(pendingConnection.nodeId) || null : null),
    [nodeById, pendingConnection]
  );

  const pendingTargetCount = useMemo(() => {
    if (!pendingConnection) return 0;
    return presentableNodes.filter((node) => node.id !== pendingConnection.nodeId).length;
  }, [pendingConnection, presentableNodes]);

  const startPanning = useCallback((clientX: number, clientY: number) => {
    setPendingConnection(null);
    setDraggingNodes(null);
    setHasRecordedDragHistory(false);
    setSelectionMarquee(null);

    setPanningState({
      startX: clientX,
      startY: clientY,
      baseX: viewportRef.current.x,
      baseY: viewportRef.current.y
    });
  }, []);

  const autoScrollCanvasIfNeeded = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      let moveX = 0;
      let moveY = 0;

      if (clientX < rect.left + AUTOSCROLL_EDGE_THRESHOLD) {
        moveX = AUTOSCROLL_MAX_SPEED * ((rect.left + AUTOSCROLL_EDGE_THRESHOLD - clientX) / AUTOSCROLL_EDGE_THRESHOLD);
      } else if (clientX > rect.right - AUTOSCROLL_EDGE_THRESHOLD) {
        moveX = -AUTOSCROLL_MAX_SPEED * ((clientX - (rect.right - AUTOSCROLL_EDGE_THRESHOLD)) / AUTOSCROLL_EDGE_THRESHOLD);
      }

      if (clientY < rect.top + AUTOSCROLL_EDGE_THRESHOLD) {
        moveY = AUTOSCROLL_MAX_SPEED * ((rect.top + AUTOSCROLL_EDGE_THRESHOLD - clientY) / AUTOSCROLL_EDGE_THRESHOLD);
      } else if (clientY > rect.bottom - AUTOSCROLL_EDGE_THRESHOLD) {
        moveY = -AUTOSCROLL_MAX_SPEED * ((clientY - (rect.bottom - AUTOSCROLL_EDGE_THRESHOLD)) / AUTOSCROLL_EDGE_THRESHOLD);
      }

      if (moveX === 0 && moveY === 0) return;

      onViewportChange({
        ...viewportRef.current,
        x: viewportRef.current.x + moveX,
        y: viewportRef.current.y + moveY
      });
    },
    [onViewportChange]
  );

  const handleCanvasMouseDown = (event: React.MouseEvent) => {
    const isMiddleMouse = event.button === 1;
    const isSpacePanGesture = event.button === 0 && isSpacePressed;

    if (isMiddleMouse || isSpacePanGesture) {
      event.preventDefault();
      startPanning(event.clientX, event.clientY);
      return;
    }

    if (event.button !== 0) return;

    const worldPos = screenToWorld(event.clientX, event.clientY);

    if (activeTool === 'text') {
      onAddNode(EntityType.TEXT_BOX, { x: worldPos.x - 90, y: worldPos.y - 30 });
      return;
    }

    if (activeTool === 'draw' && pendingConnection) {
      setPendingConnection(null);
      return;
    }

    if (activeTool === 'select') {
      const baseSelection = event.shiftKey ? selectedNodeIds : [];
      setSelectionMarquee({
        start: worldPos,
        current: worldPos,
        baseSelection
      });
      setPendingConnection(null);
      setDraggingNodes(null);
      setSnapGuide({ x: null, y: null });

      if (!event.shiftKey) {
        onSelectNodes([]);
        onSelectEdge(null);
      }
      return;
    }

    setPendingConnection(null);
    onSelectNodes([]);
    onSelectEdge(null);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    const worldPos = screenToWorld(event.clientX, event.clientY);
    setPointerWorld(worldPos);
    onPointerWorldChange?.(worldPos);

    if (panningState) {
      const deltaX = event.clientX - panningState.startX;
      const deltaY = event.clientY - panningState.startY;
      onViewportChange({
        ...viewportRef.current,
        x: panningState.baseX + deltaX,
        y: panningState.baseY + deltaY
      });
      return;
    }

    if (selectionMarquee) {
      const nextMarquee = {
        ...selectionMarquee,
        current: worldPos
      };
      setSelectionMarquee(nextMarquee);

      autoScrollCanvasIfNeeded(event.clientX, event.clientY);

      const minX = Math.min(nextMarquee.start.x, nextMarquee.current.x);
      const minY = Math.min(nextMarquee.start.y, nextMarquee.current.y);
      const maxX = Math.max(nextMarquee.start.x, nextMarquee.current.x);
      const maxY = Math.max(nextMarquee.start.y, nextMarquee.current.y);

      const marqueeSelected = presentableNodes
        .filter((node) => {
          const { width, height } = getNodeDimensions(node);
          const nodeMinX = node.position.x;
          const nodeMaxX = node.position.x + width;
          const nodeMinY = node.position.y;
          const nodeMaxY = node.position.y + height;
          return nodeMaxX >= minX && nodeMinX <= maxX && nodeMaxY >= minY && nodeMinY <= maxY;
        })
        .map((node) => node.id);

      onSelectNodes(Array.from(new Set([...nextMarquee.baseSelection, ...marqueeSelected])));
      return;
    }

    if (!draggingNodes) {
      setSnapGuide({ x: null, y: null });
      return;
    }

    if (!hasRecordedDragHistory) {
      onBeginNodeMove(draggingNodes.ids);
      setHasRecordedDragHistory(true);
    }

    autoScrollCanvasIfNeeded(event.clientX, event.clientY);

    const deltaX = worldPos.x - draggingNodes.pointerStart.x;
    const deltaY = worldPos.y - draggingNodes.pointerStart.y;

    let appliedDeltaX = deltaX;
    let appliedDeltaY = deltaY;

    if (snapToGrid && !event.altKey && draggingNodes.ids.length > 0) {
      const primaryId = draggingNodes.ids[0];
      const primaryInitial = draggingNodes.initialPositions[primaryId];
      if (primaryInitial) {
        const snappedPrimaryX = Math.round((primaryInitial.x + deltaX) / GRID_SIZE) * GRID_SIZE;
        const snappedPrimaryY = Math.round((primaryInitial.y + deltaY) / GRID_SIZE) * GRID_SIZE;
        appliedDeltaX = snappedPrimaryX - primaryInitial.x;
        appliedDeltaY = snappedPrimaryY - primaryInitial.y;
        setSnapGuide({ x: snappedPrimaryX, y: snappedPrimaryY });
      }
    } else {
      setSnapGuide({ x: null, y: null });
    }

    for (const id of draggingNodes.ids) {
      const initial = draggingNodes.initialPositions[id];
      if (!initial) continue;
      onUpdateNodePosition(id, {
        x: initial.x + appliedDeltaX,
        y: initial.y + appliedDeltaY
      });
    }
  };

  const handleMouseUp = () => {
    if (draggingNodes && showSwimlanes) {
      for (const id of draggingNodes.ids) {
        const node = nodeById.get(id);
        if (!node || node.type === EntityType.ANCHOR) continue;

        const laneCount = Math.max(1, swimlaneLabels.length);
        const laneIndex = clamp(Math.floor(Math.max(0, node.position.y) / SWIMLANE_HEIGHT), 0, laneCount - 1);
        const laneTop = laneIndex * SWIMLANE_HEIGHT + 20;
        const laneBottom = (laneIndex + 1) * SWIMLANE_HEIGHT - 84;
        const nextY = clamp(node.position.y, laneTop, laneBottom);

        if (Math.abs(nextY - node.position.y) > 0.1) {
          onUpdateNodePosition(id, {
            x: node.position.x,
            y: nextY
          });
        }
      }
    }

    setDraggingNodes(null);
    setHasRecordedDragHistory(false);
    setSelectionMarquee(null);
    setSnapGuide({ x: null, y: null });
    setPanningState(null);
    setPointerWorld(null);
    onPointerWorldChange?.(null);
  };

  const handlePortClick = (nodeId: string, portIdx: number) => {
    if (activeTool !== 'draw') return;

    if (!pendingConnection) {
      setPendingConnection({ nodeId, portIdx });
      return;
    }

    if (pendingConnection.nodeId !== nodeId) {
      onConnect(pendingConnection.nodeId, nodeId, pendingConnection.portIdx, portIdx);
    }

    setPendingConnection(null);
  };

  const handleNodeConnectClick = (event: React.MouseEvent, nodeId: string) => {
    if (activeTool !== 'draw') return;
    const world = screenToWorld(event.clientX, event.clientY);
    const resolution = resolvePendingConnectionFromNodeClick(nodes, pendingConnection, nodeId, world);

    if (resolution.edgeToCreate) {
      onConnect(
        resolution.edgeToCreate.sourceId,
        resolution.edgeToCreate.targetId,
        resolution.edgeToCreate.sourcePortIdx,
        resolution.edgeToCreate.targetPortIdx
      );
    }

    setPendingConnection(resolution.nextPending);
  };

  useEffect(() => {
    if (activeTool !== 'draw' && pendingConnection) {
      setPendingConnection(null);
    }
  }, [activeTool, pendingConnection]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === ' ') {
        if (isEditableTarget(event.target)) return;
        event.preventDefault();
        setIsSpacePressed(true);
      }

      if (event.key === 'Escape') {
        setPendingConnection(null);
        setSelectionMarquee(null);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === ' ') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleWheel = (event: React.WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      if (!containerRef.current) return;
      const factor = event.deltaY > 0 ? 0.92 : 1.08;
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom * factor));
      const rect = containerRef.current.getBoundingClientRect();
      const world = screenToWorld(event.clientX, event.clientY);
      onViewportChange({
        zoom: newZoom,
        x: event.clientX - rect.left - world.x * newZoom,
        y: event.clientY - rect.top - world.y * newZoom
      });
      return;
    }

    if (event.deltaX !== 0 || event.deltaY !== 0) {
      event.preventDefault();
      onViewportChange({
        ...viewportRef.current,
        x: viewportRef.current.x - event.deltaX,
        y: viewportRef.current.y - event.deltaY
      });
    }
  };

  const selectionRect = selectionMarquee
    ? {
        left: Math.min(selectionMarquee.start.x, selectionMarquee.current.x) * viewport.zoom + viewport.x,
        top: Math.min(selectionMarquee.start.y, selectionMarquee.current.y) * viewport.zoom + viewport.y,
        width: Math.abs(selectionMarquee.current.x - selectionMarquee.start.x) * viewport.zoom,
        height: Math.abs(selectionMarquee.current.y - selectionMarquee.start.y) * viewport.zoom
      }
    : null;

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${
        panningState ? 'cursor-grabbing' : isSpacePressed ? 'cursor-grab' : activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'
      } ${
        activeTool === 'draw'
          ? isDarkMode
            ? 'ring-1 ring-sky-300/35'
            : 'ring-1 ring-sky-500/35'
          : ''
      }`}
      style={{
        background: isDarkMode
          ? 'radial-gradient(1200px circle at 16% 0%, #283142 0%, #1e252f 45%, #171c24 100%)'
          : 'radial-gradient(900px circle at 14% 0%, #ffffff 0%, #f7f9fd 42%, #eef2f7 100%)'
      }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {activeTool === 'draw' ? (
        <div
          className={`pointer-events-none absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 rounded-lg border px-3 py-1.5 text-[11px] font-medium shadow-sm ${
            isDarkMode
              ? 'border-sky-300/35 bg-slate-900/90 text-sky-100'
              : 'border-sky-200 bg-white/95 text-sky-900'
          }`}
          role="status"
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-600 dark:text-sky-200">
            Connect mode
          </span>
          {pendingConnection ? (
            <>
              <span>
                Source: <strong>{pendingSourceNode?.label || 'Node'}</strong> - choose target ({pendingTargetCount} available)
              </span>
              <button
                type="button"
                data-testid="cancel-pending-connection"
                className={`pointer-events-auto rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
                  isDarkMode
                    ? 'border-sky-400/40 bg-sky-500/20 text-sky-100 hover:bg-sky-500/30'
                    : 'border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100'
                }`}
                onMouseDown={(evt) => evt.stopPropagation()}
                onClick={(evt) => {
                  evt.stopPropagation();
                  setPendingConnection(null);
                }}
                aria-label="Cancel pending connection"
                title="Cancel pending connection"
              >
                Cancel
              </button>
            </>
          ) : (
            <span>Click source node or port, then click target.</span>
          )}
        </div>
      ) : null}

      <div
        ref={exportLayerRef}
        className="absolute inset-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <svg className="absolute left-0 top-0 h-full w-full overflow-visible">
          <CanvasOverlays
            nodes={presentableNodes}
            edges={edges}
            isDarkMode={isDarkMode}
            gridMode={gridMode}
            showSwimlanes={showSwimlanes}
            swimlaneLabels={swimlaneLabels}
            snapGuide={snapGuide}
            overlayMode={overlayMode}
          />

          {drawings.map((drawing) => (
            <polyline
              key={drawing.id}
              points={drawing.points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill="none"
              stroke={drawing.color}
              strokeWidth={drawing.width}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none"
            />
          ))}

          {renderedEdges.map((edge) => {
            const source = nodeById.get(edge.sourceId);
            const target = nodeById.get(edge.targetId);
            if (!source || !target) return null;

            const key = [edge.sourceId, edge.targetId].sort().join('-');

            return (
              <DiagramEdgePath
                key={edge.id}
                edge={edge}
                source={source}
                target={target}
                isSelected={selectedEdgeId === edge.id}
                isDimmed={selectedNodeIds.length > 0 && !selectedConnectedEdgeIds.has(edge.id)}
                isDarkMode={isDarkMode}
                zoom={viewport.zoom}
                onSelect={(id) => {
                  onSelectEdge(id);
                  onOpenInspector();
                }}
                offsetIndex={edgeGroups[key].indexOf(edge.id)}
                totalEdges={edgeGroups[key].length}
              />
            );
          })}

          {activeTool === 'draw' && pendingConnection && pointerWorld
            ? (() => {
                const sourceNode = nodeById.get(pendingConnection.nodeId);
                if (!sourceNode) return null;

                const start = getPortPosition(sourceNode, pendingConnection.portIdx);
                const end = pointerWorld;
                const midX = (start.x + end.x) / 2;
                const midY = (start.y + end.y) / 2;
                const dx = end.x - start.x;
                const dy = end.y - start.y;
                const length = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = -dy / length;
                const ny = dx / length;
                const control = { x: midX + nx * 24, y: midY + ny * 24 };
                const previewPath = `M ${start.x} ${start.y} Q ${control.x} ${control.y}, ${end.x} ${end.y}`;

                return (
                  <path
                    d={previewPath}
                    fill="none"
                    stroke={isDarkMode ? '#60a5fa' : '#0d99ff'}
                    strokeWidth={2}
                    strokeDasharray="6,4"
                    className="pointer-events-none"
                  />
                );
              })()
            : null}
        </svg>

        {renderedNodes.map((node) => (
          <DiagramNodeCard
            key={node.id}
            node={node}
            zoom={viewport.zoom}
            isSelected={selectedNodeIds.includes(node.id)}
            isDarkMode={isDarkMode}
            showPorts={showPorts && activeTool === 'draw'}
            connectState={
              activeTool === 'draw'
                ? pendingConnection?.nodeId === node.id
                  ? 'source'
                  : pendingConnection
                    ? 'candidate'
                    : 'idle'
                : 'idle'
            }
            onMouseDown={(event, id) => {
              if (event.button !== 0 || isSpacePressed) return;
              event.stopPropagation();
              if (activeTool !== 'select') return;

              if (event.shiftKey) {
                if (selectedNodeIds.includes(id)) {
                  onSelectNodes(selectedNodeIds.filter((candidate) => candidate !== id));
                } else {
                  onSelectNodes([...selectedNodeIds, id]);
                }
                onSelectEdge(null);
                return;
              }

              const dragIds =
                selectedNodeIds.includes(id) && selectedNodeIds.length > 0 ? selectedNodeIds : [id];

              onSelectNodes(dragIds);
              onSelectEdge(null);

              const worldPos = screenToWorld(event.clientX, event.clientY);
              const initialPositions: Record<string, Position> = {};
              for (const nodeId of dragIds) {
                const currentNode = nodeById.get(nodeId);
                if (!currentNode) continue;
                initialPositions[nodeId] = { ...currentNode.position };
              }

              setDraggingNodes({
                ids: dragIds,
                pointerStart: worldPos,
                initialPositions
              });
              setHasRecordedDragHistory(false);
            }}
            onClick={(event, id) => {
              event.stopPropagation();
              handleNodeConnectClick(event, id);
            }}
            onPortClick={(event, id, portIdx) => {
              event.stopPropagation();
              handlePortClick(id, portIdx);
            }}
          />
        ))}
      </div>

      {selectionRect ? (
        <div
          className={`pointer-events-none absolute rounded-md border ${
            isDarkMode ? 'border-blue-300/80 bg-blue-500/15' : 'border-blue-600/70 bg-blue-500/10'
          }`}
          style={selectionRect}
        />
      ) : null}

      {showMinimap ? (
        <MiniMapPanel
          nodes={presentableNodes}
          viewport={viewport}
          canvasSize={canvasSize}
          isDarkMode={isDarkMode}
          onViewportChange={onViewportChange}
        />
      ) : null}
    </div>
  );
};

export default FlowCanvas;
