import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Trash2,
  Download,
  Upload,
  MousePointer2,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Moon,
  Sun,
  Pencil,
  Type as TypeIcon,
  CircleDot,
  Grid3X3,
  EyeOff,
  Eye,
  Rows,
  Settings,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize,
  HelpCircle,
  FileText,
  CreditCard,
  Globe,
  Layout,
  ArrowLeft,
  X,
  Minus,
  MoveRight,
  MoveLeft,
  ArrowRightLeft,
  Spline,
  CornerDownRight,
  MoveDiagonal,
  Pipette,
  History,
  Ban
} from 'lucide-react';
import FlowCanvas from './components/FlowCanvas';
import Sidebar from './components/Sidebar';
import Inspector from './components/Inspector';
import {
  Node,
  Edge,
  ConnectorPresetKey,
  EntityType,
  BankAccountType,
  CardNetwork,
  EndPointType,
  GateCategory,
  GateControl,
  PaymentRail,
  SettlementType,
  TimingType,
  CurrencyPair,
  DrawingPath,
  FlowDirection,
  NodeShape,
  TransactionLifecycle,
  Position,
  ViewportTransform
} from './types';
import { BANK_ENTITY_TYPES, CONNECTOR_PRESETS, GATE_CONTROLS_BY_CATEGORY } from './constants';
import { GoogleGenAI } from '@google/genai';

type DiagramSnapshot = {
  nodes: Node[];
  edges: Edge[];
  drawings: DrawingPath[];
};

type ExportFormat = 'json' | 'csv-nodes' | 'csv-edges' | 'png' | 'svg' | 'pdf';

const STORAGE_KEY = 'finflow-builder.diagram.v1';
const HISTORY_LIMIT = 100;
const LINE_STYLE_OPTIONS = ['solid', 'dashed', 'dotted'] as const;

// Default Palette
const TOOLBAR_COLORS = [
  '#64748b', // Slate
  '#0f172a', // Black
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#a855f7', // Purple
  '#ec4899', // Pink
];

// --- TEMPLATES ---
const TEMPLATES: Record<string, DiagramSnapshot> = {
  'marketplace': {
    nodes: [
      { id: 't1-1', type: EntityType.END_POINT, label: 'Buyer', shape: NodeShape.CIRCLE, position: { x: 50, y: 150 }, endPointType: EndPointType.CONSUMER, zIndex: 20, swimlaneId: 1 },
      { id: 't1-2', type: EntityType.ACQUIRING_BANK, label: 'Acquirer', shape: NodeShape.RECTANGLE, position: { x: 300, y: 150 }, zIndex: 20, swimlaneId: 1 },
      { id: 't1-3', type: EntityType.SPONSOR_BANK, label: 'Platform FBO', shape: NodeShape.RECTANGLE, position: { x: 550, y: 150 }, zIndex: 20, swimlaneId: 1 },
      { id: 't1-4', type: EntityType.END_POINT, label: 'Seller A', shape: NodeShape.CIRCLE, position: { x: 800, y: 50 }, endPointType: EndPointType.MERCHANT, zIndex: 20, swimlaneId: 1 },
      { id: 't1-5', type: EntityType.END_POINT, label: 'Seller B', shape: NodeShape.CIRCLE, position: { x: 800, y: 250 }, endPointType: EndPointType.MERCHANT, zIndex: 20, swimlaneId: 1 },
    ],
    edges: [
      { id: 'e1-1', sourceId: 't1-1', targetId: 't1-2', sourcePortIdx: 1, targetPortIdx: 3, rail: PaymentRail.CARD_NETWORK, direction: FlowDirection.PUSH, label: 'Purchase', isFX: false, style: 'solid', showArrowHead: true, thickness: 2, pathType: 'bezier' },
      { id: 'e1-2', sourceId: 't1-2', targetId: 't1-3', sourcePortIdx: 1, targetPortIdx: 3, rail: PaymentRail.ACH, direction: FlowDirection.SETTLEMENT, label: 'Net Settle', timing: 'T+1', isFX: false, style: 'dashed', showArrowHead: true, thickness: 2, pathType: 'bezier' },
      { id: 'e1-3', sourceId: 't1-3', targetId: 't1-4', sourcePortIdx: 1, targetPortIdx: 3, rail: PaymentRail.RTP, direction: FlowDirection.PUSH, label: 'Payout', isFX: false, style: 'solid', showArrowHead: true, thickness: 2, pathType: 'bezier' },
      { id: 'e1-4', sourceId: 't1-3', targetId: 't1-5', sourcePortIdx: 1, targetPortIdx: 3, rail: PaymentRail.RTP, direction: FlowDirection.PUSH, label: 'Payout', isFX: false, style: 'solid', showArrowHead: true, thickness: 2, pathType: 'bezier' },
    ],
    drawings: []
  },
  'crypto': {
    nodes: [
      { id: 't2-1', type: EntityType.END_POINT, label: 'User', shape: NodeShape.CIRCLE, position: { x: 50, y: 150 }, endPointType: EndPointType.CONSUMER, zIndex: 20, swimlaneId: 1 },
      { id: 't2-2', type: EntityType.SPONSOR_BANK, label: 'Fiat Ramp', shape: NodeShape.RECTANGLE, position: { x: 300, y: 150 }, zIndex: 20, swimlaneId: 1 },
      { id: 't2-3', type: EntityType.LIQUIDITY_PROVIDER, label: 'Exchange', shape: NodeShape.RECTANGLE, position: { x: 550, y: 150 }, zIndex: 20, swimlaneId: 1 },
      { id: 't2-4', type: EntityType.WALLET_PROVIDER, label: 'Self-Custody', shape: NodeShape.RECTANGLE, position: { x: 800, y: 150 }, zIndex: 20, swimlaneId: 1 },
    ],
    edges: [
      { id: 'e2-1', sourceId: 't2-1', targetId: 't2-2', sourcePortIdx: 1, targetPortIdx: 3, rail: PaymentRail.ACH, direction: FlowDirection.PULL, label: 'Deposit', isFX: false, style: 'solid', showArrowHead: true, thickness: 2, pathType: 'bezier' },
      { id: 'e2-2', sourceId: 't2-2', targetId: 't2-3', sourcePortIdx: 1, targetPortIdx: 3, rail: PaymentRail.INTERNAL_LEDGER, direction: FlowDirection.PUSH, label: 'Mint USD', isFX: false, style: 'dashed', showArrowHead: true, thickness: 2, pathType: 'bezier' },
      { id: 'e2-3', sourceId: 't2-3', targetId: 't2-4', sourcePortIdx: 1, targetPortIdx: 3, rail: PaymentRail.STABLECOIN, direction: FlowDirection.PUSH, label: 'Withdraw USDC', isFX: false, style: 'solid', showArrowHead: true, thickness: 2, pathType: 'bezier' },
    ],
    drawings: []
  }
};


const cloneSnapshot = (snapshot: DiagramSnapshot): DiagramSnapshot => ({
  nodes: snapshot.nodes.map((node) => ({
    ...node,
    position: { ...node.position }
  })),
  edges: snapshot.edges.map((edge) => ({ ...edge })),
  drawings: snapshot.drawings.map((drawing) => ({
    ...drawing,
    points: drawing.points.map((point) => ({ ...point }))
  }))
});

const ENTITY_TYPE_VALUES = new Set(Object.values(EntityType));
const NODE_SHAPE_VALUES = new Set(Object.values(NodeShape));
const BANK_ACCOUNT_TYPE_VALUES = new Set(Object.values(BankAccountType));
const ENDPOINT_TYPE_VALUES = new Set(Object.values(EndPointType));
const GATE_CATEGORY_VALUES = new Set(Object.values(GateCategory));
const GATE_CONTROL_VALUES = new Set(Object.values(GateControl));
const CARD_NETWORK_VALUES = new Set(Object.values(CardNetwork));
const SETTLEMENT_TYPE_VALUES = new Set(Object.values(SettlementType));
const LIFECYCLE_VALUES = new Set(Object.values(TransactionLifecycle));
const FLOW_DIRECTION_VALUES = new Set(Object.values(FlowDirection));
const PAYMENT_RAIL_VALUES = new Set(Object.values(PaymentRail));
const TIMING_VALUES = new Set(Object.values(TimingType));
const CURRENCY_PAIR_VALUES = new Set(Object.values(CurrencyPair));
const CONNECTOR_PRESET_VALUES = new Set(Object.keys(CONNECTOR_PRESETS) as ConnectorPresetKey[]);

const isBankNodeType = (type: EntityType) => BANK_ENTITY_TYPES.includes(type);

const mapLegacyAccountType = (value: unknown): BankAccountType | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  if (normalized.includes('fbo')) return BankAccountType.FBO;
  if (normalized.includes('settlement')) return BankAccountType.SETTLEMENT;
  if (normalized.includes('treasury') || normalized.includes('omnibus')) return BankAccountType.TREASURY;
  if (normalized.includes('operating')) return BankAccountType.OPERATING;
  if (normalized.includes('prefund')) return BankAccountType.PREFUND;
  if (normalized.includes('custodial')) return BankAccountType.CUSTODIAL;
  if (normalized.includes('trust')) return BankAccountType.TRUST;
  return undefined;
};

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const toNumber = (value: unknown, fallback = 0) => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const toPortIndex = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 3 ? n : fallback;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const sanitizeNode = (raw: any, index: number): Node | null => {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createId(`node-${index}`);
  const type = ENTITY_TYPE_VALUES.has(raw.type) ? (raw.type as EntityType) : null;
  if (!type) return null;

  const position = isRecord(raw.position)
    ? { x: toNumber(raw.position.x), y: toNumber(raw.position.y) }
    : null;
  if (!position) return null;

  const shape = NODE_SHAPE_VALUES.has(raw.shape)
    ? (raw.shape as NodeShape)
    : NodeShape.RECTANGLE;

  const node: Node = {
    id,
    type,
    label: typeof raw.label === 'string' ? raw.label : type,
    shape,
    position,
    zIndex: toNumber(raw.zIndex, 10),
    swimlaneId: Math.floor(Math.max(0, position.y) / 300) + 1
  };

  if (typeof raw.color === 'string') node.color = raw.color;
  if (typeof raw.borderColor === 'string') node.borderColor = raw.borderColor;
  if (typeof raw.description === 'string') node.description = raw.description;
  if (typeof raw.fontSize === 'number') node.fontSize = raw.fontSize;
  if (typeof raw.width === 'number') node.width = raw.width;
  if (typeof raw.height === 'number') node.height = raw.height;
  if (typeof raw.isPhantom === 'boolean') node.isPhantom = raw.isPhantom;
  if (raw.endPointType && ENDPOINT_TYPE_VALUES.has(raw.endPointType as EndPointType)) {
    node.endPointType = raw.endPointType as EndPointType;
  }

  if (isBankNodeType(type)) {
    const accountTypes = new Set<BankAccountType>();
    if (Array.isArray(raw.accountTypes)) {
      raw.accountTypes.forEach((value: unknown) => {
        if (BANK_ACCOUNT_TYPE_VALUES.has(value as BankAccountType)) {
          accountTypes.add(value as BankAccountType);
        }
      });
    }
    const mapped = mapLegacyAccountType(raw.accountType);
    if (mapped) accountTypes.add(mapped);
    node.accountTypes = Array.from(accountTypes);
    if (typeof raw.ownerOfRecord === 'string') node.ownerOfRecord = raw.ownerOfRecord;
    if (typeof raw.beneficialOwner === 'string') node.beneficialOwner = raw.beneficialOwner;
    if (typeof raw.onBalanceSheet === 'boolean') node.onBalanceSheet = raw.onBalanceSheet;
    if (typeof raw.accessRights === 'string') node.accessRights = raw.accessRights;
    if (typeof raw.reconciliationOwner === 'string') node.reconciliationOwner = raw.reconciliationOwner;
  }

  if (type === EntityType.GATE) {
    if (raw.gateCategory && GATE_CATEGORY_VALUES.has(raw.gateCategory as GateCategory)) {
      node.gateCategory = raw.gateCategory as GateCategory;
    }
    if (Array.isArray(raw.gateChecks)) {
      const checks = raw.gateChecks.filter((value: unknown) =>
        GATE_CONTROL_VALUES.has(value as GateControl)
      ) as GateControl[];
      node.gateChecks = Array.from(new Set(checks));
    } else if (node.gateCategory) {
      node.gateChecks = [...GATE_CONTROLS_BY_CATEGORY[node.gateCategory]];
    }
    if (typeof raw.width === 'number' && Number.isFinite(raw.width)) {
      node.width = raw.width;
    } else {
      node.width = 132;
    }
    if (typeof raw.height === 'number' && Number.isFinite(raw.height)) {
      node.height = raw.height;
    } else {
      node.height = 36;
    }
  }

  return normalizeNodeFields(node);
};

