import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DrawingPath,
  Edge,
  EntityType,
  Node,
  NodePinnedAttribute,
  OverlayMode,
  Position,
  ViewportTransform
} from '../types';
import DiagramNodeCard from './canvas/DiagramNodeCard';
import DiagramEdgePath from './canvas/DiagramEdgePath';
import CanvasOverlays from './canvas/CanvasOverlays';
import MiniMapPanel from './canvas/MiniMapPanel';
import NodeContextToolbar from './canvas/NodeContextToolbar';
import { GRID_SIZE, MAX_ZOOM, MIN_ZOOM } from './canvas/canvasConstants';
import {
  SWIMLANE_HEIGHT,
  getClosestPortToPoint,
  getNodeHandlePortConfig,
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
  isMobileViewport: boolean;
  onDeleteSelection: () => void;
  onDuplicateSelection: () => void;
  onRenameSelection: () => void;
  onActivateConnectTool: () => void;
  onToggleQuickAttribute: () => void;
  isQuickAttributePinned: boolean;
  showSwimlanes: boolean;
  swimlaneLabels: string[];
  gridMode: 'none' | 'lines' | 'dots';
  overlayMode: OverlayMode;
  showMinimap: boolean;
  exportLayerRef?: React.RefObject<HTMLDivElement | null>;
  pinnedNodeAttributes: NodePinnedAttribute[];
}

const AUTOSCROLL_EDGE_THRESHOLD = 40;
const AUTOSCROLL_MAX_SPEED = 16;

type LodState = {
  compactNodes: boolean;
  showNodeMeta: boolean;
  showNodeFooter: boolean;
  showEdgeLabels: boolean;
};

type PendingConnection = { nodeId: string; portIdx: number };
type PendingConnectionResolution = {
  nextPending: PendingConnection | null;
  edgeToCreate?: { sourceId: string; targetId: string; sourcePortIdx: number; targetPortIdx: number };
};
type PortRole = 'source' | 'target' | 'both';

