import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AccountType,
  Edge,
  EntityType,
  FlowDirection,
  GridMode,
  LaneGroupingMode,
  Node,
  PaymentRail,
  ReconciliationMethod
} from '../types';
import { MousePointer2, X } from 'lucide-react';
import NodeInspectorSections from './inspector/NodeInspectorSections';
import EdgeInspectorSections from './inspector/EdgeInspectorSections';
import CanvasInspectorSections from './inspector/CanvasInspectorSections';
import ExportInspectorSections from './inspector/ExportInspectorSections';
import {
  buildDescriptionWithNodeMeta,
  createEmptyNodeMeta,
  parseNodeDescriptionMeta,
  type NodeMetaFields
} from '../lib/nodeMeta';

export type InspectorTab = 'node' | 'edge' | 'canvas' | 'export';

interface InspectorProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onUpdateNode: (node: Node) => void;
  onUpdateEdge: (edge: Edge) => void;
  isDarkMode: boolean;
  onClose: () => void;
  showSwimlanes: boolean;
  onToggleSwimlanes: () => void;
  swimlaneLabels: string[];
  onAddSwimlane: () => void;
  onRemoveSwimlane: (index: number) => void;
  onUpdateSwimlaneLabel: (index: number, label: string) => void;
  gridMode: GridMode;
  onSetGridMode: (mode: GridMode) => void;
  snapToGrid: boolean;
  onToggleSnapToGrid: () => void;
  showPorts: boolean;
  onTogglePorts: () => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
  laneGroupingMode: LaneGroupingMode;
  onSetLaneGroupingMode: (mode: LaneGroupingMode) => void;
  hasRecoverySnapshot: boolean;
  onRestoreRecovery: () => void;
  onResetCanvas: () => void;
  onImportDiagram: () => void;
  onExportDiagram: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  activeTabRequest?: InspectorTab | null;
}

const nodeSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120),
  type: z.nativeEnum(EntityType),
  accountType: z.union([z.nativeEnum(AccountType), z.literal('')]).optional(),
  description: z.string().max(2000).optional(),
  color: z.string().optional()
});

const edgeSchema = z.object({
  label: z.string().trim().max(120),
  rail: z.nativeEnum(PaymentRail),
  direction: z.nativeEnum(FlowDirection),
  timing: z.string().optional(),
  amount: z.string().optional(),
  currency: z.string().optional(),
  sequence: z.number().int().nonnegative(),
  isFX: z.boolean(),
  isExceptionPath: z.boolean(),
  fxPair: z.string().optional(),
  recoMethod: z.nativeEnum(ReconciliationMethod),
  dataSchema: z.string().optional(),
  description: z.string().optional()
});

type NodeFormValues = z.infer<typeof nodeSchema>;
type EdgeFormValues = z.infer<typeof edgeSchema>;

const NODE_FIELD_NAMES: Array<keyof NodeFormValues> = ['label', 'type', 'accountType', 'description', 'color'];
const EDGE_FIELD_NAMES: Array<keyof EdgeFormValues> = [
  'label',
  'rail',
  'direction',
  'timing',
  'amount',
  'currency',
  'sequence',
  'isFX',
  'isExceptionPath',
  'fxPair',
  'recoMethod',
  'dataSchema',
  'description'
];

const tabMeta: Array<{ id: InspectorTab; label: string }> = [
  { id: 'node', label: 'Node' },
  { id: 'edge', label: 'Edge' },
  { id: 'canvas', label: 'Canvas' },
  { id: 'export', label: 'Export' }
];

const nodeToFormValues = (node: Node | undefined): NodeFormValues => {
  const parsed = parseNodeDescriptionMeta(node?.description);
  return {
    label: node?.label || '',
    type: node?.type || EntityType.PROCESSOR,
    accountType: node?.accountType || '',
    description: parsed.notes || '',
    color: node?.color || ''
  };
};