const sanitizeEdge = (raw: any, index: number): Edge | null => {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : createId(`edge-${index}`);
  const sourceId = typeof raw.sourceId === 'string' && raw.sourceId.trim() ? raw.sourceId.trim() : null;
  const targetId = typeof raw.targetId === 'string' && raw.targetId.trim() ? raw.targetId.trim() : null;
  if (!sourceId || !targetId) return null;

  const edge: Edge = {
    id,
    sourceId,
    targetId,
    sourcePortIdx: toPortIndex(raw.sourcePortIdx, 1),
    targetPortIdx: toPortIndex(raw.targetPortIdx, 3),
    rail: PAYMENT_RAIL_VALUES.has(raw.rail) ? (raw.rail as PaymentRail) : PaymentRail.BLANK,
    direction: FLOW_DIRECTION_VALUES.has(raw.direction) ? (raw.direction as FlowDirection) : FlowDirection.PUSH,
    label: typeof raw.label === 'string' ? raw.label : '',
    isFX: Boolean(raw.isFX),
    style: raw.style === 'dashed' || raw.style === 'dotted' ? raw.style : 'solid',
    showArrowHead: typeof raw.showArrowHead === 'boolean' ? raw.showArrowHead : true,
    showStartArrow: typeof raw.showStartArrow === 'boolean' ? raw.showStartArrow : false,
    showMidArrow: typeof raw.showMidArrow === 'boolean' ? raw.showMidArrow : false,
    thickness: typeof raw.thickness === 'number' ? raw.thickness : 2,
    pathType: raw.pathType === 'orthogonal' || raw.pathType === 'straight' ? raw.pathType : 'bezier',
    connectorPreset: CONNECTOR_PRESET_VALUES.has(raw.connectorPreset)
      ? (raw.connectorPreset as ConnectorPresetKey)
      : 'custom'
  };

  if (typeof raw.color === 'string') edge.color = raw.color;
  if (raw.settlementType && SETTLEMENT_TYPE_VALUES.has(raw.settlementType as SettlementType)) {
    edge.settlementType = raw.settlementType as SettlementType;
  }
  if (raw.lifecycle && LIFECYCLE_VALUES.has(raw.lifecycle as TransactionLifecycle)) {
    edge.lifecycle = raw.lifecycle as TransactionLifecycle;
  }
  if (raw.cardNetwork && CARD_NETWORK_VALUES.has(raw.cardNetwork as CardNetwork)) {
    edge.cardNetwork = raw.cardNetwork as CardNetwork;
  }
  if (typeof raw.customRailLabel === 'string') edge.customRailLabel = raw.customRailLabel;
  if (typeof raw.amount === 'string') edge.amount = raw.amount;
  if (typeof raw.timing === 'string' && (TIMING_VALUES.has(raw.timing as TimingType) || raw.timing.length > 0)) edge.timing = raw.timing;
  if (typeof raw.settlementTiming === 'string') edge.settlementTiming = raw.settlementTiming;
  if (typeof raw.netting === 'string') edge.netting = raw.netting;
  if (typeof raw.currency === 'string') edge.currency = raw.currency.toUpperCase();
  if (typeof raw.finality === 'string') edge.finality = raw.finality;
  if (typeof raw.cutoffDependency === 'string') edge.cutoffDependency = raw.cutoffDependency;
  if (typeof raw.riskOwner === 'string') edge.riskOwner = raw.riskOwner;
  if (typeof raw.fraudLiabilityOwner === 'string') edge.fraudLiabilityOwner = raw.fraudLiabilityOwner;
  if (typeof raw.chargebackExposure === 'string') edge.chargebackExposure = raw.chargebackExposure;
  if (typeof raw.disputeWindow === 'string') edge.disputeWindow = raw.disputeWindow;
  if (typeof raw.dataExchanged === 'string') edge.dataExchanged = raw.dataExchanged;
  if (typeof raw.dataLatency === 'string') edge.dataLatency = raw.dataLatency;
  if (typeof raw.systemOfRecord === 'string') edge.systemOfRecord = raw.systemOfRecord;
  if (typeof raw.showDetailsOnCanvas === 'boolean') edge.showDetailsOnCanvas = raw.showDetailsOnCanvas;
  if (typeof raw.dataSchema === 'string') edge.dataSchema = raw.dataSchema;
  if (typeof raw.velocityLimit === 'string') edge.velocityLimit = raw.velocityLimit;
  if (typeof raw.volumeLimit === 'string') edge.volumeLimit = raw.volumeLimit;
  if (typeof raw.description === 'string') edge.description = raw.description;
  if (typeof raw.sourceCurrency === 'string') edge.sourceCurrency = raw.sourceCurrency.toUpperCase();
  if (typeof raw.targetCurrency === 'string') edge.targetCurrency = raw.targetCurrency.toUpperCase();
  if (raw.fxPair && CURRENCY_PAIR_VALUES.has(raw.fxPair as CurrencyPair)) {
    edge.fxPair = raw.fxPair as CurrencyPair;
  }

  return normalizeEdgeFields(edge);
};

const edgesEquivalent = (a: Edge, b: Edge) => {
  return (
    a.sourceId === b.sourceId &&
    a.targetId === b.targetId &&
    a.sourcePortIdx === b.sourcePortIdx &&
    a.targetPortIdx === b.targetPortIdx &&
    a.rail === b.rail &&
    a.direction === b.direction &&
    a.style === b.style &&
    a.pathType === b.pathType &&
    (a.color || '') === (b.color || '') &&
    (a.timing || '') === (b.timing || '') &&
    (a.settlementType || '') === (b.settlementType || '') &&
    (a.lifecycle || '') === (b.lifecycle || '') &&
    !!a.showArrowHead === !!b.showArrowHead &&
    !!a.showStartArrow === !!b.showStartArrow &&
    !!a.showMidArrow === !!b.showMidArrow &&
    !!a.isFX === !!b.isFX &&
    (a.sourceCurrency || '') === (b.sourceCurrency || '') &&
    (a.targetCurrency || '') === (b.targetCurrency || '')
  );
};

const normalizeEdgeFields = (edge: Edge): Edge => {
  const normalized: Edge = { ...edge };
  if (!normalized.settlementTiming && normalized.timing) {
    normalized.settlementTiming = normalized.timing;
  }
  if (!normalized.timing && normalized.settlementTiming) {
    normalized.timing = normalized.settlementTiming;
  }
  if (normalized.rail !== PaymentRail.CARD_NETWORK) {
    normalized.cardNetwork = undefined;
  }
  if (normalized.rail !== PaymentRail.OTHER) {
    normalized.customRailLabel = undefined;
  }
  if (!normalized.isFX) {
    normalized.sourceCurrency = undefined;
    normalized.targetCurrency = undefined;
    normalized.fxPair = undefined;
  }
  if (normalized.currency) {
    normalized.currency = normalized.currency.toUpperCase();
  }
  return normalized;
};

const normalizeNodeFields = (node: Node): Node => {
  const normalized: Node = { ...node };
  if (normalized.type === EntityType.GATE) {
    normalized.shape = NodeShape.RECTANGLE;
    if (!normalized.width) normalized.width = 132;
    if (!normalized.height) normalized.height = 36;
  }

  if (isBankNodeType(normalized.type)) {
    const accountTypes = (normalized.accountTypes || []).filter((type) =>
      BANK_ACCOUNT_TYPE_VALUES.has(type)
    );
    normalized.accountTypes = Array.from(new Set(accountTypes));
  } else {
    normalized.accountTypes = undefined;
    normalized.ownerOfRecord = undefined;
    normalized.beneficialOwner = undefined;
    normalized.onBalanceSheet = undefined;
    normalized.accessRights = undefined;
    normalized.reconciliationOwner = undefined;
  }

  if (normalized.type !== EntityType.GATE) {
    normalized.gateCategory = undefined;
    normalized.gateChecks = undefined;
  }
  return normalized;
};

const getNodeDimensions = (node: Pick<Node, 'type' | 'shape' | 'width' | 'height'>) => {
  if (node.type === EntityType.GATE) {
    return {
      width: node.width ?? 132,
      height: node.height ?? 36
    };
  }
  if (node.shape === NodeShape.CIRCLE) {
    return {
      width: node.width ?? 80,
      height: node.height ?? 80
    };
  }
  if (node.shape === NodeShape.DIAMOND) {
    return {
      width: node.width ?? 100,
      height: node.height ?? 100
    };
  }
  return {
    width: node.width ?? 180,
    height: node.height ?? 60
  };
};

const boxesOverlap = (
  aPos: { x: number; y: number },
  aSize: { width: number; height: number },
  bPos: { x: number; y: number },
  bSize: { width: number; height: number },
  padding = 16
) => {
  return !(
    aPos.x + aSize.width + padding <= bPos.x ||
    bPos.x + bSize.width + padding <= aPos.x ||
    aPos.y + aSize.height + padding <= bPos.y ||
    bPos.y + bSize.height + padding <= aPos.y
  );
};

const resolveNodePosition = (
  candidate: Pick<Node, 'id' | 'type' | 'shape' | 'width' | 'height'> & { position: { x: number; y: number } },
  existingNodes: Node[]
) => {
  const candidateSize = getNodeDimensions(candidate);
  const origin = { ...candidate.position };
  let resolved = { ...candidate.position };

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const collision = existingNodes.find((other) => {
      if (other.id === candidate.id) return false;
      return boxesOverlap(resolved, candidateSize, other.position, getNodeDimensions(other), 16);
    });

    if (!collision) return resolved;

    const otherSize = getNodeDimensions(collision);
    resolved = {
      x: collision.position.x + otherSize.width + 20,
      y: resolved.y
    };

    if (attempt % 4 === 3) {
      resolved = { x: origin.x, y: resolved.y + 28 };
    }
  }
  return resolved;
};

