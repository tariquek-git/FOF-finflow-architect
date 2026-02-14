import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Edge,
  EntityType,
  FlowDirection,
  GridMode,
  LaneGroupingMode,
  Node,
  NodePinnedAttribute,
  NodeShape,
  NODE_ACCOUNT_TYPE_OPTIONS,
  PaymentRail,
  ReconciliationMethod
} from '../types';
import { MousePointer2, X } from 'lucide-react';
import NodeInspectorSections from './inspector/NodeInspectorSections';
import EdgeInspectorSections from './inspector/EdgeInspectorSections';
import CanvasInspectorSections from './inspector/CanvasInspectorSections';
import {
  buildDescriptionWithNodeMeta,
  createEmptyNodeMeta,
  parseNodeDescriptionMeta,
  type NodeMetaFields
} from '../lib/nodeMeta';
import {
  normalizeNodeAccountType,
  resolveNodeBorderStyle,
  resolveNodeBorderWidth,
  resolveNodeDisplayStyle,
  resolveNodeOpacity,
  resolveNodeScale,
  resolveNodeShape
} from '../lib/nodeDisplay';

interface InspectorProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onUpdateNode: (node: Node) => void;
  onUpdateEdge: (edge: Edge) => void;
  isDarkMode: boolean;
  onClose: () => void;
  pinnedNodeAttributes: NodePinnedAttribute[];
  onTogglePinnedNodeAttribute: (attribute: NodePinnedAttribute) => void;
  onApplyNodeTemplateToSimilar: (template: Node) => void;
  onDuplicateSelection: () => void;
  onOpenInsertPanel: () => void;
  onOpenCommandPalette: () => void;
  gridMode: GridMode;
  onSetGridMode: (mode: GridMode) => void;
  showMinimap: boolean;
  onToggleMinimap: () => void;
  laneGroupingMode: LaneGroupingMode;
  onSetLaneGroupingMode: (mode: LaneGroupingMode) => void;
  swimlaneLabels: string[];
  onUpdateSwimlaneLabel: (index: number, label: string) => void;
  onOpenExportMenu: () => void;
}

const nodeSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120),
  type: z.union([z.nativeEnum(EntityType), z.literal('')]),
  accountType: z.union([z.enum(NODE_ACCOUNT_TYPE_OPTIONS), z.literal('')]).optional(),
  accountDetails: z.string().max(240).optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(10000).optional(),
  showLabel: z.boolean(),
  showType: z.boolean(),
  showAccount: z.boolean(),
  showAccountDetails: z.boolean(),
  displayStyle: z.union([z.enum(['chips', 'compact', 'hidden']), z.literal('')]),
  shape: z.nativeEnum(NodeShape),
  fillColor: z.string().optional(),
  borderColor: z.string().optional(),
  borderWidth: z.number().min(1).max(8),
  borderStyle: z.union([z.enum(['solid', 'dashed', 'dotted']), z.literal('')]),
  opacity: z.number().min(0).max(100),
  isPhantom: z.boolean(),
  isLocked: z.boolean(),
  scale: z.number().min(0.6).max(2)
});

const edgeSchema = z.object({
  label: z.string().trim().max(120),
  rail: z.nativeEnum(PaymentRail),
  direction: z.union([z.nativeEnum(FlowDirection), z.literal('')]),
  timing: z.string().optional(),
  amount: z.string().optional(),
  currency: z.string().optional(),
  sequence: z.number().int().nonnegative(),
  isFX: z.boolean(),
  isExceptionPath: z.boolean(),
  fxPair: z.string().optional(),
  recoMethod: z.union([z.nativeEnum(ReconciliationMethod), z.literal('')]),
  dataSchema: z.string().optional(),
  description: z.string().optional()
});

type NodeFormValues = z.infer<typeof nodeSchema>;
type EdgeFormValues = z.infer<typeof edgeSchema>;
type InspectorTab = 'node' | 'edge' | 'canvas';

const NODE_FIELD_NAMES: Array<keyof NodeFormValues> = [
  'label',
  'type',
  'accountType',
  'accountDetails',
  'description',
  'notes',
  'showLabel',
  'showType',
  'showAccount',
  'showAccountDetails',
  'displayStyle',
  'shape',
  'fillColor',
  'borderColor',
  'borderWidth',
  'borderStyle',
  'opacity',
  'isPhantom',
  'isLocked',
  'scale'
];

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