const parsePortHandleRef = (value: string): { nodeId: string; portIdx: number } | null => {
  const match = /^node-port-(.+)-([0-9]+)$/.exec(value);
  if (!match) return null;
  const portIdx = Number.parseInt(match[2], 10);
  if (!Number.isFinite(portIdx)) return null;
  return {
    nodeId: match[1],
    portIdx
  };
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
    const { sourcePorts } = getNodeHandlePortConfig(clickedNode);
    return {
      nextPending: {
        nodeId,
        portIdx: getClosestPortToPoint(clickedNode, clickWorld, sourcePorts)
      }
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
  const { targetPorts } = getNodeHandlePortConfig(clickedNode);
  const targetPortIdx = getClosestPortToPoint(clickedNode, sourcePortPosition, targetPorts);

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
  isMobileViewport,
  onDeleteSelection,
  onDuplicateSelection,
  onRenameSelection,
  onActivateConnectTool,
  onToggleQuickAttribute,
  isQuickAttributePinned,
  showSwimlanes,
  swimlaneLabels,
  gridMode,
  overlayMode,
  showMinimap,
  exportLayerRef,
  pinnedNodeAttributes
}) => {
  const [draggingNodes, setDraggingNodes] = useState<{
    ids: string[];
    pointerStart: Position;
    initialPositions: Record<string, Position>;
  } | null>(null);
  const [hasRecordedDragHistory, setHasRecordedDragHistory] = useState(false);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [isPortDragActive, setIsPortDragActive] = useState(false);
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
  const [lodState, setLodState] = useState<LodState>(() => ({
    compactNodes: viewport.zoom < 0.35,
    showNodeMeta: viewport.zoom >= 0.6,
    showNodeFooter: viewport.zoom >= 0.45,
    showEdgeLabels: viewport.zoom >= 0.45
  }));

  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef(viewport);
  const pointerMoveRafRef = useRef<number | null>(null);
  const pendingPointerRef = useRef<{ clientX: number; clientY: number; altKey: boolean } | null>(null);
  const lastPointerClientRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  useEffect(() => {
    const zoom = viewport.zoom;
    setLodState((prev) => {
      const next: LodState = {
        compactNodes: prev.compactNodes ? zoom < 0.39 : zoom < 0.35,
        showNodeMeta: prev.showNodeMeta ? zoom >= 0.6 : zoom >= 0.64,
        showNodeFooter: prev.showNodeFooter ? zoom >= 0.45 : zoom >= 0.49,
        showEdgeLabels: prev.showEdgeLabels ? zoom >= 0.45 : zoom >= 0.49
      };

      if (
        next.compactNodes === prev.compactNodes &&
        next.showNodeMeta === prev.showNodeMeta &&
        next.showNodeFooter === prev.showNodeFooter &&
        next.showEdgeLabels === prev.showEdgeLabels
      ) {
        return prev;
      }

      return next;
    });
  }, [viewport.zoom]);

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

  const resolveDropConnectionTarget = useCallback(
    (clientX: number, clientY: number, source: PendingConnection): PendingConnection | null => {
      if (typeof document === 'undefined') return null;
      const sourceNode = nodeById.get(source.nodeId);
      if (!sourceNode) return null;

      const sourcePortPosition = getPortPosition(sourceNode, source.portIdx);
      const targetElement = document.elementFromPoint(clientX, clientY);
      if (!(targetElement instanceof HTMLElement)) return null;

      const handleElement = targetElement.closest('[data-testid^="node-port-"]') as HTMLElement | null;
      if (handleElement) {
        const handleRef = parsePortHandleRef(
          handleElement.dataset.testid || handleElement.getAttribute('data-testid') || ''
        );
        const role = handleElement.getAttribute('data-port-role');
        const isTargetHandle = role === 'target' || role === 'both';
        if (
          handleRef &&
          isTargetHandle &&
          handleRef.nodeId !== source.nodeId &&
          !nodeById.get(handleRef.nodeId)?.data?.isLocked
        ) {
          return {
            nodeId: handleRef.nodeId,
            portIdx: handleRef.portIdx
          };
        }
      }

      const nodeElement = targetElement.closest('[data-node-id]') as HTMLElement | null;
      const targetNodeId = nodeElement?.getAttribute('data-node-id');
      if (!targetNodeId || targetNodeId === source.nodeId) return null;
      const targetNode = nodeById.get(targetNodeId);
      if (!targetNode || targetNode.data?.isLocked) return null;
      const { targetPorts } = getNodeHandlePortConfig(targetNode);
      const targetPortIdx = getClosestPortToPoint(targetNode, sourcePortPosition, targetPorts);
      return {
        nodeId: targetNodeId,
        portIdx: targetPortIdx
      };
    },
    [nodeById]
  );

  const selectedNodeSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);

  const edgeOffsetMeta = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const edge of edges) {
      const key = [edge.sourceId, edge.targetId].sort().join('-');
      const group = groups.get(key);
      if (group) {
        group.push(edge.id);
      } else {
        groups.set(key, [edge.id]);
      }
    }

    const meta = new Map<string, { offsetIndex: number; totalEdges: number }>();
    for (const group of groups.values()) {
      const totalEdges = group.length;
      group.forEach((edgeId, offsetIndex) => {
        meta.set(edgeId, { offsetIndex, totalEdges });
      });
    }

    return meta;
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

      if (intersects || selectedNodeSet.has(node.id) || pendingConnection?.nodeId === node.id) {
        visibleIds.add(node.id);
      }
    }

    return visibleIds;
  }, [
    pendingConnection?.nodeId,
    presentableNodes,
    selectedNodeSet,
    worldViewportBounds.maxX,
    worldViewportBounds.maxY,
    worldViewportBounds.minX,
    worldViewportBounds.minY
  ]);

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

    const clickedNode = presentableNodes.find((candidate) => {
      const { width, height } = getNodeDimensions(candidate);
      return (
        worldPos.x >= candidate.position.x &&
        worldPos.x <= candidate.position.x + width &&
        worldPos.y >= candidate.position.y &&
        worldPos.y <= candidate.position.y + height
      );
    });

    if (activeTool === 'text') {
      onAddNode(EntityType.TEXT_BOX, { x: worldPos.x - 90, y: worldPos.y - 30 });
      return;
    }

    if (activeTool === 'draw') {
      if (clickedNode) {
        if (clickedNode.data?.isLocked) {
          setPendingConnection(null);
          return;
        }
        const resolution = resolvePendingConnectionFromNodeClick(
          nodes,
          pendingConnection,
          clickedNode.id,
          worldPos
        );

        if (resolution.edgeToCreate) {
          onConnect(
            resolution.edgeToCreate.sourceId,
            resolution.edgeToCreate.targetId,
            resolution.edgeToCreate.sourcePortIdx,
            resolution.edgeToCreate.targetPortIdx
          );
        }

        setPendingConnection(resolution.nextPending);
        return;
      }

      if (pendingConnection) {
        setPendingConnection(null);
      }
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

  const processMouseMove = useCallback(
    (clientX: number, clientY: number, altKey: boolean) => {
      lastPointerClientRef.current = { x: clientX, y: clientY };
      const worldPos = screenToWorld(clientX, clientY);
      setPointerWorld(worldPos);
      onPointerWorldChange?.(worldPos);

      if (panningState) {
        const deltaX = clientX - panningState.startX;
        const deltaY = clientY - panningState.startY;
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

        autoScrollCanvasIfNeeded(clientX, clientY);

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

      autoScrollCanvasIfNeeded(clientX, clientY);

      const deltaX = worldPos.x - draggingNodes.pointerStart.x;
      const deltaY = worldPos.y - draggingNodes.pointerStart.y;

      let appliedDeltaX = deltaX;
      let appliedDeltaY = deltaY;

      if (snapToGrid && !altKey && draggingNodes.ids.length > 0) {
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
    },
    [
      autoScrollCanvasIfNeeded,
      draggingNodes,
      hasRecordedDragHistory,
      onBeginNodeMove,
      onPointerWorldChange,
      onSelectNodes,
      onUpdateNodePosition,
      onViewportChange,
      panningState,
      presentableNodes,
      screenToWorld,
      selectionMarquee,
      snapToGrid
    ]
  );

  const handleMouseMove = (event: React.MouseEvent) => {
    pendingPointerRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      altKey: event.altKey
    };

    if (pointerMoveRafRef.current !== null) return;

    pointerMoveRafRef.current = window.requestAnimationFrame(() => {
      pointerMoveRafRef.current = null;
      const pending = pendingPointerRef.current;
      if (!pending) return;
      processMouseMove(pending.clientX, pending.clientY, pending.altKey);
    });
  };

  const handleMouseUp = (event?: React.MouseEvent) => {
    if (event) {
      lastPointerClientRef.current = { x: event.clientX, y: event.clientY };
    }

    if (isPortDragActive && pendingConnection) {
      const dropPoint = event
        ? { x: event.clientX, y: event.clientY }
        : lastPointerClientRef.current;
      if (dropPoint) {
        const dropTarget = resolveDropConnectionTarget(dropPoint.x, dropPoint.y, pendingConnection);
        if (dropTarget && dropTarget.nodeId !== pendingConnection.nodeId) {
          onConnect(
            pendingConnection.nodeId,
            dropTarget.nodeId,
            pendingConnection.portIdx,
            dropTarget.portIdx
          );
        }
      }
      setIsPortDragActive(false);
      setPendingConnection(null);
    }

    if (pointerMoveRafRef.current !== null) {
      window.cancelAnimationFrame(pointerMoveRafRef.current);
      pointerMoveRafRef.current = null;
    }
    pendingPointerRef.current = null;

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

  const handlePortClick = useCallback(
    (nodeId: string, portIdx: number, role: PortRole) => {
      const canUseConnect = activeTool === 'draw' || pendingConnection !== null;
      if (!canUseConnect) return;
      if (nodeById.get(nodeId)?.data?.isLocked) return;
      const canStartConnection = role === 'source' || role === 'both';
      const canCompleteConnection = role === 'target' || role === 'both';

      if (!pendingConnection) {
        if (activeTool !== 'draw') return;
        if (!canStartConnection) return;
        setPendingConnection({ nodeId, portIdx });
        return;
      }

      if (nodeById.get(pendingConnection.nodeId)?.data?.isLocked) {
        setPendingConnection(null);
        return;
      }

      if (pendingConnection.nodeId === nodeId) {
        if (canStartConnection) {
          setPendingConnection({ nodeId, portIdx });
          return;
        }
        setPendingConnection(null);
        return;
      }

      if (canCompleteConnection) {
        onConnect(pendingConnection.nodeId, nodeId, pendingConnection.portIdx, portIdx);
        setIsPortDragActive(false);
        setPendingConnection(null);
        return;
      }

      if (canStartConnection) {
        setPendingConnection({ nodeId, portIdx });
      }
    },
    [activeTool, nodeById, onConnect, pendingConnection]
  );

  const handleNodeConnectClick = useCallback(
    (event: React.MouseEvent, nodeId: string) => {
      const canUseConnect = activeTool === 'draw' || pendingConnection !== null;
      if (!canUseConnect) return;
      if (nodeById.get(nodeId)?.data?.isLocked) return;
      if (!pendingConnection && activeTool !== 'draw') return;
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
    },
    [activeTool, nodeById, nodes, onConnect, pendingConnection, screenToWorld]
  );

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

  useEffect(() => {
    return () => {
      if (pointerMoveRafRef.current !== null) {
        window.cancelAnimationFrame(pointerMoveRafRef.current);
      }
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

  const handleEdgeSelect = useCallback(
    (id: string) => {
      onSelectEdge(id);
      onOpenInspector();
    },
    [onOpenInspector, onSelectEdge]
  );

  const handleNodeMouseDown = useCallback(
    (event: React.MouseEvent, id: string) => {
      if (event.button !== 0 || isSpacePressed) return;
      event.stopPropagation();
      const clickedNode = nodeById.get(id);
      const isLockedNode = !!clickedNode?.data?.isLocked;

      if (activeTool === 'draw') {
        if (isLockedNode) {
          setPendingConnection(null);
          return;
        }
        handleNodeConnectClick(event, id);
        return;
      }

      if (activeTool !== 'select') return;

      if (event.shiftKey) {
        if (selectedNodeSet.has(id)) {
          onSelectNodes(selectedNodeIds.filter((candidate) => candidate !== id));
        } else {
          onSelectNodes([...selectedNodeIds, id]);
        }
        onSelectEdge(null);
        onOpenInspector();
        return;
      }

      const dragIds = selectedNodeSet.has(id) && selectedNodeIds.length > 0 ? selectedNodeIds : [id];
      onSelectNodes(dragIds);
      onSelectEdge(null);
      onOpenInspector();

      if (isLockedNode) {
        setDraggingNodes(null);
        return;
      }

      const movableIds = dragIds.filter((nodeId) => !nodeById.get(nodeId)?.data?.isLocked);
      if (movableIds.length === 0) {
        setDraggingNodes(null);
        return;
      }

      const worldPos = screenToWorld(event.clientX, event.clientY);
      const initialPositions: Record<string, Position> = {};
      for (const nodeId of movableIds) {
        const currentNode = nodeById.get(nodeId);
        if (!currentNode) continue;
        initialPositions[nodeId] = { ...currentNode.position };
      }

      setDraggingNodes({
        ids: movableIds,
        pointerStart: worldPos,
        initialPositions
      });
      setHasRecordedDragHistory(false);
    },
    [
      activeTool,
      handleNodeConnectClick,
      isSpacePressed,
      nodeById,
      onOpenInspector,
      onSelectEdge,
      onSelectNodes,
      screenToWorld,
      selectedNodeIds,
      selectedNodeSet
    ]
  );

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, id: string) => {
      event.stopPropagation();
      if (activeTool === 'draw') return;
      if (!pendingConnection) return;
      handleNodeConnectClick(event, id);
    },
    [activeTool, handleNodeConnectClick, pendingConnection]
  );

  const handleNodePortClick = useCallback(
    (event: React.MouseEvent, id: string, portIdx: number, role: PortRole) => {
      event.stopPropagation();
      handlePortClick(id, portIdx, role);
    },
    [handlePortClick]
  );

  const handleNodePortMouseDown = useCallback(
    (event: React.MouseEvent, id: string, portIdx: number, role: PortRole) => {
      event.stopPropagation();
      if (activeTool !== 'draw') return;
      if (role !== 'source' && role !== 'both') return;
      if (nodeById.get(id)?.data?.isLocked) return;
      const world = screenToWorld(event.clientX, event.clientY);
      setPendingConnection({ nodeId: id, portIdx });
      setIsPortDragActive(true);
      lastPointerClientRef.current = { x: event.clientX, y: event.clientY };
      setPointerWorld(world);
      onPointerWorldChange?.(world);
    },
    [activeTool, nodeById, onPointerWorldChange, screenToWorld]
  );

  const selectionRect = selectionMarquee
    ? {
        left: Math.min(selectionMarquee.start.x, selectionMarquee.current.x) * viewport.zoom + viewport.x,
        top: Math.min(selectionMarquee.start.y, selectionMarquee.current.y) * viewport.zoom + viewport.y,
        width: Math.abs(selectionMarquee.current.x - selectionMarquee.start.x) * viewport.zoom,
        height: Math.abs(selectionMarquee.current.y - selectionMarquee.start.y) * viewport.zoom
      }
    : null;

  const selectedNodeForToolbar = useMemo(() => {
    if (isMobileViewport || activeTool !== 'select') return null;
    if (selectedEdgeId || selectedNodeIds.length !== 1) return null;
    const selectedNode = nodeById.get(selectedNodeIds[0]);
    if (!selectedNode || selectedNode.isConnectorHandle) return null;
    return selectedNode;
  }, [activeTool, isMobileViewport, nodeById, selectedEdgeId, selectedNodeIds]);

  const nodeToolbarAnchor = useMemo(() => {
    if (!selectedNodeForToolbar) return null;
    const { width } = getNodeDimensions(selectedNodeForToolbar);
    const rawX = (selectedNodeForToolbar.position.x + width / 2) * viewport.zoom + viewport.x;
    const rawY = selectedNodeForToolbar.position.y * viewport.zoom + viewport.y - 10;
    const minX = 86;
    const maxX = Math.max(minX, (canvasSize.width || 0) - 86);
    const clampedX = Math.max(minX, Math.min(maxX, rawX));
    const clampedY = Math.max(52, rawY);
    return { x: clampedX, y: clampedY };
  }, [canvasSize.width, selectedNodeForToolbar, viewport.x, viewport.y, viewport.zoom]);

  const handleStartConnectFromSelectedNode = useCallback(() => {
    if (!selectedNodeForToolbar || selectedNodeForToolbar.data?.isLocked) return;
    const { sourcePorts } = getNodeHandlePortConfig(selectedNodeForToolbar);
    const sourcePortIdx = sourcePorts[0] ?? 1;
    const armConnection = () => {
      setPendingConnection({ nodeId: selectedNodeForToolbar.id, portIdx: sourcePortIdx });
      setIsPortDragActive(false);
    };
    if (activeTool !== 'draw') {
      onActivateConnectTool();
      window.requestAnimationFrame(armConnection);
      return;
    }
    armConnection();
  }, [activeTool, onActivateConnectTool, selectedNodeForToolbar]);

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden ${
        panningState ? 'cursor-grabbing' : isSpacePressed ? 'cursor-grab' : activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'
      } ${
        activeTool === 'draw'
          ? isDarkMode
            ? 'ring-1 ring-accent/35'
            : 'ring-1 ring-accent/30'
          : ''
      }`}
      style={{
        background: isDarkMode
          ? 'radial-gradient(1100px circle at 14% 0%, rgba(79,70,229,0.12) 0%, transparent 56%), var(--ff-surface-canvas)'
          : 'radial-gradient(900px circle at 12% 0%, rgba(79,70,229,0.08) 0%, transparent 54%), var(--ff-surface-canvas)'
      }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
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
            const offsetMeta = edgeOffsetMeta.get(edge.id) || { offsetIndex: 0, totalEdges: 1 };

            return (
              <DiagramEdgePath
                key={edge.id}
                edge={edge}
                source={source}
                target={target}
                isSelected={selectedEdgeId === edge.id}
                isDimmed={selectedNodeIds.length > 0 && !selectedConnectedEdgeIds.has(edge.id)}
                isDarkMode={isDarkMode}
                showLabelAtZoom={lodState.showEdgeLabels}
                onSelect={handleEdgeSelect}
                offsetIndex={offsetMeta.offsetIndex}
                totalEdges={offsetMeta.totalEdges}
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
            compactMode={lodState.compactNodes}
            showBodyMeta={lodState.showNodeMeta}
            showFooter={lodState.showNodeFooter}
            isSelected={selectedNodeSet.has(node.id)}
            isDarkMode={isDarkMode}
            pinnedAttributes={pinnedNodeAttributes}
            showPorts={showPorts}
            isConnectToolActive={activeTool === 'draw'}
            connectState={
              activeTool === 'draw'
                ? pendingConnection?.nodeId === node.id
                  ? 'source'
                  : pendingConnection
                    ? 'candidate'
                    : 'idle'
                : 'idle'
            }
            isConnecting={activeTool === 'draw'}
            onMouseDown={handleNodeMouseDown}
            onClick={handleNodeClick}
            onPortMouseDown={handleNodePortMouseDown}
            onPortClick={handleNodePortClick}
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

      {nodeToolbarAnchor ? (
        <NodeContextToolbar
          anchor={nodeToolbarAnchor}
          onDelete={onDeleteSelection}
          onDuplicate={onDuplicateSelection}
          onRename={onRenameSelection}
          onConnect={handleStartConnectFromSelectedNode}
          onToggleQuickAttribute={onToggleQuickAttribute}
          isQuickAttributePinned={isQuickAttributePinned}
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

      {activeTool === 'draw' ? (
        <div className="ff-mode-chip" role="status" aria-live="polite">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
          <strong>Connect</strong>
          {pendingConnection ? (
            <>
              <span className="truncate">
                {pendingSourceNode?.label || 'Source locked'} to target
              </span>
              <button
                type="button"
                data-testid="cancel-pending-connection"
                className="status-chip !h-6 !px-2 !text-[10px]"
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
            <span className="opacity-90">Drag handle or source then target · Esc</span>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default FlowCanvas;