const sanitizeSnapshot = (data: unknown): DiagramSnapshot | null => {
  if (!data || typeof data !== 'object') return null;
  const snapshot = data as { nodes?: unknown; edges?: unknown; drawings?: unknown };
  if (!Array.isArray(snapshot.nodes) || !Array.isArray(snapshot.edges)) return null;

  const nodeMap = new Map<string, Node>();
  snapshot.nodes.forEach((raw: any, idx: number) => {
    const sanitized = sanitizeNode(raw, idx);
    if (sanitized && !nodeMap.has(sanitized.id)) {
      nodeMap.set(sanitized.id, sanitized);
    }
  });
  const nodes = Array.from(nodeMap.values());
  const nodeIds = new Set(nodes.map((n) => n.id));

  const edgeMap = new Map<string, Edge>();
  snapshot.edges.forEach((raw: any, idx: number) => {
    const sanitized = sanitizeEdge(raw, idx);
    if (!sanitized) return;
    if (!nodeIds.has(sanitized.sourceId) || !nodeIds.has(sanitized.targetId)) return;
    if (!edgeMap.has(sanitized.id)) {
      edgeMap.set(sanitized.id, sanitized);
    }
  });
  const edges = Array.from(edgeMap.values());

  const drawings = Array.isArray(snapshot.drawings)
    ? snapshot.drawings
        .filter((d: any) => d && typeof d.id === 'string' && Array.isArray(d.points))
        .map((d: any, idx: number) => ({
          id: d.id || createId(`path-${idx}`),
          color: typeof d.color === 'string' ? d.color : '#6366f1',
          width: typeof d.width === 'number' && Number.isFinite(d.width) ? d.width : 2,
          points: d.points
            .filter((p: any) => p && Number.isFinite(p.x) && Number.isFinite(p.y))
            .map((p: any) => ({ x: p.x, y: p.y }))
        }))
        .filter((d: DrawingPath) => d.points.length > 1)
    : [];

  return { nodes, edges, drawings };
};

