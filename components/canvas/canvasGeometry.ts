import { Position as RFPosition } from '@xyflow/react';
import { EntityType, Node, NodeHandleSide, NodeShape, Position } from '../../types';
import { resolveNodeScale, resolveNodeShape } from '../../lib/nodeDisplay';

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 60;
export const ANCHOR_SIZE = 16;
export const SWIMLANE_HEIGHT = 300;
export const SWIMLANE_HEADER_HEIGHT = 34;
export const SWIMLANE_PADDING_Y = 14;

export const getHandlePosition = (portIdx: number): RFPosition => {
  if (portIdx === 0) return RFPosition.Top;
  if (portIdx === 1) return RFPosition.Right;
  if (portIdx === 2) return RFPosition.Bottom;
  return RFPosition.Left;
};

const PORT_IDX_BY_SIDE: Record<NodeHandleSide, number> = {
  top: 0,
  right: 1,
  bottom: 2,
  left: 3
};

export const DEFAULT_SOURCE_PORTS = [1, 2];
export const DEFAULT_TARGET_PORTS = [3, 0];
const ALL_PORTS = [0, 1, 2, 3];

const normalizeConfiguredSides = (value: unknown): NodeHandleSide[] => {
  if (!Array.isArray(value)) return [];
  const allowed: NodeHandleSide[] = [];
  for (const item of value) {
    if (item === 'top' || item === 'right' || item === 'bottom' || item === 'left') {
      if (!allowed.includes(item)) {
        allowed.push(item);
      }
    }
  }
  return allowed;
};

const toPortIndexes = (sides: NodeHandleSide[]) => sides.map((side) => PORT_IDX_BY_SIDE[side]);

export const getNodeHandlePortConfig = (node: Node) => {
  const rawConfig = node.data?.handleConfig;
  if (!rawConfig || typeof rawConfig !== 'object') {
    return {
      sourcePorts: [...DEFAULT_SOURCE_PORTS],
      targetPorts: [...DEFAULT_TARGET_PORTS]
    };
  }

  const sourceSides = normalizeConfiguredSides((rawConfig as { sources?: unknown }).sources);
  const targetSides = normalizeConfiguredSides((rawConfig as { targets?: unknown }).targets);
  const bidirectional = !!(rawConfig as { bidirectional?: unknown }).bidirectional;

  let sourcePorts = sourceSides.length > 0 ? toPortIndexes(sourceSides) : [...DEFAULT_SOURCE_PORTS];
  let targetPorts = targetSides.length > 0 ? toPortIndexes(targetSides) : [...DEFAULT_TARGET_PORTS];

  if (bidirectional) {
    const merged = Array.from(new Set([...sourcePorts, ...targetPorts])).sort((a, b) => a - b);
    sourcePorts = merged;
    targetPorts = merged;
  }

  return {
    sourcePorts,
    targetPorts
  };
};

export const getNodePortRole = (node: Node, portIdx: number): 'source' | 'target' | 'both' | null => {
  const { sourcePorts, targetPorts } = getNodeHandlePortConfig(node);
  const isSource = sourcePorts.includes(portIdx);
  const isTarget = targetPorts.includes(portIdx);
  if (isSource && isTarget) return 'both';
  if (isSource) return 'source';
  if (isTarget) return 'target';
  return null;
};

export const getNodeDimensions = (node: Node) => {
  if (node.type === EntityType.ANCHOR) {
    return { width: ANCHOR_SIZE, height: ANCHOR_SIZE };
  }

  const shape = resolveNodeShape(node);
  const scale = resolveNodeScale(node);
  const defaultWidth =
    shape === NodeShape.CIRCLE
      ? 88
      : shape === NodeShape.SQUARE
        ? 92
        : shape === NodeShape.DIAMOND
          ? 124
          : shape === NodeShape.PILL
            ? 212
            : shape === NodeShape.ROUNDED_RECTANGLE
              ? 188
              : shape === NodeShape.CYLINDER
                ? 190
                : NODE_WIDTH;
  const defaultHeight =
    shape === NodeShape.CIRCLE
      ? 88
      : shape === NodeShape.SQUARE
        ? 92
        : shape === NodeShape.DIAMOND
          ? 124
          : shape === NodeShape.PILL
            ? 64
            : shape === NodeShape.ROUNDED_RECTANGLE
              ? 68
              : shape === NodeShape.CYLINDER
                ? 72
                : NODE_HEIGHT;

  let width = node.width || defaultWidth;
  let height = node.height || defaultHeight;

  if (shape === NodeShape.SQUARE || shape === NodeShape.CIRCLE) {
    const side = Math.max(width, height);
    width = side;
    height = side;
  }

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale)
  };
};

export const getNodeCenter = (node: Node): Position => {
  if (node.type === EntityType.ANCHOR) {
    return { x: node.position.x + ANCHOR_SIZE / 2, y: node.position.y + ANCHOR_SIZE / 2 };
  }

  const { width, height } = getNodeDimensions(node);
  return {
    x: node.position.x + width / 2,
    y: node.position.y + height / 2
  };
};

export const getPortPosition = (node: Node, portIdx: number): Position => {
  if (node.type === EntityType.ANCHOR) {
    return { x: node.position.x + ANCHOR_SIZE / 2, y: node.position.y + ANCHOR_SIZE / 2 };
  }

  const { width, height } = getNodeDimensions(node);
  const x = node.position.x;
  const y = node.position.y;
  const cx = x + width / 2;
  const cy = y + height / 2;

  if (portIdx === 0) return { x: cx, y };
  if (portIdx === 1) return { x: x + width, y: cy };
  if (portIdx === 2) return { x: cx, y: y + height };
  return { x, y: cy };
};

export const getClosestPortToPoint = (node: Node, point: Position, allowedPortIdx: number[] = ALL_PORTS) => {
  const normalizedAllowed = allowedPortIdx.length > 0 ? allowedPortIdx : ALL_PORTS;
  let bestIdx = 0;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const idx of normalizedAllowed) {
    const port = getPortPosition(node, idx);
    const dx = port.x - point.x;
    const dy = port.y - point.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIdx = idx;
    }
  }

  return bestIdx;
};

export const getSquaredDistance = (a: Position, b: Position) => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};