const edgeToFormValues = (edge: Edge | undefined): EdgeFormValues => ({
  label: edge?.label || '',
  rail: edge?.rail || PaymentRail.BLANK,
  direction: edge?.direction || FlowDirection.PUSH,
  timing: edge?.timing || '',
  amount: edge?.amount || '',
  currency: edge?.currency || '',
  sequence: edge?.sequence || 0,
  isFX: !!edge?.isFX,
  isExceptionPath: !!edge?.isExceptionPath,
  fxPair: edge?.fxPair || '',
  recoMethod: edge?.recoMethod || ReconciliationMethod.NONE,
  dataSchema: edge?.dataSchema || '',
  description: edge?.description || ''
});

const getActiveFieldName = (): string | null => {
  if (typeof document === 'undefined') return null;
  const activeElement = document.activeElement;
  const isFormElement =
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    activeElement instanceof HTMLSelectElement;
  if (!isFormElement) return null;
  return activeElement.name || null;
};

const pickActiveField = <T extends string>(allowedFields: readonly T[]): T | null => {
  const activeField = getActiveFieldName();
  if (!activeField) return null;
  return allowedFields.includes(activeField as T) ? (activeField as T) : null;
};

const Inspector: React.FC<InspectorProps> = ({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  onUpdateNode,
  onUpdateEdge,
  isDarkMode,
  onClose,
  showSwimlanes,
  onToggleSwimlanes,
  swimlaneLabels,
  onAddSwimlane,
  onRemoveSwimlane,
  onUpdateSwimlaneLabel,
  gridMode,
  onSetGridMode,
  snapToGrid,
  onToggleSnapToGrid,
  showPorts,
  onTogglePorts,
  showMinimap,
  onToggleMinimap,
  laneGroupingMode,
  onSetLaneGroupingMode,
  hasRecoverySnapshot,
  onRestoreRecovery,
  onResetCanvas,
  onImportDiagram,
  onExportDiagram,
  onExportPng,
  onExportPdf,
  activeTabRequest
}) => {
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId),
    [edges, selectedEdgeId]
  );

  const [activeTab, setActiveTab] = useState<InspectorTab>('canvas');
  const [isManualTabSelection, setIsManualTabSelection] = useState(false);
  const [nodeDetailsOpen, setNodeDetailsOpen] = useState(false);
  const [edgeAdvancedOpen, setEdgeAdvancedOpen] = useState(false);
  const [nodeMeta, setNodeMeta] = useState<NodeMetaFields>(createEmptyNodeMeta());

  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const scrollPositionsRef = useRef<Record<InspectorTab, number>>({
    node: 0,
    edge: 0,
    canvas: 0,
    export: 0
  });

  const hasNodeSelection = !!selectedNode;
  const hasEdgeSelection = !!selectedEdge;

  const selectedEdgeEndpoints = useMemo(() => {
    if (!selectedEdge) return '';
    const sourceLabel = nodes.find((node) => node.id === selectedEdge.sourceId)?.label || selectedEdge.sourceId;
    const targetLabel = nodes.find((node) => node.id === selectedEdge.targetId)?.label || selectedEdge.targetId;
    return `${sourceLabel} -> ${targetLabel}`;
  }, [nodes, selectedEdge]);

  const contextMeta = useMemo((): { label: string; detail: string } => {
    if (activeTab === 'node') {
      return {
        label: 'Node',
        detail: selectedNode ? selectedNode.label : 'No node selected'
      };
    }

    if (activeTab === 'edge') {
      if (!selectedEdge) {
        return { label: 'Edge', detail: 'No edge selected' };
      }
      return {
        label: 'Edge',
        detail: selectedEdge.label?.trim() || selectedEdgeEndpoints
      };
    }

    if (activeTab === 'canvas') {
      return { label: 'Canvas', detail: 'Layout, grid, ports, minimap, and swimlane controls' };
    }

    return { label: 'Export', detail: 'Import/export and recovery actions' };
  }, [activeTab, selectedNode, selectedEdge, selectedEdgeEndpoints]);

  const isTabValidForSelection = useCallback(
    (tab: InspectorTab) => {
      if (tab === 'node') return hasNodeSelection;
      if (tab === 'edge') return hasEdgeSelection;
      return true;
    },
    [hasEdgeSelection, hasNodeSelection]
  );

  const resolveSelectionPreferredTab = useCallback((): InspectorTab => {
    if (hasEdgeSelection) return 'edge';
    if (hasNodeSelection) return 'node';
    return 'canvas';
  }, [hasEdgeSelection, hasNodeSelection]);

  const switchTab = useCallback(
    (tab: InspectorTab, options?: { manual?: boolean }) => {
      const container = scrollBodyRef.current;
      if (container) {
        scrollPositionsRef.current[activeTab] = container.scrollTop;
      }
      if (typeof options?.manual === 'boolean') {
        setIsManualTabSelection(options.manual);
      }
      if (tab !== activeTab) {
        setActiveTab(tab);
      }
    },
    [activeTab]
  );

  const handleTabClick = useCallback(
    (tab: InspectorTab) => {
      switchTab(tab, { manual: true });
    },
    [switchTab]
  );

  const nodeForm = useForm<NodeFormValues>({
    resolver: zodResolver(nodeSchema),
    mode: 'onChange',
    defaultValues: nodeToFormValues(selectedNode)
  });

  const edgeForm = useForm<EdgeFormValues>({
    resolver: zodResolver(edgeSchema),
    mode: 'onChange',
    defaultValues: edgeToFormValues(selectedEdge)
  });

  const nodeValues = useWatch({ control: nodeForm.control });
  const edgeValues = useWatch({ control: edgeForm.control });

  const selectedNodeColor = nodeForm.watch('color') || '';
  const edgeIsFX = edgeForm.watch('isFX');
  const edgeIsExceptionPath = edgeForm.watch('isExceptionPath');

  const handleNodeMetaChange = useCallback((key: keyof NodeMetaFields, value: string) => {
    setNodeMeta((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleResetNodeFields = useCallback(() => {
    nodeForm.reset(nodeToFormValues(selectedNode));
    setNodeMeta(parseNodeDescriptionMeta(selectedNode?.description).meta);
  }, [nodeForm, selectedNode]);

  const handleResetEdgeFields = useCallback(() => {
    edgeForm.reset(edgeToFormValues(selectedEdge));
  }, [edgeForm, selectedEdge]);

  useEffect(() => {
    if (activeTabRequest) {
      switchTab(activeTabRequest, { manual: false });
      return;
    }

    if (!isManualTabSelection) {
      const nextAutoTab = resolveSelectionPreferredTab();
      if (nextAutoTab !== activeTab) {
        switchTab(nextAutoTab);
      }
      return;
    }

    if (!isTabValidForSelection(activeTab)) {
      switchTab(resolveSelectionPreferredTab());
    }
  }, [
    activeTabRequest,
    activeTab,
    isManualTabSelection,
    isTabValidForSelection,
    resolveSelectionPreferredTab,
    switchTab,
    selectedNodeId,
    selectedEdgeId
  ]);

  useEffect(() => {
    const fieldToRefocus = pickActiveField(NODE_FIELD_NAMES);
    nodeForm.reset(nodeToFormValues(selectedNode));
    setNodeMeta(parseNodeDescriptionMeta(selectedNode?.description).meta);
    if (fieldToRefocus && selectedNode) {
      window.requestAnimationFrame(() => {
        nodeForm.setFocus(fieldToRefocus);
      });
    }
  }, [selectedNode?.id, selectedNode, nodeForm]);

  useEffect(() => {
    const fieldToRefocus = pickActiveField(EDGE_FIELD_NAMES);
    edgeForm.reset(edgeToFormValues(selectedEdge));
    if (fieldToRefocus && selectedEdge) {
      window.requestAnimationFrame(() => {
        edgeForm.setFocus(fieldToRefocus);
      });
    }
  }, [selectedEdge?.id, selectedEdge, edgeForm]);

  useLayoutEffect(() => {
    const container = scrollBodyRef.current;
    if (!container) return;
    const nextScrollTop = scrollPositionsRef.current[activeTab] ?? 0;
    container.scrollTop = nextScrollTop;
    const raf = window.requestAnimationFrame(() => {
      if (scrollBodyRef.current) {
        scrollBodyRef.current.scrollTop = nextScrollTop;
      }
    });
    return () => {
      window.cancelAnimationFrame(raf);
    };
  }, [activeTab]);

  useEffect(() => {
    const container = scrollBodyRef.current;
    if (!container) return;
    const handleScroll = () => {
      scrollPositionsRef.current[activeTab] = container.scrollTop;
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [activeTab]);

  useEffect(() => {
    if (!selectedNode) return;
    const parsed = nodeSchema.safeParse(nodeValues);
    if (!parsed.success) return;

    const next = parsed.data;
    const nextDescription = buildDescriptionWithNodeMeta(nodeMeta, next.description || undefined);

    const nextNode: Node = {
      ...selectedNode,
      label: next.label,
      type: next.type,
      accountType: next.accountType || undefined,
      description: nextDescription,
      color: next.color || undefined
    };

    const hasChanged =
      selectedNode.label !== nextNode.label ||
      selectedNode.type !== nextNode.type ||
      selectedNode.accountType !== nextNode.accountType ||
      selectedNode.description !== nextNode.description ||
      selectedNode.color !== nextNode.color;

    if (hasChanged) onUpdateNode(nextNode);
  }, [nodeValues, nodeMeta, selectedNode, onUpdateNode]);

  useEffect(() => {
    if (!selectedEdge) return;
    const parsed = edgeSchema.safeParse(edgeValues);
    if (!parsed.success) return;

    const next = parsed.data;
    const nextEdge: Edge = {
      ...selectedEdge,
      label: next.label,
      rail: next.rail,
      direction: next.direction,
      timing: next.timing || undefined,
      amount: next.amount || undefined,
      currency: next.currency || undefined,
      sequence: Number.isFinite(next.sequence) ? next.sequence : 0,
      isFX: next.isFX,
      isExceptionPath: next.isExceptionPath,
      fxPair: next.fxPair || undefined,
      recoMethod: next.recoMethod,
      dataSchema: next.dataSchema || undefined,
      description: next.description || undefined
    };

    const hasChanged =
      selectedEdge.label !== nextEdge.label ||
      selectedEdge.rail !== nextEdge.rail ||
      selectedEdge.direction !== nextEdge.direction ||
      selectedEdge.timing !== nextEdge.timing ||
      selectedEdge.amount !== nextEdge.amount ||
      selectedEdge.currency !== nextEdge.currency ||
      (selectedEdge.sequence || 0) !== (nextEdge.sequence || 0) ||
      selectedEdge.isFX !== nextEdge.isFX ||
      !!selectedEdge.isExceptionPath !== !!nextEdge.isExceptionPath ||
      selectedEdge.fxPair !== nextEdge.fxPair ||
      (selectedEdge.recoMethod || ReconciliationMethod.NONE) !==
        (nextEdge.recoMethod || ReconciliationMethod.NONE) ||
      selectedEdge.dataSchema !== nextEdge.dataSchema ||
      selectedEdge.description !== nextEdge.description;

    if (hasChanged) onUpdateEdge(nextEdge);
  }, [edgeValues, selectedEdge, onUpdateEdge]);

  return (
    <div className={`flex h-full flex-col ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
      <div
        className={`sticky top-0 z-10 border-b px-3 py-2 backdrop-blur ${
          isDarkMode ? 'border-slate-700 bg-slate-900/95' : 'border-slate-200 bg-white/95'
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] dark:text-slate-200">Inspector</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 p-1.5 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1 rounded-md border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800">
          {tabMeta.map((tab) => {
            const disabled = (tab.id === 'node' && !selectedNode) || (tab.id === 'edge' && !selectedEdge);
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`inspector-tab-${tab.id}`}
                disabled={disabled}
                aria-pressed={activeTab === tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-500 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={scrollBodyRef}
        data-testid="inspector-scroll-body"
        className="custom-scrollbar flex-1 overflow-y-auto p-2.5"
      >
        <div
          className={`sticky top-0 z-[1] mb-2 rounded-lg border px-2.5 py-2 backdrop-blur ${
            isDarkMode ? 'border-slate-700 bg-slate-900/95' : 'border-slate-200 bg-white/96'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                {contextMeta.label}
              </div>
              <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                {contextMeta.detail}
              </div>
            </div>

            {activeTab === 'node' && selectedNode ? (
              <button
                type="button"
                onClick={handleResetNodeFields}
                className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Reset fields
              </button>
            ) : null}

            {activeTab === 'edge' && selectedEdge ? (
              <button
                type="button"
                onClick={handleResetEdgeFields}
                className="rounded-md border border-slate-300 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Reset fields
              </button>
            ) : null}
          </div>
        </div>

        {activeTab === 'node' && !selectedNode ? (
          <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 p-6 text-center opacity-70 dark:border-slate-700">
            <MousePointer2 className="mb-3 h-10 w-10 text-slate-400" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Select a node to edit</p>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Node details stay off-canvas so the workspace remains clean.
            </p>
          </div>
        ) : null}

        {activeTab === 'node' && selectedNode ? (
          <NodeInspectorSections
            register={nodeForm.register}
            setValue={nodeForm.setValue}
            selectedNodeColor={selectedNodeColor}
            nodeDetailsOpen={nodeDetailsOpen}
            onToggleNodeDetails={() => setNodeDetailsOpen((prev) => !prev)}
            nodeMeta={nodeMeta}
            onNodeMetaChange={handleNodeMetaChange}
          />
        ) : null}

        {activeTab === 'edge' && !selectedEdge ? (
          <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 p-6 text-center opacity-70 dark:border-slate-700">
            <MousePointer2 className="mb-3 h-10 w-10 text-slate-400" />
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Select an edge to edit</p>
            <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
              Rail, settlement, and risk fields are managed in this panel.
            </p>
          </div>
        ) : null}

        {activeTab === 'edge' && selectedEdge ? (
          <EdgeInspectorSections
            register={edgeForm.register}
            setValue={edgeForm.setValue}
            edgeIsFX={edgeIsFX}
            edgeIsExceptionPath={edgeIsExceptionPath}
            edgeAdvancedOpen={edgeAdvancedOpen}
            onToggleEdgeAdvanced={() => setEdgeAdvancedOpen((prev) => !prev)}
          />
        ) : null}

        {activeTab === 'canvas' ? (
          <CanvasInspectorSections
            showSwimlanes={showSwimlanes}
            onToggleSwimlanes={onToggleSwimlanes}
            swimlaneLabels={swimlaneLabels}
            onAddSwimlane={onAddSwimlane}
            onRemoveSwimlane={onRemoveSwimlane}
            onUpdateSwimlaneLabel={onUpdateSwimlaneLabel}
            gridMode={gridMode}
            onSetGridMode={onSetGridMode}
            snapToGrid={snapToGrid}
            onToggleSnapToGrid={onToggleSnapToGrid}
            showPorts={showPorts}
            onTogglePorts={onTogglePorts}
            showMinimap={showMinimap}
            onToggleMinimap={onToggleMinimap}
            laneGroupingMode={laneGroupingMode}
            onSetLaneGroupingMode={onSetLaneGroupingMode}
          />
        ) : null}

        {activeTab === 'export' ? (
          <ExportInspectorSections
            hasRecoverySnapshot={hasRecoverySnapshot}
            onRestoreRecovery={onRestoreRecovery}
            onResetCanvas={onResetCanvas}
            onImportDiagram={onImportDiagram}
            onExportDiagram={onExportDiagram}
            onExportPng={onExportPng}
            onExportPdf={onExportPdf}
          />
        ) : null}
      </div>
    </div>
  );
};

export default Inspector;