const App: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [drawings, setDrawings] = useState<DrawingPath[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showPorts, setShowPorts] = useState(true);
  const [activeTool, setActiveTool] = useState<'select' | 'draw' | 'text'>('select');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportCaptureMode, setIsExportCaptureMode] = useState(false);

  // New Modals
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [welcomeStep, setWelcomeStep] = useState<'main' | 'templates'>('main');
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  const [gridMode, setGridMode] = useState<'dots' | 'lines' | 'none'>('dots');
  const [showSwimlanes, setShowSwimlanes] = useState(false);
  const [swimlaneCount, setSwimlaneCount] = useState(3);
  const [blurData, setBlurData] = useState(false);
  
  // VIEWPORT (PAN/ZOOM)
  const [viewport, setViewport] = useState<ViewportTransform>({ x: 0, y: 0, zoom: 1 });

  // --- STYLE STATE (TOOLBAR) ---
  const [activeColor, setActiveColor] = useState<string>('#64748b');
  const [activeLineStyle, setActiveLineStyle] = useState<'solid' | 'dashed' | 'dotted'>('solid');
  
  // NEW: 4-Way Arrow Control state
  const [activeArrowDirection, setActiveArrowDirection] = useState<'forward' | 'reverse' | 'both' | 'none'>('forward');
  
  const [activePathType, setActivePathType] = useState<'bezier' | 'orthogonal' | 'straight'>('bezier');
  const [recentColors, setRecentColors] = useState<string[]>([]);
  
  const [past, setPast] = useState<DiagramSnapshot[]>([]);
  const [future, setFuture] = useState<DiagramSnapshot[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasHydratedRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const diagramExportRef = useRef<HTMLDivElement | null>(null);
  const persistenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastNodeHistoryRef = useRef<{ id: string; at: number } | null>(null);
  const lastEdgeHistoryRef = useRef<{ id: string; at: number } | null>(null);
  const selectionClipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const pasteCounterRef = useRef(0);

  const shouldPushEntityHistory = useCallback(
    (kind: 'node' | 'edge', id: string, windowMs = 250) => {
      const now = Date.now();
      const ref = kind === 'node' ? lastNodeHistoryRef : lastEdgeHistoryRef;
      const prev = ref.current;
      if (!prev || prev.id !== id || now - prev.at > windowMs) {
        ref.current = { id, at: now };
        return true;
      }
      return false;
    },
    []
  );

  const getCurrentSnapshot = useCallback(
    (): DiagramSnapshot =>
      cloneSnapshot({
        nodes,
        edges,
        drawings
      }),
    [nodes, edges, drawings]
  );

  const applySnapshot = useCallback((snapshot: DiagramSnapshot) => {
    const safe = cloneSnapshot(snapshot);
    setNodes(safe.nodes);
    setEdges(safe.edges);
    setDrawings(safe.drawings);
  }, []);

  const pushHistory = useCallback(() => {
    const current = getCurrentSnapshot();
    setPast((prev) => [...prev.slice(-(HISTORY_LIMIT - 1)), current]);
    setFuture([]);
  }, [getCurrentSnapshot]);

  const getEffectiveSelectedNodeIds = useCallback(() => {
    if (selectedNodeIds.length > 0) return selectedNodeIds;
    return selectedNodeId ? [selectedNodeId] : [];
  }, [selectedNodeId, selectedNodeIds]);

  const bumpNodeToFront = useCallback((id: string) => {
    setNodes((prev) => {
      const maxZ = Math.max(...prev.map((n) => n.zIndex || 10), 10);
      return prev.map((n) => (n.id === id ? { ...n, zIndex: maxZ + 1 } : n));
    });
  }, []);

  const handleSelectNode = useCallback((id: string | null) => {
    setSelectedEdgeId(null);
    if (!id) {
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setIsInspectorOpen(false);
      return;
    }
    setSelectedNodeId(id);
    setSelectedNodeIds([id]);
    bumpNodeToFront(id);
    setIsInspectorOpen(true);
  }, [bumpNodeToFront]);

  const handleToggleNodeSelection = useCallback((id: string) => {
    setSelectedEdgeId(null);
    const base = selectedNodeIds.length > 0 ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : [];
    const nextSet = new Set(base);
    if (nextSet.has(id)) {
      nextSet.delete(id);
    } else {
      nextSet.add(id);
    }
    const next = Array.from(nextSet);
    setSelectedNodeIds(next);
    setSelectedNodeId(next.length === 1 ? next[0] : null);
    setIsInspectorOpen(next.length === 1);
    bumpNodeToFront(id);
  }, [bumpNodeToFront, selectedNodeId, selectedNodeIds]);

  const applySelectionPositionsWithCollisionResolution = useCallback(
    (positions: Map<string, { x: number; y: number }>) => {
      if (positions.size === 0) return;
      const selectedSet = new Set(Array.from(positions.keys()));
      setNodes((prev) => {
        const stationaryNodes = prev.filter((node) => !selectedSet.has(node.id));
        const selectedNodesInRenderOrder = prev.filter((node) => selectedSet.has(node.id));
        const placedNodes: Node[] = [...stationaryNodes];
        const resolvedById = new Map<string, { x: number; y: number }>();

        selectedNodesInRenderOrder.forEach((node) => {
          const target = positions.get(node.id) || node.position;
          const candidate = normalizeNodeFields({ ...node, position: target });
          const resolved = resolveNodePosition(candidate, placedNodes);
          resolvedById.set(node.id, resolved);
          placedNodes.push({ ...candidate, position: resolved });
        });

        return prev.map((node) => {
          const nextPos = resolvedById.get(node.id);
          if (!nextPos) return node;
          return {
            ...node,
            position: nextPos,
            swimlaneId: Math.floor(Math.max(0, nextPos.y) / 300) + 1
          };
        });
      });
    },
    []
  );

  const handleAlignSelection = useCallback((mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const selectedIds = getEffectiveSelectedNodeIds();
    if (selectedIds.length < 2) return;
    const selectedSet = new Set(selectedIds);
    const selectedNodes = nodes.filter((n) => selectedSet.has(n.id));
    if (selectedNodes.length < 2) return;

    pushHistory();
    const positions = new Map<string, Position>();
    const boxes = selectedNodes.map((node) => {
      const size = getNodeDimensions(node);
      return {
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        width: size.width,
        height: size.height,
        cx: node.position.x + size.width / 2,
        cy: node.position.y + size.height / 2,
        right: node.position.x + size.width,
        bottom: node.position.y + size.height
      };
    });

    if (mode === 'left') {
      const target = Math.min(...boxes.map((b) => b.x));
      boxes.forEach((b) => positions.set(b.id, { x: target, y: b.y }));
    } else if (mode === 'center') {
      const target = boxes.reduce((sum, b) => sum + b.cx, 0) / boxes.length;
      boxes.forEach((b) => positions.set(b.id, { x: target - b.width / 2, y: b.y }));
    } else if (mode === 'right') {
      const target = Math.max(...boxes.map((b) => b.right));
      boxes.forEach((b) => positions.set(b.id, { x: target - b.width, y: b.y }));
    } else if (mode === 'top') {
      const target = Math.min(...boxes.map((b) => b.y));
      boxes.forEach((b) => positions.set(b.id, { x: b.x, y: target }));
    } else if (mode === 'middle') {
      const target = boxes.reduce((sum, b) => sum + b.cy, 0) / boxes.length;
      boxes.forEach((b) => positions.set(b.id, { x: b.x, y: target - b.height / 2 }));
    } else if (mode === 'bottom') {
      const target = Math.max(...boxes.map((b) => b.bottom));
      boxes.forEach((b) => positions.set(b.id, { x: b.x, y: target - b.height }));
    }

    applySelectionPositionsWithCollisionResolution(positions);
  }, [applySelectionPositionsWithCollisionResolution, getEffectiveSelectedNodeIds, nodes, pushHistory]);

  const handleDistributeSelection = useCallback((axis: 'horizontal' | 'vertical') => {
    const selectedIds = getEffectiveSelectedNodeIds();
    if (selectedIds.length < 3) return;
    const selectedSet = new Set(selectedIds);
    const selectedNodes = nodes.filter((n) => selectedSet.has(n.id));
    if (selectedNodes.length < 3) return;

    const boxes = selectedNodes
      .map((node) => {
        const size = getNodeDimensions(node);
        return {
          id: node.id,
          x: node.position.x,
          y: node.position.y,
          width: size.width,
          height: size.height,
          cx: node.position.x + size.width / 2,
          cy: node.position.y + size.height / 2
        };
      })
      .sort((a, b) => (axis === 'horizontal' ? a.cx - b.cx : a.cy - b.cy));
    if (boxes.length < 3) return;

    pushHistory();
    const first = axis === 'horizontal' ? boxes[0].cx : boxes[0].cy;
    const last = axis === 'horizontal' ? boxes[boxes.length - 1].cx : boxes[boxes.length - 1].cy;
    const step = (last - first) / (boxes.length - 1);
    const positions = new Map<string, Position>();

    boxes.forEach((box, index) => {
      if (index === 0 || index === boxes.length - 1) {
        positions.set(box.id, { x: box.x, y: box.y });
        return;
      }
      if (axis === 'horizontal') {
        const cx = first + step * index;
        positions.set(box.id, { x: cx - box.width / 2, y: box.y });
      } else {
        const cy = first + step * index;
        positions.set(box.id, { x: box.x, y: cy - box.height / 2 });
      }
    });

    applySelectionPositionsWithCollisionResolution(positions);
  }, [applySelectionPositionsWithCollisionResolution, getEffectiveSelectedNodeIds, nodes, pushHistory]);

  const handleCopySelection = useCallback(() => {
    const selectedIds = getEffectiveSelectedNodeIds();
    if (selectedIds.length === 0) return;
    const selectedSet = new Set(selectedIds);
    const selectedNodes = nodes.filter((node) => selectedSet.has(node.id));
    if (selectedNodes.length === 0) return;
    const selectedEdges = edges.filter(
      (edge) => selectedSet.has(edge.sourceId) && selectedSet.has(edge.targetId)
    );
    selectionClipboardRef.current = {
      nodes: selectedNodes.map((node) => ({ ...node, position: { ...node.position } })),
      edges: selectedEdges.map((edge) => ({ ...edge }))
    };
  }, [edges, getEffectiveSelectedNodeIds, nodes]);

  const handlePasteSelection = useCallback(() => {
    const clipboard = selectionClipboardRef.current;
    if (!clipboard || clipboard.nodes.length === 0) return;

    pushHistory();
    pasteCounterRef.current += 1;
    const offset = 32 * pasteCounterRef.current;
    const idMap = new Map<string, string>();
    const existingNodes = [...nodes];
    const pastedNodes: Node[] = clipboard.nodes.map((rawNode) => {
      const nextId = createId('node');
      idMap.set(rawNode.id, nextId);
      const candidate = normalizeNodeFields({
        ...rawNode,
        id: nextId,
        position: {
          x: rawNode.position.x + offset,
          y: rawNode.position.y + offset
        },
        zIndex: (rawNode.zIndex || 10) + 1
      });
      const resolved = resolveNodePosition(candidate, [...existingNodes, ...pastedNodes]);
      return {
        ...candidate,
        position: resolved,
        swimlaneId: Math.floor(Math.max(0, resolved.y) / 300) + 1
      };
    });

    const pastedEdges: Edge[] = clipboard.edges
      .map((rawEdge, index) =>
        sanitizeEdge(
          {
            ...rawEdge,
            id: createId(`edge-${index}`),
            sourceId: idMap.get(rawEdge.sourceId),
            targetId: idMap.get(rawEdge.targetId)
          },
          index
        )
      )
      .filter((edge): edge is Edge => !!edge);

    setNodes((prev) => [...prev, ...pastedNodes]);
    setEdges((prev) => [...prev, ...pastedEdges]);
    setSelectedEdgeId(null);
    const pastedIds = pastedNodes.map((node) => node.id);
    setSelectedNodeIds(pastedIds);
    setSelectedNodeId(pastedIds.length === 1 ? pastedIds[0] : null);
    setIsInspectorOpen(pastedIds.length === 1);
  }, [nodes, pushHistory]);

  const handleDuplicateSelection = useCallback(() => {
    handleCopySelection();
    handlePasteSelection();
  }, [handleCopySelection, handlePasteSelection]);

  const handleNodeDragStart = useCallback((id: string) => {
    pushHistory();
    // Bump Z-Index on drag start
    setNodes(prev => {
        const maxZ = Math.max(...prev.map(n => n.zIndex || 10), 10);
        return prev.map(n => n.id === id ? { ...n, zIndex: maxZ + 1 } : n);
    });
  }, [pushHistory]);

  const handleNodeDragEnd = useCallback((id: string) => {
    setNodes((prev) => {
      const node = prev.find((n) => n.id === id);
      if (!node) return prev;
      const others = prev.filter((n) => n.id !== id);
      const resolved = resolveNodePosition(node, others);
      return prev.map((n) =>
        n.id === id
          ? {
              ...n,
              position: resolved,
              swimlaneId: Math.floor(Math.max(0, resolved.y) / 300) + 1
            }
          : n
      );
    });
  }, []);

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const current = getCurrentSnapshot();
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [current, ...prev.slice(0, HISTORY_LIMIT - 1)]);
    applySnapshot(previous);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
  }, [past, getCurrentSnapshot, applySnapshot]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    const current = getCurrentSnapshot();
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev.slice(-(HISTORY_LIMIT - 1)), current]);
    applySnapshot(next);
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setSelectedEdgeId(null);
  }, [future, getCurrentSnapshot, applySnapshot]);

  // --- STYLE HANDLERS ---
  const handleColorChange = useCallback((color: string) => {
      setActiveColor(color);
      setRecentColors(prev => [color, ...prev.filter(c => c !== color)].slice(0, 5));
      if (selectedEdgeId) {
          pushHistory();
          setEdges(prev => prev.map(e => e.id === selectedEdgeId ? { ...e, color } : e));
      }
  }, [selectedEdgeId, pushHistory]);

  const handleLineStyleChange = useCallback((style: 'solid' | 'dashed' | 'dotted') => {
      setActiveLineStyle(style);
      if (selectedEdgeId) {
          pushHistory();
          setEdges(prev => prev.map(e => e.id === selectedEdgeId ? { ...e, style } : e));
      }
  }, [selectedEdgeId, pushHistory]);

  // Updated Arrow Handler for 4 directions
  const handleArrowDirectionChange = useCallback((direction: 'forward' | 'reverse' | 'both' | 'none') => {
      setActiveArrowDirection(direction);
      if (selectedEdgeId) {
          pushHistory();
          setEdges(prev => prev.map(e => {
              if (e.id !== selectedEdgeId) return e;
              return { 
                  ...e, 
                  showStartArrow: direction === 'reverse' || direction === 'both',
                  showArrowHead: direction === 'forward' || direction === 'both'
              };
          }));
      }
  }, [selectedEdgeId, pushHistory]);

  const handlePathTypeChange = useCallback((type: 'bezier' | 'orthogonal' | 'straight') => {
      setActivePathType(type);
      if (selectedEdgeId) {
          pushHistory();
          setEdges(prev => prev.map(e => e.id === selectedEdgeId ? { ...e, pathType: type } : e));
      }
  }, [selectedEdgeId, pushHistory]);

  // SMART CONNECTOR FACTORY
  const createEdgeWithDefaults = useCallback(
    (params: { sourceId: string; targetId: string; sourcePortIdx: number; targetPortIdx: number; label?: string; overrides?: Partial<Edge> }) => {
      
      const baseEdge: Edge = {
        id: createId('edge'),
        sourceId: params.sourceId,
        targetId: params.targetId,
        sourcePortIdx: params.sourcePortIdx,
        targetPortIdx: params.targetPortIdx,
        direction: FlowDirection.PUSH, // Default push
        label: params.label ?? '',
        isFX: false,
        timing: TimingType.SAME_DAY,
        settlementTiming: TimingType.SAME_DAY,
        showDetailsOnCanvas: false,
        
        // Visual Defaults from Toolbar
        rail: PaymentRail.BLANK, 
        style: activeLineStyle,
        color: activeColor,
        // Map activeDirection to boolean flags
        showStartArrow: activeArrowDirection === 'reverse' || activeArrowDirection === 'both',
        showArrowHead: activeArrowDirection === 'forward' || activeArrowDirection === 'both',
        showMidArrow: false,
        
        thickness: 2,
        pathType: activePathType,
        connectorPreset: 'custom',
        
        ...params.overrides
      };

      return normalizeEdgeFields(baseEdge);
    },
    [activeColor, activeLineStyle, activeArrowDirection, activePathType]
  );

  const handleAddNode = useCallback((type: EntityType, pos?: { x: number; y: number }) => {
    pushHistory();
    setNodes((prev) => {
      const existingOfSameLabel = prev.filter((n) => n.label.startsWith(type));
      let label: string = type;
      if (existingOfSameLabel.length > 0) {
        label = `${type} (${existingOfSameLabel.length})`;
      }

      // Smart positioning: If no position provided (Click from Sidebar), place in center of current visible area
      let finalPos = pos;
      if (!finalPos) {
          // Account for sidebar offset
          const sidebarOffset = isSidebarOpen ? 256 : 0;
          const availableWidth = window.innerWidth - sidebarOffset;
          
          // Calculate center relative to viewport transform
          // Center X = (ScreenCenter - ViewportX) / Zoom
          const centerX = ((availableWidth / 2 + sidebarOffset) - viewport.x) / viewport.zoom;
          const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom;
          
          finalPos = { 
            x: centerX - 90 + (Math.random() * 40 - 20), // -90 to center node width 
            y: centerY - 30 + (Math.random() * 40 - 20)  // -30 to center node height
          };
      }

      // Calculate initial swimlane (simplified: 300px height per lane)
      const swimlaneId = Math.floor(Math.max(0, finalPos.y) / 300) + 1;

      // Z-Index: Top of stack
      const maxZ = Math.max(...prev.map(n => n.zIndex || 10), 10);

      const newNode: Node = {
        id: createId('node'),
        type,
        label,
        shape: NodeShape.RECTANGLE,
        position: finalPos,
        zIndex: maxZ + 1,
        swimlaneId: swimlaneId,
        width: type === EntityType.GATE ? 132 : undefined,
        height: type === EntityType.GATE ? 36 : undefined
      };
      const resolvedPosition = resolveNodePosition(newNode, prev);
      const normalizedNode = normalizeNodeFields({
        ...newNode,
        position: resolvedPosition,
        swimlaneId: Math.floor(Math.max(0, resolvedPosition.y) / 300) + 1
      });
      return [
        ...prev,
        normalizedNode
      ];
    });
    setActiveTool('select');
  }, [pushHistory, viewport, isSidebarOpen]);

  const handleAddConnectedNode = useCallback((sourceId: string, type: EntityType) => {
      const sourceNode = nodes.find(n => n.id === sourceId);
      if (!sourceNode) return;

      pushHistory();

      const existingOfSameLabel = nodes.filter((n) => n.label.startsWith(type));
      let label: string = type;
      if (existingOfSameLabel.length > 0) {
        label = `${type} (${existingOfSameLabel.length})`;
      }

      const maxZ = Math.max(...nodes.map(n => n.zIndex || 10), 10);

      // Create new node to the right
      const newNodeId = createId('node');
      const newNode: Node = {
        id: newNodeId,
        type: type, // Use the selected type
        label: label,
        shape: NodeShape.RECTANGLE,
        position: {
            x: sourceNode.position.x + 250, // 250px to the right
            y: sourceNode.position.y
        },
        zIndex: maxZ + 1,
        swimlaneId: sourceNode.swimlaneId, // Inherit swimlane
        width: type === EntityType.GATE ? 132 : undefined,
        height: type === EntityType.GATE ? 36 : undefined
      };
      const resolvedPosition = resolveNodePosition(newNode, nodes);
      const finalNode: Node = normalizeNodeFields({
        ...newNode,
        position: resolvedPosition,
        swimlaneId: Math.floor(Math.max(0, resolvedPosition.y) / 300) + 1
      });
      
      // Create connecting edge
      const newEdge = createEdgeWithDefaults({
        sourceId,
        targetId: newNodeId,
        sourcePortIdx: 1,
        targetPortIdx: 3,
        label: ''
      });

      setNodes(prev => [...prev, finalNode]);
      setEdges(prev => [...prev, newEdge]);
      
      // Select the new node to allow immediate editing
      setSelectedNodeId(newNodeId);
      setSelectedNodeIds([newNodeId]);
      setSelectedEdgeId(null);
      setIsInspectorOpen(true);
  }, [nodes, createEdgeWithDefaults, pushHistory]);

  const handleDuplicateNode = useCallback((sourceId: string) => {
      const sourceNode = nodes.find(n => n.id === sourceId);
      if (!sourceNode) return;
      pushHistory();

      const maxZ = Math.max(...nodes.map(n => n.zIndex || 10), 10);
      const newNodeId = createId('node');
      
      const newNode: Node = {
          ...sourceNode,
          id: newNodeId,
          label: `${sourceNode.label} (Copy)`,
          position: {
              x: sourceNode.position.x + 20,
              y: sourceNode.position.y + 20
          },
          zIndex: maxZ + 1
      };
      const resolvedPosition = resolveNodePosition(newNode, nodes);
      setNodes(prev => [...prev, normalizeNodeFields({ ...newNode, position: resolvedPosition })]);
      setSelectedNodeId(newNodeId);
      setSelectedNodeIds([newNodeId]);
  }, [nodes, pushHistory]);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!canvasRef.current) return;
    
    const type = event.dataTransfer.getData('application/finflow/type');
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert Screen Coords -> World Coords using Viewport
    const worldX = (x - viewport.x) / viewport.zoom;
    const worldY = (y - viewport.y) / viewport.zoom;

    // HANDLE NODE DROP
    if (Object.values(EntityType).includes(type as EntityType)) {
        // Center the node on the mouse: approx 180x60 node size
        const centeredX = worldX - 90; 
        const centeredY = worldY - 30;
        handleAddNode(type as EntityType, { x: centeredX, y: centeredY });
        return;
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
  };

  // Improved Persistence with Debounce
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<DiagramSnapshot>;
        if (Array.isArray(parsed.nodes) && Array.isArray(parsed.edges)) {
          const sanitized = sanitizeSnapshot(parsed);
          if (!sanitized || (sanitized.nodes.length === 0 && sanitized.edges.length === 0)) {
              setShowWelcomeModal(true);
          } else {
              applySnapshot(sanitized);
          }
        } else {
             setShowWelcomeModal(true);
        }
      } else {
          setShowWelcomeModal(true);
      }
    } catch (error) {
      console.error('Failed to restore saved diagram', error);
      setShowWelcomeModal(true);
    } finally {
      hasHydratedRef.current = true;
    }
  }, [applySnapshot]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    
    if (persistenceTimeoutRef.current) {
        clearTimeout(persistenceTimeoutRef.current);
    }

    persistenceTimeoutRef.current = setTimeout(() => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              nodes,
              edges,
              drawings
            })
          );
    }, 1000); // 1 second debounce

    return () => {
        if (persistenceTimeoutRef.current) {
            clearTimeout(persistenceTimeoutRef.current);
        }
    }
  }, [nodes, edges, drawings]);

  const loadTemplate = (templateId: string) => {
      if (TEMPLATES[templateId]) {
          const sanitized = sanitizeSnapshot(cloneSnapshot(TEMPLATES[templateId]));
          if (!sanitized) return;
          setNodes(sanitized.nodes);
          setEdges(sanitized.edges);
          setDrawings(sanitized.drawings);
          setSelectedNodeId(null);
          setSelectedNodeIds([]);
          setSelectedEdgeId(null);
          setShowWelcomeModal(false);
          setViewport({ x: 0, y: 0, zoom: 1 });
      }
  };

  // ... (Export helper functions same as before) ...
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadText = (content: string, filename: string, contentType: string) => {
    downloadBlob(new Blob([content], { type: contentType }), filename);
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = filename;
    anchor.click();
  };

  const buildExportPayload = useCallback(() => {
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      nodes,
      edges,
      drawings
    };
  }, [nodes, edges, drawings]);

  const toCsvRow = (fields: Array<string | number | boolean | null | undefined>) => {
    return fields
      .map((value) => {
        const raw = value == null ? '' : String(value);
        const escaped = raw.replace(/"/g, '""');
        return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
      })
      .join(',');
  };

  const handleExportJson = useCallback(() => {
    const payload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      nodes,
      edges,
      drawings
    };
    downloadText(JSON.stringify(payload, null, 2), 'finflow-diagram.json', 'application/json');
  }, [nodes, edges, drawings]);

  const handleExportNodesCsv = useCallback(() => {
    const header = toCsvRow([
      'id',
      'type',
      'label',
      'accountTypes',
      'endPointType',
      'gateCategory',
      'gateChecks',
      'ownerOfRecord',
      'beneficialOwner',
      'onBalanceSheet',
      'accessRights',
      'reconciliationOwner',
      'shape',
      'x',
      'y',
      'width',
      'height',
      'color',
      'description',
      'swimlaneId'
    ]);
    const rows = nodes.map((node) =>
      toCsvRow([
        node.id,
        node.type,
        node.label,
        node.accountTypes?.join('|'),
        node.endPointType,
        node.gateCategory,
        node.gateChecks?.join('|'),
        node.ownerOfRecord,
        node.beneficialOwner,
        node.onBalanceSheet,
        node.accessRights,
        node.reconciliationOwner,
        node.shape,
        node.position.x,
        node.position.y,
        node.width,
        node.height,
        node.color,
        node.description,
        node.swimlaneId
      ])
    );
    downloadText([header, ...rows].join('\n'), 'finflow-nodes.csv', 'text/csv;charset=utf-8');
  }, [nodes]);

  const handleExportEdgesCsv = useCallback(() => {
    const header = toCsvRow([
      'id',
      'sourceId',
      'targetId',
      'sourcePortIdx',
      'targetPortIdx',
      'rail',
      'connectorPreset',
      'cardNetwork',
      'settlementType',
      'lifecycle',
      'customRailLabel',
      'direction',
      'label',
      'amount',
      'timing',
      'settlementTiming',
      'netting',
      'currency',
      'finality',
      'cutoffDependency',
      'isFX',
      'fxPair',
      'sourceCurrency',
      'targetCurrency',
      'riskOwner',
      'fraudLiabilityOwner',
      'chargebackExposure',
      'disputeWindow',
      'dataExchanged',
      'dataLatency',
      'systemOfRecord',
      'dataSchema',
      'velocityLimit',
      'volumeLimit',
      'pathType',
      'style',
      'color',
      'thickness',
      'arrowType',
      'arrowSize',
      'showStartArrow',
      'showMidArrow',
      'showArrowHead',
      'showDetailsOnCanvas',
      'description'
    ]);
    const rows = edges.map((edge) =>
      toCsvRow([
        edge.id,
        edge.sourceId,
        edge.targetId,
        edge.sourcePortIdx,
        edge.targetPortIdx,
        edge.rail,
        edge.connectorPreset,
        edge.cardNetwork,
        edge.settlementType,
        edge.lifecycle,
        edge.customRailLabel,
        edge.direction,
        edge.label,
        edge.amount,
        edge.timing,
        edge.settlementTiming,
        edge.netting,
        edge.currency,
        edge.finality,
        edge.cutoffDependency,
        edge.isFX,
        edge.fxPair,
        edge.sourceCurrency,
        edge.targetCurrency,
        edge.riskOwner,
        edge.fraudLiabilityOwner,
        edge.chargebackExposure,
        edge.disputeWindow,
        edge.dataExchanged,
        edge.dataLatency,
        edge.systemOfRecord,
        edge.dataSchema,
        edge.velocityLimit,
        edge.volumeLimit,
        edge.pathType,
        edge.style,
        edge.color,
        edge.thickness,
        edge.arrowType,
        edge.arrowSize,
        edge.showStartArrow,
        edge.showMidArrow,
        edge.showArrowHead,
        edge.showDetailsOnCanvas,
        edge.description
      ])
    );
    downloadText([header, ...rows].join('\n'), 'finflow-edges.csv', 'text/csv;charset=utf-8');
  }, [edges]);

  const waitForAnimationFrames = async (count = 2) => {
    for (let i = 0; i < count; i += 1) {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
  };

  const withExportCaptureMode = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    setIsExportCaptureMode(true);
    await waitForAnimationFrames(2);
    try {
      return await task();
    } finally {
      setIsExportCaptureMode(false);
    }
  }, []);

  const handleExportImage = useCallback(
    async (format: 'png' | 'svg') => {
      if (!diagramExportRef.current) {
        throw new Error('Canvas not ready for export.');
      }
      
      await withExportCaptureMode(async () => {
        const target = diagramExportRef.current;
        if (!target) return;
        
        const { toPng, toSvg } = await import('html-to-image');
        
        const options = {
          cacheBust: true,
          pixelRatio: 3, 
          backgroundColor: isDarkMode ? '#020617' : '#f8fafc',
          filter: (node: HTMLElement) => !node.classList?.contains('export-hidden'),
          width: target.scrollWidth,
          height: target.scrollHeight
        };
        const dataUrl = format === 'png' ? await toPng(target, options) : await toSvg(target, options);
        downloadDataUrl(dataUrl, `finflow-diagram.${format}`);
      });
    },
    [isDarkMode, withExportCaptureMode]
  );

  const handleExportPdf = useCallback(async () => {
    if (!diagramExportRef.current) return;

    await withExportCaptureMode(async () => {
      const target = diagramExportRef.current;
      if (!target) return;
      
      const [{ toPng }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
      const pngDataUrl = await toPng(target, {
        cacheBust: true,
        pixelRatio: 3,
        backgroundColor: isDarkMode ? '#020617' : '#f8fafc',
        filter: (node: HTMLElement) => !node.classList?.contains('export-hidden')
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: 'a4',
        compress: true
      });
      
      const imgProps = pdf.getImageProperties(pngDataUrl);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(pngDataUrl, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('finflow-diagram.pdf');
    });
  }, [isDarkMode, withExportCaptureMode]);

  const handleExportByFormat = useCallback(
    async (format: ExportFormat) => {
      setIsExportMenuOpen(false);
      setIsExporting(true);
      try {
        if (format === 'json') {
          handleExportJson();
          return;
        }
        if (format === 'csv-nodes') {
          handleExportNodesCsv();
          return;
        }
        if (format === 'csv-edges') {
          handleExportEdgesCsv();
          return;
        }
        if (format === 'png' || format === 'svg') {
          await handleExportImage(format);
          return;
        }
        if (format === 'pdf') {
          await handleExportPdf();
          return;
        }
      } catch (error) {
        console.error('Export failed', error);
        alert('Export failed. Make sure dependencies are installed and try again.');
      } finally {
        setIsExporting(false);
      }
    },
    [handleExportEdgesCsv, handleExportImage, handleExportJson, handleExportNodesCsv, handleExportPdf]
  );

  const handleExport = useCallback(() => {
    void handleExportByFormat('json');
  }, [handleExportByFormat]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!exportMenuRef.current) return;
      if (event.target instanceof globalThis.Node && exportMenuRef.current.contains(event.target)) return;
      setIsExportMenuOpen(false);
    };

    window.addEventListener('mousedown', closeOnOutsideClick);
    return () => window.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExportMenuOpen(false);
        setShowShortcutsModal(false);
        setShowWelcomeModal(false);
      }
      if (event.key === '?' && !event.metaKey && !event.ctrlKey) {
          setShowShortcutsModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  const handleExportMarkdown = useCallback(() => {
    setIsExportMenuOpen(false);
    const payload = buildExportPayload();
    const lines: string[] = [
      '# FinFlow Diagram Summary',
      '',
      `Exported at: ${payload.exportedAt}`,
      '',
      '## Nodes',
      ''
    ];
    payload.nodes.forEach((node) => {
      lines.push(
        `- ${node.label} (${node.type}) at (${Math.round(node.position.x)}, ${Math.round(node.position.y)}) [Lane: ${node.swimlaneId || 'None'}]`
      );
    });
    lines.push('', '## Edges', '');
    payload.edges.forEach((edge) => {
      lines.push(`- ${edge.sourceId} -> ${edge.targetId} | ${edge.rail || 'No rail'} | ${edge.direction}`);
    });
    downloadText(lines.join('\n'), 'finflow-summary.md', 'text/markdown;charset=utf-8');
  }, [buildExportPayload]);

  const validateSnapshot = (data: unknown): DiagramSnapshot | null => {
      return sanitizeSnapshot(data);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const validSnapshot = validateSnapshot(parsed);
      
      if (!validSnapshot) {
        throw new Error('Invalid diagram format');
      }
      
      pushHistory();
      setNodes(validSnapshot.nodes);
      setEdges(validSnapshot.edges);
      setDrawings(validSnapshot.drawings);
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setIsInspectorOpen(false);
    } catch (error) {
      console.error('Import failed', error);
      alert('Could not import JSON. Make sure the file is a valid FinFlow export.');
    } finally {
      event.target.value = '';
    }
  };

  const handleGenerateFlow = async () => {
    if (!aiPrompt.trim()) return;

    setIsAILoading(true);
    try {
      const env = import.meta.env as Record<string, string | undefined>;
      const processApiKey =
        typeof process !== 'undefined' && process.env ? process.env.API_KEY : undefined;
      const apiKey = env.VITE_API_KEY || env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || processApiKey;
      if (!apiKey) {
        alert('Missing API key. Add VITE_GEMINI_API_KEY (or GEMINI_API_KEY) in .env.local.');
        setIsAILoading(false);
        return;
      }
      const ai = new GoogleGenAI({ apiKey });

      const promptText = `
        Act as a Senior Payment Architect. Create a Flow of Funds diagram for: "${aiPrompt}".

        STRICT RULES FOR GENERATION:
        1. Use ONLY these Node Types: ${Object.values(EntityType).join(', ')}.
        2. Use ONLY these Rails: ${Object.values(PaymentRail).join(', ')}.
        3. Use ONLY these Directions: ${Object.values(FlowDirection).join(', ')}.

        LOGIC RULES:
        - "Sponsor Banks" usually connect to "Program Managers" via "Book Transfer" or "ACH".
        - "Consumers" connect to "FBOs" via "ACH", "RTP", or "FedNow".
        - "Merchants" connect to "Acquiring Banks" via "Settlement".

        Return a JSON object with:
        - nodes: Array of { id, type, label, position: {x, y} }
        - edges: Array of { id, sourceId, targetId, rail, direction, label }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: promptText,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const data = JSON.parse(response.text || '{}');
      const rawNodes = Array.isArray(data.nodes) ? data.nodes : [];
      const rawEdges = Array.isArray(data.edges) ? data.edges : [];

      const generatedNodeMap = new Map<string, Node>();
      rawNodes.forEach((n: any, idx: number) => {
        const type = ENTITY_TYPE_VALUES.has(n?.type) ? (n.type as EntityType) : null;
        if (!type) return;
        const x = toNumber(n?.position?.x, idx * 220);
        const y = toNumber(n?.position?.y, 120);
        const node = sanitizeNode(
          {
            id: typeof n?.id === 'string' && n.id.trim() ? n.id : createId(`ai-node-${idx}`),
            type,
            label: typeof n?.label === 'string' ? n.label : type,
            shape: NodeShape.RECTANGLE,
            position: { x, y },
            accountTypes: isBankNodeType(type) ? [BankAccountType.SETTLEMENT] : [],
            width: type === EntityType.GATE ? 132 : undefined,
            height: type === EntityType.GATE ? 36 : undefined,
            zIndex: 10
          },
          idx
        );
        if (node && !generatedNodeMap.has(node.id)) {
          generatedNodeMap.set(node.id, node);
        }
      });
      const generatedNodes = Array.from(generatedNodeMap.values());
      const generatedNodeIds = new Set(generatedNodes.map((n) => n.id));

      const generatedEdgeMap = new Map<string, Edge>();
      rawEdges.forEach((e: any, idx: number) => {
        const candidate = sanitizeEdge(
          {
            id: typeof e?.id === 'string' && e.id.trim() ? e.id : createId(`ai-edge-${idx}`),
            sourceId: e?.sourceId,
            targetId: e?.targetId,
            rail: PAYMENT_RAIL_VALUES.has(e?.rail) ? e.rail : PaymentRail.BLANK,
            direction: FLOW_DIRECTION_VALUES.has(e?.direction) ? e.direction : FlowDirection.PUSH,
            label: typeof e?.label === 'string' ? e.label : '',
            timing: TimingType.SAME_DAY,
            isFX: false,
            style: 'solid',
            showArrowHead: true,
            showStartArrow: false,
            showMidArrow: false,
            thickness: 2,
            pathType: 'bezier',
            sourcePortIdx: 1,
            targetPortIdx: 3,
            connectorPreset: 'custom'
          },
          idx
        );
        if (!candidate) return;
        if (!generatedNodeIds.has(candidate.sourceId) || !generatedNodeIds.has(candidate.targetId)) return;
        if (!generatedEdgeMap.has(candidate.id)) {
          generatedEdgeMap.set(candidate.id, candidate);
        }
      });
      const generatedEdges = Array.from(generatedEdgeMap.values());

      pushHistory();
      setNodes(generatedNodes);
      setEdges(generatedEdges);
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setIsInspectorOpen(false);
      setShowWelcomeModal(false); // Close welcome if generated
    } catch (error) {
      console.error('AI generation failed', error);
      alert('AI generation failed. Check your API key and prompt format.');
    } finally {
      setIsAILoading(false);
    }
  };

  const handleConnect = useCallback(
    (sourceId: string, targetId: string, spIdx: number, tpIdx: number) => {
      const candidate = createEdgeWithDefaults({
        sourceId,
        targetId,
        sourcePortIdx: spIdx,
        targetPortIdx: tpIdx,
        label: ''
      });
      const duplicate = edges.find((e) => edgesEquivalent(e, candidate));
      if (duplicate) {
        setSelectedEdgeId(duplicate.id);
        setSelectedNodeId(null);
        setSelectedNodeIds([]);
        setIsInspectorOpen(true);
        return;
      }
      pushHistory();
      setEdges((prev) => [...prev, candidate]);
      setSelectedEdgeId(candidate.id);
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setIsInspectorOpen(true);
    },
    [edges, createEdgeWithDefaults, pushHistory]
  );

  const handleDelete = useCallback(() => {
    const selectedIds = getEffectiveSelectedNodeIds();
    if (selectedIds.length === 0 && !selectedEdgeId) return;
    pushHistory();
    if (selectedIds.length > 0) {
      const selectedSet = new Set(selectedIds);
      setNodes((prev) => prev.filter((n) => !selectedSet.has(n.id)));
      setEdges((prev) => prev.filter((e) => !selectedSet.has(e.sourceId) && !selectedSet.has(e.targetId)));
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setSelectedEdgeId(null);
      setIsInspectorOpen(false);
      return;
    }
    if (selectedEdgeId) {
      setEdges((prev) => prev.filter((e) => e.id !== selectedEdgeId));
      setSelectedEdgeId(null);
      setIsInspectorOpen(false);
    }
  }, [getEffectiveSelectedNodeIds, selectedEdgeId, pushHistory]);

  const handleDeleteNodeById = useCallback((id: string) => {
    pushHistory();
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setEdges((prev) => prev.filter((e) => e.sourceId !== id && e.targetId !== id));
    setSelectedNodeId((prev) => (prev === id ? null : prev));
    setSelectedNodeIds((prev) => prev.filter((selectedId) => selectedId !== id));
    setSelectedEdgeId(null);
  }, [pushHistory]);

  const handleSelectEdge = useCallback((id: string | null) => {
    setSelectedEdgeId(id);
    if (id) {
      const edge = edges.find(e => e.id === id);
      if (edge) {
         // Sync toolbar with selected edge state for UX continuity
         setActiveColor(edge.color || '#64748b');
         setActiveLineStyle(edge.style);
         setActivePathType(edge.pathType);
         
         if (edge.showStartArrow && edge.showArrowHead) setActiveArrowDirection('both');
         else if (edge.showStartArrow) setActiveArrowDirection('reverse');
         else if (edge.showArrowHead) setActiveArrowDirection('forward');
         else setActiveArrowDirection('none');
      }
      setSelectedNodeId(null);
      setSelectedNodeIds([]);
      setIsInspectorOpen(true);
    } else {
      setIsInspectorOpen(false);
    }
  }, [edges]);

  const handleUpdateNode = useCallback((updated: Node) => {
    if (shouldPushEntityHistory('node', updated.id)) {
      pushHistory();
    }
    // Update swimlane ID based on new Y position
    const normalizedNode = normalizeNodeFields(updated);
    const swimlaneId = Math.floor(Math.max(0, normalizedNode.position.y) / 300) + 1;
    setNodes((prev) =>
      prev.map((n) => (n.id === normalizedNode.id ? { ...normalizedNode, swimlaneId } : n))
    );
  }, [pushHistory, shouldPushEntityHistory]);

  const handleUpdateEdge = useCallback((updated: Edge) => {
    if (shouldPushEntityHistory('edge', updated.id)) {
      pushHistory();
    }
    setEdges((prev) => prev.map((e) => (e.id === updated.id ? normalizeEdgeFields(updated) : e)));
  }, [pushHistory, shouldPushEntityHistory]);

  const handleApplyEdgePreset = useCallback((edgeId: string, presetKey: ConnectorPresetKey) => {
    const def = CONNECTOR_PRESETS[presetKey];
    pushHistory();
    setEdges((prev) =>
      prev.map((e) => {
        if (e.id !== edgeId) return e;
        return normalizeEdgeFields({
          ...e,
          ...def.defaults,
          connectorPreset: presetKey
        });
      })
    );
  }, [pushHistory]);

  const handleOpenInspector = useCallback(() => setIsInspectorOpen(true), []);
  const handleCloseInspector = useCallback(() => setIsInspectorOpen(false), []);
  const handleAddDrawing = useCallback((path: DrawingPath) => {
      pushHistory();
      setDrawings((prev) => [...prev, path]);
  }, [pushHistory]);
  
  const handleUpdateNodePosition = useCallback((id: string, pos: { x: number; y: number }) => {
      // Drag-time update without collision resolution for smoother movement.
      setNodes((prev) => {
        const node = prev.find((n) => n.id === id);
        if (!node) return prev;
        const swimlaneId = Math.floor(Math.max(0, pos.y) / 300) + 1;
        return prev.map((n) => (n.id === id ? { ...n, position: pos, swimlaneId } : n));
      });
  }, []);
  
  const handleCanvasMount = useCallback((element: HTMLDivElement | null) => {
      diagramExportRef.current = element;
  }, []);

  // ... (Keyboard shortcuts useEffect - unchanged) ...
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTyping) return;

      const isCmdOrCtrl = event.metaKey || event.ctrlKey;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        handleDelete();
      }

      if (isCmdOrCtrl && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleExport();
      }

      if (isCmdOrCtrl && event.key.toLowerCase() === 'c') {
        event.preventDefault();
        handleCopySelection();
      }

      if (isCmdOrCtrl && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        handlePasteSelection();
      }

      if (isCmdOrCtrl && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        handleDuplicateSelection();
      }

      if (isCmdOrCtrl && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }

      if (isCmdOrCtrl && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        handleRedo();
      }
      
      if ((isCmdOrCtrl && event.key === '=') || (isCmdOrCtrl && event.key === '+')) {
          event.preventDefault();
          setViewport(prev => ({ ...prev, zoom: Math.min(prev.zoom + 0.1, 5) }));
      }
      if (isCmdOrCtrl && event.key === '-') {
          event.preventDefault();
          setViewport(prev => ({ ...prev, zoom: Math.max(prev.zoom - 0.1, 0.1) }));
      }
      if (isCmdOrCtrl && event.key === '0') {
          event.preventDefault();
          setViewport({ x: 0, y: 0, zoom: 1 });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleDelete, handleExport, handleRedo, handleUndo, handleCopySelection, handleDuplicateSelection, handlePasteSelection]);

  const selectedNodeCount = selectedNodeIds.length > 0 ? selectedNodeIds.length : selectedNodeId ? 1 : 0;

  return (
    <div className={`flex h-screen flex-col overflow-hidden ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      <header className={`z-40 flex h-14 shrink-0 items-center justify-between border-b px-4 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-lg font-bold text-white">F</div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">FinFlow Architect</h1>
            <p className="text-[10px] font-medium opacity-50">Flow of Funds Architecture</p>
          </div>
        </div>

        <div className="mx-4 flex h-8 items-center gap-2 border-l border-r border-slate-200 px-4 dark:border-slate-800">
          <button
            onClick={() => setGridMode((prev) => (prev === 'dots' ? 'lines' : prev === 'lines' ? 'none' : 'dots'))}
            className={`rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${gridMode !== 'none' ? 'text-indigo-500' : 'text-slate-400'}`}
            title="Toggle Grid"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />

          <button
            onClick={() => setShowSwimlanes(!showSwimlanes)}
            className={`rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${showSwimlanes ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-400'}`}
            title="Toggle Swimlanes"
          >
            <Rows className="h-4 w-4" />
          </button>

          {showSwimlanes && (
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setSwimlaneCount(Math.max(1, swimlaneCount - 1))}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                -
              </button>
              <span className="w-4 text-center font-mono">{swimlaneCount}</span>
              <button
                onClick={() => setSwimlaneCount(swimlaneCount + 1)}
                className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                +
              </button>
            </div>
          )}

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
          <button
            onClick={() => setBlurData(!blurData)}
            className={`rounded p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 ${blurData ? 'text-rose-500' : 'text-slate-400'}`}
            title="Blur Sensitive Data"
          >
            {blurData ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        <div className="hidden max-w-xl flex-1 px-8 md:block">
          <div className="group relative">
            <Sparkles className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-indigo-500 transition-opacity ${isAILoading ? 'opacity-100 animate-pulse' : 'opacity-70'}`} />
            <input
              type="text"
              placeholder={isAILoading ? 'Drafting infrastructure...' : 'Describe a fund flow to auto-generate...'}
              className={`h-9 w-full rounded-full border pl-9 pr-24 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateFlow()}
            />
            <button
              onClick={handleGenerateFlow}
              className="absolute right-1 top-1 h-7 rounded-full bg-indigo-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-indigo-700"
              disabled={isAILoading}
            >
              Generate
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
             onClick={() => setShowShortcutsModal(true)}
             className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 hidden md:block"
             title="Keyboard Shortcuts (?)"
          >
             <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={handleUndo}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
            title="Undo (Cmd/Ctrl+Z)"
            disabled={past.length === 0}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={handleRedo}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
            title="Redo (Cmd/Ctrl+Shift+Z)"
            disabled={future.length === 0}
          >
            <RotateCw className="h-4 w-4" />
          </button>
          {selectedNodeCount >= 2 && (
            <div className="ml-1 flex items-center gap-1 rounded-lg border border-slate-200 px-1 py-1 dark:border-slate-700">
              <button
                onClick={() => handleAlignSelection('left')}
                className="rounded px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Align Left"
              >
                L
              </button>
              <button
                onClick={() => handleAlignSelection('center')}
                className="rounded px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Align Center"
              >
                C
              </button>
              <button
                onClick={() => handleAlignSelection('right')}
                className="rounded px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Align Right"
              >
                R
              </button>
              <button
                onClick={() => handleDistributeSelection('horizontal')}
                className="rounded px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Distribute Horizontal"
                disabled={selectedNodeCount < 3}
              >
                DH
              </button>
              <button
                onClick={() => handleDistributeSelection('vertical')}
                className="rounded px-1.5 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Distribute Vertical"
                disabled={selectedNodeCount < 3}
              >
                DV
              </button>
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Import JSON"
          >
            <Upload className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`rounded-lg p-2 transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-yellow-400' : 'hover:bg-slate-100 text-slate-600'}`}
            title="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <div className="mx-2 h-6 w-px bg-slate-200 dark:bg-slate-800" />
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60 dark:bg-white dark:text-slate-900"
              disabled={isExporting}
              title="Export diagram"
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            {isExportMenuOpen && (
              <div className="absolute right-0 top-11 z-50 w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Export Formats
                </p>
                <button
                  onClick={() => void handleExportByFormat('json')}
                  className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  JSON (Full Diagram)
                </button>
                <button
                  onClick={() => void handleExportByFormat('csv-nodes')}
                  className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  CSV (Nodes)
                </button>
                <button
                  onClick={() => void handleExportByFormat('csv-edges')}
                  className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  CSV (Edges)
                </button>
                <button
                  onClick={() => void handleExportByFormat('png')}
                  className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  PNG (Image)
                </button>
                <button
                  onClick={() => void handleExportByFormat('svg')}
                  className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  SVG (Vector)
                </button>
                <button
                  onClick={() => void handleExportByFormat('pdf')}
                  className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  PDF (A4)
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Markdown Summary
                </button>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
        </div>
      </header>

      <main className="relative flex flex-1 overflow-hidden">
        <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} relative z-30 flex flex-col border-r transition-all duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="h-full overflow-hidden">
            <Sidebar onAddNode={handleAddNode} />
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`absolute -right-3 top-1/2 z-50 flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-full border text-slate-400 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            {isSidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        <div 
          className="relative flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950"
          ref={canvasRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            drawings={drawings}
            selectedNodeId={selectedNodeId}
            selectedNodeIds={selectedNodeIds}
            selectedEdgeId={selectedEdgeId}
            onSelectNode={handleSelectNode}
            onToggleNodeSelection={handleToggleNodeSelection}
            onSelectEdge={handleSelectEdge}
            onUpdateNodePosition={handleUpdateNodePosition}
            onNodeDragStart={handleNodeDragStart}
            onNodeDragEnd={handleNodeDragEnd}
            onConnect={handleConnect}
            onUpdateNode={handleUpdateNode} 
            isDarkMode={isDarkMode}
            showPorts={showPorts}
            activeTool={activeTool}
            onAddDrawing={handleAddDrawing}
            onOpenInspector={handleOpenInspector}
            onQuickAddNode={handleAddNode}
            onAddConnectedNode={handleAddConnectedNode}
            onDuplicateNode={handleDuplicateNode}
            onDeleteNode={handleDeleteNodeById}
            showSwimlanes={showSwimlanes}
            gridMode={gridMode}
            blurData={blurData}
            swimlaneCount={swimlaneCount}
            isExportMode={isExportCaptureMode}
            onCanvasMount={handleCanvasMount}
            viewport={viewport}
            onViewportChange={setViewport}
            activeColor={activeColor}
            activeLineStyle={activeLineStyle}
            activeArrowMode={activeArrowDirection}
            activePathType={activePathType}
          />

          {/* ZOOM CONTROLS (Top Right) */}
          <div className="absolute top-4 right-4 z-30 flex flex-col gap-1">
             {/* ... Zoom buttons ... */}
             <button
               onClick={() => setViewport(v => ({ ...v, zoom: Math.min(v.zoom + 0.1, 5) }))}
               className={`p-2 rounded-lg shadow-sm border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'} hover:bg-slate-100 dark:hover:bg-slate-800`}
               title="Zoom In (Ctrl +)"
             >
                <ZoomIn className="w-4 h-4" />
             </button>
             <button
               onClick={() => setViewport(v => ({ ...v, zoom: Math.max(v.zoom - 0.1, 0.1) }))}
               className={`p-2 rounded-lg shadow-sm border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'} hover:bg-slate-100 dark:hover:bg-slate-800`}
               title="Zoom Out (Ctrl -)"
             >
                <ZoomOut className="w-4 h-4" />
             </button>
             <button
               onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}
               className={`p-2 rounded-lg shadow-sm border ${isDarkMode ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-600'} hover:bg-slate-100 dark:hover:bg-slate-800`}
               title="Reset View (Ctrl 0)"
             >
                <Maximize className="w-4 h-4" />
             </button>
             <div className={`mt-1 text-[10px] text-center font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                 {Math.round(viewport.zoom * 100)}%
             </div>
          </div>

          {/* FLOATING STYLING DECK (BOTTOM CENTER) */}
          <div className={`absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-2xl border p-1.5 shadow-xl ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <button
              onClick={() => setActiveTool('select')}
              className={`rounded-xl p-2.5 transition-all ${activeTool === 'select' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title="Select tool (V)"
            >
              <MousePointer2 className="h-5 w-5" />
            </button>
            <button
              onClick={() => setActiveTool('draw')}
              className={`rounded-xl p-2.5 transition-all ${activeTool === 'draw' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
              title="Freehand Pencil (P)"
            >
              <Pencil className="h-5 w-5" />
            </button>
            
            <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />

            {/* PATH TYPE SELECTOR */}
            <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
               <button 
                  onClick={() => handlePathTypeChange('bezier')}
                  className={`p-2 rounded-md transition-all ${activePathType === 'bezier' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="Curved (Bezier)"
                >
                   <Spline className="w-4 h-4" />
               </button>
               <button 
                  onClick={() => handlePathTypeChange('orthogonal')}
                  className={`p-2 rounded-md transition-all ${activePathType === 'orthogonal' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="Elbow (Orthogonal)"
                >
                   <CornerDownRight className="w-4 h-4" />
               </button>
               <button 
                  onClick={() => handlePathTypeChange('straight')}
                  className={`p-2 rounded-md transition-all ${activePathType === 'straight' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                  title="Straight"
                >
                   <MoveDiagonal className="w-4 h-4" />
               </button>
            </div>

            {/* LINE STYLE SELECTOR */}
            <div className="relative group mx-1">
                <button
                  className={`flex items-center gap-2 rounded-xl px-2 py-2.5 transition-all text-sm font-medium ${isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-100 text-slate-700'}`}
                  title="Line Style"
                >
                   {activeLineStyle === 'solid' ? <Minus className="w-4 h-4 rotate-45" /> : <div className="w-4 h-0 border-t-2 border-current border-dashed" />}
                   <ChevronDown className="w-3 h-3 opacity-50" />
                </button>
                <div className={`absolute bottom-full left-0 mb-2 w-32 rounded-xl border shadow-xl p-1 overflow-hidden hidden group-hover:block ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                    {LINE_STYLE_OPTIONS.map((style) => (
                        <button
                           key={style}
                           onClick={() => handleLineStyleChange(style)}
                           className={`w-full text-left px-3 py-2 text-xs rounded-lg flex items-center gap-2 ${activeLineStyle === style ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'}`}
                        >
                            <div className={`w-6 h-0 border-t-2 border-current ${style === 'dashed' ? 'border-dashed' : style === 'dotted' ? 'border-dotted' : ''}`} />
                            <span className="capitalize">{style}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />

            {/* 4-WAY DIRECTION SELECTOR */}
            <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                <button
                    onClick={() => handleArrowDirectionChange('forward')}
                    className={`p-2 rounded-md transition-all ${activeArrowDirection === 'forward' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    title="Forward"
                >
                    <MoveRight className="h-4 w-4" />
                </button>
                <button
                    onClick={() => handleArrowDirectionChange('reverse')}
                    className={`p-2 rounded-md transition-all ${activeArrowDirection === 'reverse' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    title="Reverse"
                >
                    <MoveLeft className="h-4 w-4" />
                </button>
                <button
                    onClick={() => handleArrowDirectionChange('both')}
                    className={`p-2 rounded-md transition-all ${activeArrowDirection === 'both' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    title="Bidirectional"
                >
                    <ArrowRightLeft className="h-4 w-4" />
                </button>
                <button
                    onClick={() => handleArrowDirectionChange('none')}
                    className={`p-2 rounded-md transition-all ${activeArrowDirection === 'none' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-500' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    title="No Arrows"
                >
                    <Ban className="h-4 w-4" />
                </button>
            </div>

            <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />

            {/* ADVANCED COLOR PICKER */}
            <div className="relative group">
                <button className="rounded-xl p-2.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full border shadow-sm ring-1 ring-inset ring-black/5 dark:ring-white/10" style={{ backgroundColor: activeColor }} />
                </button>
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 rounded-xl border shadow-xl w-48 hidden group-hover:block ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                    
                    <div className="grid grid-cols-5 gap-1.5 mb-3">
                        {TOOLBAR_COLORS.map(color => (
                            <button
                                key={color}
                                onClick={() => handleColorChange(color)}
                                className={`w-6 h-6 rounded-full border shadow-sm hover:scale-110 transition-transform ${activeColor === color ? 'ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : 'border-slate-200 dark:border-slate-600'}`}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                        {/* Custom Color Input Trigger */}
                        <div className="relative w-6 h-6 rounded-full border border-slate-200 dark:border-slate-600 overflow-hidden hover:scale-110 transition-transform cursor-pointer">
                             <div className="absolute inset-0 bg-gradient-to-br from-red-500 via-green-500 to-blue-500 opacity-50" />
                             <input 
                                type="color" 
                                value={activeColor}
                                onChange={(e) => handleColorChange(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                title="Custom Color Wheel"
                             />
                             <Pipette className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 text-slate-800" />
                        </div>
                    </div>

                    {recentColors.length > 0 && (
                        <>
                            <div className="h-px bg-slate-100 dark:bg-slate-800 mb-2" />
                            <div className="flex items-center gap-1.5 mb-1">
                                <History className="w-3 h-3 text-slate-400" />
                                <span className="text-[10px] uppercase font-bold text-slate-400">Recent</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {recentColors.map(color => (
                                    <button
                                        key={color}
                                        onClick={() => handleColorChange(color)}
                                        className={`w-5 h-5 rounded-md border shadow-sm hover:scale-110 transition-transform ${activeColor === color ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : 'border-slate-200 dark:border-slate-600'}`}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />

            {/* ACTION BUTTONS */}
            <button
              onClick={() => handleAddNode(EntityType.TEXT_BOX)}
              className="rounded-xl p-2.5 text-slate-500 transition-all hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Add Text Box"
            >
              <TypeIcon className="h-5 w-5" />
            </button>
            
            <button
              onClick={() => setShowPorts(!showPorts)}
              className={`rounded-xl p-2.5 transition-all ${showPorts ? 'text-indigo-500' : 'text-slate-400'}`}
              title="Show Connection Ports"
            >
              <CircleDot className="h-5 w-5" />
            </button>
            <button
              onClick={handleDelete}
              className="rounded-xl p-2.5 text-slate-500 transition-all hover:bg-rose-100 hover:text-rose-600"
              title="Delete Selection (Del)"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className={`${isInspectorOpen ? 'w-80' : 'w-0'} relative z-30 border-l transition-all duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          {isInspectorOpen && (
            <Inspector
              nodes={nodes}
              edges={edges}
              selectedNodeId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              onUpdateNode={handleUpdateNode}
              onUpdateEdge={handleUpdateEdge}
              onApplyEdgePreset={handleApplyEdgePreset}
              onSelectNode={handleSelectNode}
              onSelectEdge={handleSelectEdge}
              isDarkMode={isDarkMode}
              onClose={handleCloseInspector}
            />
          )}
        </div>

        {!isInspectorOpen && (
          <button
            onClick={() => setIsInspectorOpen(true)}
            className={`absolute right-0 top-1/2 z-50 flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-l-full border-l border-b border-t text-slate-400 shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
      </main>

      {/* ... (Welcome/Shortcuts Modal Same as before) ... */}
      {/* WELCOME MODAL */}
      {showWelcomeModal && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`w-full max-w-2xl rounded-2xl shadow-2xl p-8 transition-all ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`}>
             
             {/* MAIN VIEW */}
             {welcomeStep === 'main' && (
               <>
                 <div className="flex justify-between items-start mb-6">
                    <div>
                       <h2 className={`text-2xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Welcome to FinFlow</h2>
                       <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Start a new flow of funds architecture diagram.</p>
                    </div>
                    <button onClick={() => setShowWelcomeModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                       <X className="w-5 h-5 text-slate-400" />
                    </button>
                 </div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                     <button 
                        onClick={() => {
                            setNodes([]); setEdges([]); setDrawings([]);
                            setShowWelcomeModal(false);
                        }}
                        className={`p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-4 transition-all hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 group ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}
                     >
                        <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                            <FileText className="w-8 h-8 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        </div>
                        <div className="text-center">
                            <div className={`text-lg font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Blank Canvas</div>
                            <div className="text-sm text-slate-500 mt-1">Start from scratch</div>
                        </div>
                     </button>

                     <button 
                        onClick={() => setWelcomeStep('templates')}
                        className={`p-8 rounded-xl border flex flex-col items-center justify-center gap-4 transition-all hover:border-indigo-500 hover:shadow-lg group ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                     >
                        <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-900/50 flex items-center justify-center group-hover:scale-110 transition-transform shadow-sm">
                            <Layout className="w-8 h-8 text-indigo-500" />
                        </div>
                        <div className="text-center">
                            <div className={`text-lg font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Browse Templates</div>
                            <div className="text-sm text-slate-500 mt-1">Use a pre-built architecture</div>
                        </div>
                     </button>
                 </div>

                 <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                     <div className="flex items-center gap-2 mb-2">
                         <Sparkles className="w-4 h-4 text-indigo-500" />
                         <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>AI Assistant</h3>
                     </div>
                     <div className="flex gap-2">
                         <input 
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Describe a flow (e.g. 'Cross-border remittance to Mexico via SWIFT')"
                            className={`flex-1 bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-indigo-500 outline-none text-sm py-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}
                            onKeyDown={(e) => e.key === 'Enter' && handleGenerateFlow()}
                         />
                         <button 
                           onClick={handleGenerateFlow}
                           className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 shadow-sm"
                           disabled={!aiPrompt.trim() || isAILoading}
                         >
                           {isAILoading ? 'Generating...' : 'Generate'}
                         </button>
                     </div>
                 </div>
               </>
             )}

             {/* TEMPLATES VIEW */}
             {welcomeStep === 'templates' && (
               <>
                 <div className="flex items-center gap-2 mb-6">
                    <button 
                        onClick={() => setWelcomeStep('main')}
                        className={`p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Choose a Template</h2>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <button 
                        onClick={() => loadTemplate('marketplace')}
                        className={`p-4 rounded-xl border flex items-center gap-4 text-left transition-all hover:border-indigo-500 hover:shadow-md group ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                     >
                        <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                            <CreditCard className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <div className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Marketplace Split</div>
                            <div className="text-xs text-slate-500 mt-0.5">Payment aggregation, FBO settlement, and multi-party payouts.</div>
                        </div>
                     </button>

                     <button 
                        onClick={() => loadTemplate('crypto')}
                        className={`p-4 rounded-xl border flex items-center gap-4 text-left transition-all hover:border-indigo-500 hover:shadow-md group ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                     >
                        <div className="w-12 h-12 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                            <Globe className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <div className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>Crypto On-Ramp</div>
                            <div className="text-xs text-slate-500 mt-0.5">Fiat to Crypto flow, liquidity providers, and custody wallets.</div>
                        </div>
                     </button>
                 </div>
               </>
             )}
          </div>
        </div>
      )}

      {/* SHORTCUTS MODAL */}
      {showShortcutsModal && (
         <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowShortcutsModal(false)}>
            <div className={`w-full max-w-md rounded-2xl shadow-xl p-6 ${isDarkMode ? 'bg-slate-900 border border-slate-800' : 'bg-white'}`} onClick={e => e.stopPropagation()}>
                <h3 className={`text-lg font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Keyboard Shortcuts</h3>
                <div className="space-y-3">
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Save Diagram</span>
                      <code className={`px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Cmd + S</code>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Undo</span>
                      <code className={`px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Cmd + Z</code>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Redo</span>
                      <code className={`px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Cmd + Shift + Z</code>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Delete Selection</span>
                      <code className={`px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Backspace</code>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Pan Canvas</span>
                      <code className={`px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Space + Drag</code>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Zoom In/Out</span>
                      <code className={`px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Cmd + / -</code>
                   </div>
                   <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Reset View</span>
                      <code className={`px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>Cmd + 0</code>
                   </div>
                </div>
                <div className="mt-6 text-center text-xs text-slate-400">
                   Press <kbd className="font-bold">Esc</kbd> to close
                </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;