const nodeToFormValues = (node: Node | undefined): NodeFormValues => {
  const parsedDescription = parseNodeDescriptionMeta(node?.description);
  const parsedNotes = parseNodeDescriptionMeta(node?.data?.notes);
  const accountType = normalizeNodeAccountType(node?.data?.accountType, node?.accountType) || '';
  return {
    label: node?.label || '',
    type: node?.type || '',
    accountType,
    accountDetails: node?.data?.accountDetails || '',
    description: parsedDescription.notes || '',
    // Keep documentation notes isolated from description/meta serialization.
    notes: parsedNotes.notes || '',
    showLabel: node?.data?.showLabel ?? true,
    showType: node?.data?.showType ?? true,
    showAccount: node?.data?.showAccount ?? true,
    showAccountDetails: node?.data?.showAccountDetails ?? false,
    displayStyle: node ? resolveNodeDisplayStyle(node) : '',
    shape: node ? resolveNodeShape(node) : NodeShape.RECTANGLE,
    fillColor: node?.data?.fillColor || node?.color || '#ffffff',
    borderColor: node?.data?.borderColor || '#d7e1ee',
    borderWidth: node ? resolveNodeBorderWidth(node) : 1,
    borderStyle: node ? resolveNodeBorderStyle(node) : '',
    opacity: node ? resolveNodeOpacity(node) : 100,
    isPhantom: !!node?.data?.isPhantom,
    isLocked: !!node?.data?.isLocked,
    scale: node ? resolveNodeScale(node) : 1
  };
};

const edgeToFormValues = (edge: Edge | undefined): EdgeFormValues => ({
  label: edge?.label || '',
  rail: edge?.rail || PaymentRail.BLANK,
  direction: edge?.direction || '',
  timing: edge?.timing || '',
  amount: edge?.amount || '',
  currency: edge?.currency || '',
  sequence: edge?.sequence || 0,
  isFX: !!edge?.isFX,
  isExceptionPath: !!edge?.isExceptionPath,
  fxPair: edge?.fxPair || '',
  recoMethod: edge?.recoMethod || '',
  dataSchema: edge?.dataSchema || '',
  description: edge?.description || ''
});

const sanitizeNodeNotes = (value: string | undefined): string | undefined => {
  const parsed = parseNodeDescriptionMeta(value);
  return parsed.notes || undefined;
};

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
  pinnedNodeAttributes,
  onTogglePinnedNodeAttribute,
  onApplyNodeTemplateToSimilar,
  onDuplicateSelection,
  onOpenInsertPanel,
  onOpenCommandPalette,
  gridMode,
  onSetGridMode,
  showMinimap,
  onToggleMinimap,
  laneGroupingMode,
  onSetLaneGroupingMode,
  swimlaneLabels,
  onUpdateSwimlaneLabel,
  onOpenExportMenu
}) => {
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = useMemo(() => (selectedNodeId ? nodeById.get(selectedNodeId) : undefined), [nodeById, selectedNodeId]);
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId),
    [edges, selectedEdgeId]
  );

  const selectionMode: 'node' | 'edge' | 'empty' = selectedEdge ? 'edge' : selectedNode ? 'node' : 'empty';
  const [activeTab, setActiveTab] = useState<InspectorTab>(selectionMode === 'empty' ? 'canvas' : selectionMode);
  const [nodeDetailsOpen, setNodeDetailsOpen] = useState(false);
  const [edgeAdvancedOpen, setEdgeAdvancedOpen] = useState(false);
  const [nodeMeta, setNodeMeta] = useState<NodeMetaFields>(createEmptyNodeMeta());
  const scrollBodyRef = useRef<HTMLDivElement>(null);

  const selectedEdgeEndpoints = useMemo(() => {
    if (!selectedEdge) return '';
    const sourceLabel = nodeById.get(selectedEdge.sourceId)?.label || selectedEdge.sourceId;
    const targetLabel = nodeById.get(selectedEdge.targetId)?.label || selectedEdge.targetId;
    return `${sourceLabel} -> ${targetLabel}`;
  }, [nodeById, selectedEdge]);

  const contextMeta = useMemo((): { label: string; detail: string } => {
    if (activeTab === 'canvas') {
      return {
        label: 'Canvas',
        detail: 'View and layout configuration'
      };
    }

    if (selectionMode === 'node') {
      return {
        label: 'Node',
        detail: selectedNode ? selectedNode.label : 'No node selected'
      };
    }

    if (selectionMode === 'edge') {
      if (!selectedEdge) {
        return { label: 'Edge', detail: 'No edge selected' };
      }
      return {
        label: 'Edge',
        detail: selectedEdge.label?.trim() || selectedEdgeEndpoints
      };
    }

    return {
      label: 'Nothing selected',
      detail: 'Select a node or edge to edit properties'
    };
  }, [activeTab, selectedEdge, selectedEdgeEndpoints, selectedNode, selectionMode]);

  useEffect(() => {
    if (selectedEdge) {
      setActiveTab('edge');
      return;
    }
    if (selectedNode) {
      setActiveTab('node');
      return;
    }
    setActiveTab('canvas');
  }, [selectedEdge, selectedNode]);

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

  const watchedNodeValues = useWatch({ control: nodeForm.control });
  const edgeValues = useWatch({ control: edgeForm.control });
  const nodeValues = useMemo<NodeFormValues>(
    () => ({
      ...nodeToFormValues(selectedNode),
      ...(watchedNodeValues as Partial<NodeFormValues>)
    }),
    [selectedNode, watchedNodeValues]
  );
  const edgeIsFX = edgeForm.watch('isFX');
  const edgeIsExceptionPath = edgeForm.watch('isExceptionPath');

  const handleNodeMetaChange = useCallback((key: keyof NodeMetaFields, value: string) => {
    setNodeMeta((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleResetNodeFields = useCallback(() => {
    nodeForm.reset(nodeToFormValues(selectedNode));
    setNodeMeta(parseNodeDescriptionMeta(selectedNode?.description).meta);
  }, [nodeForm, selectedNode]);

  const handleApplyToSimilarNodes = useCallback(() => {
    if (!selectedNode) return;
    const parsed = nodeSchema.safeParse(nodeValues);
    if (!parsed.success) return;

    const next = parsed.data;
    const nextDescription = buildDescriptionWithNodeMeta(nodeMeta, next.description || undefined);
    const normalizedAccountType = normalizeNodeAccountType(next.accountType);
    const nextType = next.type || selectedNode.type;
    const nextDisplayStyle = next.displayStyle || resolveNodeDisplayStyle(selectedNode);
    const nextBorderStyle = next.borderStyle || resolveNodeBorderStyle(selectedNode);

    const nextNodeData = {
      ...selectedNode.data,
      accountType: normalizedAccountType,
      accountDetails: next.accountDetails || undefined,
      showLabel: next.showLabel,
      showType: next.showType,
      showAccount: next.showAccount,
      showAccountDetails: next.showAccountDetails,
      displayStyle: nextDisplayStyle,
      shape: next.shape,
      fillColor: next.fillColor || undefined,
      borderColor: next.borderColor || undefined,
      borderWidth: next.borderWidth,
      borderStyle: nextBorderStyle,
      opacity: next.opacity,
      isPhantom: next.isPhantom,
      isLocked: next.isLocked,
      scale: next.scale,
      notes: sanitizeNodeNotes(next.notes)
    };

    const template: Node = {
      ...selectedNode,
      label: next.label,
      type: nextType,
      shape: next.shape,
      accountType: normalizedAccountType || undefined,
      description: nextDescription,
      color: next.fillColor || undefined,
      data: nextNodeData
    };
    onApplyNodeTemplateToSimilar(template);
  }, [nodeMeta, nodeValues, onApplyNodeTemplateToSimilar, selectedNode]);

  const handleResetEdgeFields = useCallback(() => {
    edgeForm.reset(edgeToFormValues(selectedEdge));
  }, [edgeForm, selectedEdge]);

  useEffect(() => {
    const fieldToRefocus = pickActiveField(NODE_FIELD_NAMES);
    nodeForm.reset(nodeToFormValues(selectedNode));
    setNodeMeta(parseNodeDescriptionMeta(selectedNode?.description).meta);
    if (fieldToRefocus && selectedNode) {
      window.requestAnimationFrame(() => {
        nodeForm.setFocus(fieldToRefocus);
      });
    }
  }, [selectedNode?.id, nodeForm]);

  useEffect(() => {
    const fieldToRefocus = pickActiveField(EDGE_FIELD_NAMES);
    edgeForm.reset(edgeToFormValues(selectedEdge));
    if (fieldToRefocus && selectedEdge) {
      window.requestAnimationFrame(() => {
        edgeForm.setFocus(fieldToRefocus);
      });
    }
  }, [selectedEdge?.id, edgeForm]);

  useEffect(() => {
    if (!selectedNode) return;
    const parsed = nodeSchema.safeParse(nodeValues);
    if (!parsed.success) return;

    const next = parsed.data;
    const nextDescription = buildDescriptionWithNodeMeta(nodeMeta, next.description || undefined);
    const normalizedAccountType = normalizeNodeAccountType(next.accountType);
    const nextType = next.type || selectedNode.type;
    const nextDisplayStyle = next.displayStyle || resolveNodeDisplayStyle(selectedNode);
    const nextBorderStyle = next.borderStyle || resolveNodeBorderStyle(selectedNode);
    const nextNodeData = {
      ...selectedNode.data,
      accountType: normalizedAccountType,
      accountDetails: next.accountDetails || undefined,
      showLabel: next.showLabel,
      showType: next.showType,
      showAccount: next.showAccount,
      showAccountDetails: next.showAccountDetails,
      displayStyle: nextDisplayStyle,
      shape: next.shape,
      fillColor: next.fillColor || undefined,
      borderColor: next.borderColor || undefined,
      borderWidth: next.borderWidth,
      borderStyle: nextBorderStyle,
      opacity: next.opacity,
      isPhantom: next.isPhantom,
      isLocked: next.isLocked,
      scale: next.scale,
      notes: sanitizeNodeNotes(next.notes)
    };

    const nextNode: Node = {
      ...selectedNode,
      label: next.label,
      type: nextType,
      shape: next.shape,
      accountType: normalizedAccountType || undefined,
      description: nextDescription,
      color: next.fillColor || undefined,
      data: nextNodeData
    };

    const previousDataText = JSON.stringify(selectedNode.data || {});
    const nextDataText = JSON.stringify(nextNode.data || {});

    const hasChanged =
      selectedNode.label !== nextNode.label ||
      selectedNode.type !== nextNode.type ||
      selectedNode.shape !== nextNode.shape ||
      selectedNode.accountType !== nextNode.accountType ||
      selectedNode.description !== nextNode.description ||
      selectedNode.color !== nextNode.color ||
      previousDataText !== nextDataText;

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
      direction: next.direction || selectedEdge.direction || FlowDirection.PUSH,
      timing: next.timing || undefined,
      amount: next.amount || undefined,
      currency: next.currency || undefined,
      sequence: Number.isFinite(next.sequence) ? next.sequence : 0,
      isFX: next.isFX,
      isExceptionPath: next.isExceptionPath,
      fxPair: next.fxPair || undefined,
      recoMethod: next.recoMethod || selectedEdge.recoMethod || ReconciliationMethod.NONE,
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

  const renderEmptyState = () => (
    <div className="mb-3 rounded-lg border border-dashed border-slate-300/90 bg-slate-50/65 p-3 text-left dark:border-slate-700/80 dark:bg-slate-900/40">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">Nothing selected</p>
      <p className="mt-1 text-[12px] text-slate-600 dark:text-slate-300">Select an entity to edit properties.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={onOpenInsertPanel} className="status-chip">
          Open Insert
        </button>
        <button type="button" onClick={onOpenCommandPalette} className="status-chip">
          Command palette (Cmd K)
        </button>
      </div>
    </div>
  );

  const renderTabSelectionHint = (tabName: 'Node' | 'Edge') => (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300/90 p-6 text-center dark:border-slate-700/80">
      <MousePointer2 className="mb-3 h-8 w-8 text-slate-400" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">No {tabName.toLowerCase()} selected</p>
      <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">Select a {tabName.toLowerCase()} to edit {tabName.toLowerCase()} properties.</p>
    </div>
  );

  const tabButtonClass = (tab: InspectorTab, isDisabled = false) =>
    `flex h-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors ${
      activeTab === tab
        ? 'border border-cyan-400/70 bg-cyan-50 text-cyan-800 dark:border-cyan-400/60 dark:bg-cyan-900/40 dark:text-cyan-100'
        : 'border border-transparent text-slate-500 hover:bg-slate-100/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-200'
    } ${isDisabled ? 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-500 dark:hover:text-slate-400' : ''}`;

  return (
    <div className={`flex h-full flex-col ${isDarkMode ? 'bg-slate-900/90' : 'bg-white/90'}`}>
      <div
        className={`sticky top-0 z-10 border-b px-3 py-2 backdrop-blur ${
          isDarkMode ? 'border-slate-700/70 bg-slate-900/88' : 'border-slate-200/75 bg-white/88'
        }`}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-cyan-500" />
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] dark:text-slate-200">Inspector</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300/80 p-1.5 transition-colors hover:bg-slate-100 dark:border-slate-700/80 dark:hover:bg-slate-800"
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          data-testid="inspector-mode-title"
          className="mb-2 rounded-lg border border-slate-200/70 bg-slate-50/80 px-2.5 py-2 text-[12px] font-semibold text-slate-700 dark:border-slate-700/70 dark:bg-slate-800/70 dark:text-slate-200"
        >
          {selectionMode === 'node' ? 'Node' : selectionMode === 'edge' ? 'Edge' : 'Nothing selected'}
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200/70 bg-slate-50/75 p-1 dark:border-slate-700/80 dark:bg-slate-900/55">
          <button
            type="button"
            data-testid="inspector-tab-node"
            onClick={() => setActiveTab('node')}
            className={tabButtonClass('node', !selectedNode)}
            disabled={!selectedNode}
          >
            Node
          </button>
          <button
            type="button"
            data-testid="inspector-tab-edge"
            onClick={() => setActiveTab('edge')}
            className={tabButtonClass('edge', !selectedEdge)}
            disabled={!selectedEdge}
          >
            Edge
          </button>
          <button
            type="button"
            data-testid="inspector-tab-canvas"
            onClick={() => setActiveTab('canvas')}
            className={tabButtonClass('canvas')}
          >
            Canvas
          </button>
        </div>
      </div>

      <div ref={scrollBodyRef} data-testid="inspector-scroll-body" className="custom-scrollbar flex-1 overflow-y-auto p-2">
        <div
          className={`sticky top-0 z-[1] mb-2 rounded-lg border px-2.5 py-2 backdrop-blur ${
            isDarkMode ? 'border-slate-700/70 bg-slate-900/86' : 'border-slate-200/75 bg-white/88'
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                {contextMeta.label}
              </div>
              <div className="mt-0.5 truncate text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                {contextMeta.detail}
              </div>
            </div>

            {activeTab === 'node' && selectedNode ? (
              <button type="button" onClick={onDuplicateSelection} className="status-chip !h-7 !px-2.5">
                Duplicate
              </button>
            ) : null}

            {activeTab === 'edge' && selectedEdge ? (
              <button
                type="button"
                onClick={handleResetEdgeFields}
                className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Reset fields
              </button>
            ) : null}
          </div>
        </div>

        {selectionMode === 'empty' ? renderEmptyState() : null}

        {activeTab === 'node' && selectedNode ? (
          <NodeInspectorSections
            register={nodeForm.register}
            setValue={nodeForm.setValue}
            values={nodeValues}
            nodeDetailsOpen={nodeDetailsOpen}
            onToggleNodeDetails={() => setNodeDetailsOpen((prev) => !prev)}
            nodeMeta={nodeMeta}
            onNodeMetaChange={handleNodeMetaChange}
            pinnedNodeAttributes={pinnedNodeAttributes}
            onTogglePinnedNodeAttribute={onTogglePinnedNodeAttribute}
            onResetNodeSection={handleResetNodeFields}
            onApplyNodeSection={handleApplyToSimilarNodes}
          />
        ) : null}

        {activeTab === 'node' && !selectedNode ? renderTabSelectionHint('Node') : null}

        {activeTab === 'edge' && selectedEdge ? (
          <EdgeInspectorSections
            register={edgeForm.register}
            setValue={edgeForm.setValue}
            selectedRail={edgeValues?.rail}
            edgeIsFX={edgeIsFX}
            edgeIsExceptionPath={edgeIsExceptionPath}
            edgeAdvancedOpen={edgeAdvancedOpen}
            onToggleEdgeAdvanced={() => setEdgeAdvancedOpen((prev) => !prev)}
            onResetEdgeSection={handleResetEdgeFields}
          />
        ) : null}

        {activeTab === 'edge' && !selectedEdge ? renderTabSelectionHint('Edge') : null}

        {activeTab === 'canvas' ? (
          <CanvasInspectorSections
            gridMode={gridMode}
            onSetGridMode={onSetGridMode}
            showMinimap={showMinimap}
            onToggleMinimap={onToggleMinimap}
            laneGroupingMode={laneGroupingMode}
            onSetLaneGroupingMode={onSetLaneGroupingMode}
            swimlaneLabels={swimlaneLabels}
            onUpdateSwimlaneLabel={onUpdateSwimlaneLabel}
            onOpenExportMenu={onOpenExportMenu}
          />
        ) : null}
      </div>
    </div>
  );
};

export default Inspector;
