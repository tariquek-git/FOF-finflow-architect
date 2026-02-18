import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  EdgeData,
  Edge,
  EntityType,
  NodeData,
  Node,
  NodePinnedAttribute,
  NodeShape,
  NODE_ACCOUNT_TYPE_OPTIONS,
  PaymentRail
} from '../types';
import { X } from 'lucide-react';
import NodeInspectorSections from './inspector/NodeInspectorSections';
import EdgeInspectorSections from './inspector/EdgeInspectorSections';
import { Button } from './ui/Button';
import {
  buildDescriptionWithNodeMeta,
  createEmptyNodeMeta,
  parseNodeDescriptionMeta,
  type NodeMetaFields
} from '../lib/nodeMeta';
import { sanitizeNotesText } from '../lib/diagramIO';
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
  selectedSwimlaneId: number | null;
  swimlaneLabels: string[];
  swimlaneCollapsedIds: number[];
  swimlaneLockedIds: number[];
  swimlaneHiddenIds: number[];
  onUpdateNode: (node: Node) => void;
  onUpdateEdge: (edge: Edge) => void;
  onClose: () => void;
  pinnedNodeAttributes: NodePinnedAttribute[];
  onTogglePinnedNodeAttribute: (attribute: NodePinnedAttribute) => void;
  onApplyNodeTemplateToSimilar: (template: Node) => void;
  onDuplicateSelection: () => void;
  onOpenInsertPanel: () => void;
  onOpenCommandPalette: () => void;
  onSelectSwimlane: (laneId: number | null) => void;
  onRenameSwimlane: (laneId: number, label: string) => void;
  onToggleSwimlaneCollapsed: (laneId: number) => void;
  onToggleSwimlaneLocked: (laneId: number) => void;
  onToggleSwimlaneHidden: (laneId: number) => void;
}

const nodeSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120),
  type: z.union([z.nativeEnum(EntityType), z.literal('')]),
  accountType: z.union([z.enum(NODE_ACCOUNT_TYPE_OPTIONS), z.literal('')]).optional(),
  accountDetails: z.string().max(240).optional(),
  description: z.string().max(2000).optional(),
  notes: z.string().max(20000).optional(),
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

const EDGE_TYPE_OPTIONS = [
  '',
  'authorization',
  'clearing',
  'settlement',
  'funding',
  'fee',
  'dispute',
  'refund',
  'reconciliation',
  'other'
] as const;

const EDGE_TIMING_OPTIONS = ['', 'realtime', 'batch', 'T+1', 'T+2', 'other'] as const;

const edgeSchema = z.object({
  label: z.string().trim().max(120),
  flowType: z.enum(EDGE_TYPE_OPTIONS),
  flowTypeCustom: z.string().max(120).optional(),
  timingPreset: z.enum(EDGE_TIMING_OPTIONS),
  timingCustom: z.string().max(120).optional(),
  rail: z.union([z.nativeEnum(PaymentRail), z.literal('')]),
  railCustom: z.string().max(120).optional(),
  notes: z.string().max(20000).optional(),
  style: z.union([z.enum(['solid', 'dashed', 'dotted']), z.literal('solid')]),
  pathType: z.union([z.enum(['bezier', 'orthogonal']), z.literal('bezier')]),
  thickness: z.number().min(1).max(6),
  showArrowHead: z.boolean(),
  showMidArrow: z.boolean()
});

type NodeFormValues = z.infer<typeof nodeSchema>;
type EdgeFormValues = z.infer<typeof edgeSchema>;
const LANE_NAME_PLACEHOLDER = 'Name this lane';

const normalizeNodeTextToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const normalizeNotesToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[:\-–—.,;!?]+$/g, '');

const normalizeLooseToken = (value: string): string =>
  normalizeNotesToken(value).replace(/[^a-z0-9]+/g, ' ').trim();

const stripRedundantNotesPrefix = (value: string): string => {
  let next = value.trim();
  next = next.replace(/^\s*(type|name)\s*[:\-]\s*/i, '');
  return next.trim();
};

const isNearDuplicate = (candidate: string, target: string): boolean => {
  const looseCandidate = normalizeLooseToken(candidate);
  const looseTarget = normalizeLooseToken(target);
  if (!looseCandidate || !looseTarget) return false;
  if (looseCandidate === looseTarget) return true;
  if (candidate.trim().length >= 40) return false;
  const trimmedCandidate = looseCandidate.replace(/^(type|name)\s+/, '').trim();
  return trimmedCandidate === looseTarget;
};

const sanitizeNodeNotes = (value: string | undefined, label: string, typeLabel: string): string => {
  const base = sanitizeNotesText(value);
  if (!base) return '';

  const cleaned = stripRedundantNotesPrefix(base);
  const noteToken = normalizeNotesToken(cleaned);
  if (!noteToken) return '';

  const labelToken = normalizeNotesToken(label);
  const typeToken = normalizeNotesToken(typeLabel);
  if (noteToken === labelToken || noteToken === typeToken) return '';
  if (isNearDuplicate(cleaned, label) || isNearDuplicate(cleaned, typeLabel)) return '';
  return cleaned;
};

const resolveNodeIsNameAuto = (node: Node | undefined): boolean => {
  if (!node) return true;
  if (typeof node.isNameAuto === 'boolean') return node.isNameAuto;
  return normalizeNodeTextToken(node.label || node.type) === normalizeNodeTextToken(node.type);
};

const resolveNodeIdentityState = (
  selectedNode: Node,
  formLabel: string,
  nextType: EntityType
): { label: string; isNameAuto: boolean } => {
  const wasAuto = resolveNodeIsNameAuto(selectedNode);
  const trimmedLabel = formLabel.trim();
  const hasLabel = trimmedLabel.length > 0;
  const typeChanged = nextType !== selectedNode.type;
  const nextTypeToken = normalizeNodeTextToken(nextType);
  const nextLabelToken = normalizeNodeTextToken(hasLabel ? trimmedLabel : nextType);

  if (!hasLabel) {
    return { label: nextType, isNameAuto: true };
  }

  if (typeChanged && wasAuto) {
    return { label: nextType, isNameAuto: true };
  }

  if (nextLabelToken === nextTypeToken) {
    return { label: nextType, isNameAuto: true };
  }

  return { label: trimmedLabel, isNameAuto: false };
};

const resolveNodeLabelForForm = (node: Node | undefined): string => {
  const rawLabel = node?.label || '';
  const trimmedLabel = rawLabel.trim();
  if (trimmedLabel.length > 0) return rawLabel;
  return node?.type || '';
};

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
  'flowType',
  'flowTypeCustom',
  'timingPreset',
  'timingCustom',
  'rail',
  'railCustom',
  'notes',
  'style',
  'pathType',
  'thickness',
  'showArrowHead',
  'showMidArrow'
];

const nodeToFormValues = (node: Node | undefined): NodeFormValues => {
  const parsedDescription = parseNodeDescriptionMeta(node?.description);
  const accountType = normalizeNodeAccountType(node?.data?.accountType, node?.accountType) || '';
  const label = resolveNodeLabelForForm(node);
  const typeLabel = node?.type || '';
  return {
    label,
    type: typeLabel,
    accountType,
    accountDetails: node?.data?.accountDetails || '',
    description: parsedDescription.notes || '',
    notes: sanitizeNodeNotes(node?.data?.notes, label, typeLabel),
    showLabel: node?.data?.showLabel ?? false,
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
  flowType: typeof edge?.data?.flowType === 'string' ? ((edge.data?.flowType as EdgeFormValues['flowType']) || '') : '',
  flowTypeCustom: typeof edge?.data?.flowTypeCustom === 'string' ? edge.data?.flowTypeCustom : '',
  timingPreset:
    typeof edge?.data?.timingPreset === 'string'
      ? (edge.data?.timingPreset as EdgeFormValues['timingPreset'])
      : edge?.timing === 'realtime' || edge?.timing === 'batch' || edge?.timing === 'T+1' || edge?.timing === 'T+2'
        ? (edge.timing as EdgeFormValues['timingPreset'])
        : edge?.timing
          ? 'other'
          : '',
  timingCustom:
    typeof edge?.data?.timingCustom === 'string'
      ? edge.data?.timingCustom
      : edge?.timing &&
          edge.timing !== 'realtime' &&
          edge.timing !== 'batch' &&
          edge.timing !== 'T+1' &&
          edge.timing !== 'T+2'
        ? edge.timing
        : '',
  rail: edge?.rail || PaymentRail.BLANK,
  railCustom: typeof edge?.data?.railCustom === 'string' ? edge.data?.railCustom : '',
  notes: sanitizeNotesText(edge?.data?.notes),
  style: edge?.style || 'solid',
  pathType: edge?.pathType || 'bezier',
  thickness: edge?.thickness ?? 2,
  showArrowHead: edge?.showArrowHead ?? true,
  showMidArrow: edge?.showMidArrow ?? false
});

const sanitizeEdgeNotes = (value: string | undefined): string => sanitizeNotesText(value);

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
  selectedSwimlaneId,
  swimlaneLabels,
  swimlaneCollapsedIds,
  swimlaneLockedIds,
  swimlaneHiddenIds,
  onUpdateNode,
  onUpdateEdge,
  onClose,
  pinnedNodeAttributes,
  onTogglePinnedNodeAttribute,
  onApplyNodeTemplateToSimilar,
  onDuplicateSelection,
  onOpenInsertPanel,
  onOpenCommandPalette,
  onSelectSwimlane,
  onRenameSwimlane,
  onToggleSwimlaneCollapsed,
  onToggleSwimlaneLocked,
  onToggleSwimlaneHidden
}) => {
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const edgeById = useMemo(() => new Map(edges.map((edge) => [edge.id, edge])), [edges]);
  const selectedNode = useMemo(() => (selectedNodeId ? nodeById.get(selectedNodeId) : undefined), [nodeById, selectedNodeId]);
  const selectedNodeIsNameAuto = useMemo(() => resolveNodeIsNameAuto(selectedNode), [selectedNode]);
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId),
    [edges, selectedEdgeId]
  );

  const selectionMode: 'node' | 'edge' | 'lane' | 'empty' =
    selectedEdge ? 'edge' : selectedNode ? 'node' : selectedSwimlaneId ? 'lane' : 'empty';
  const [nodeDetailsOpen, setNodeDetailsOpen] = useState(false);
  const [nodeMeta, setNodeMeta] = useState<NodeMetaFields>(createEmptyNodeMeta());
  const [laneNameDraft, setLaneNameDraft] = useState('');
  const laneNameInputRef = useRef<HTMLInputElement | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  const nodeNotesCommitTimeoutRef = useRef<number | null>(null);
  const edgeNotesCommitTimeoutRef = useRef<number | null>(null);
  const lastSelectedNodeIdRef = useRef<string | null>(null);
  const lastSelectedEdgeIdRef = useRef<string | null>(null);
  const isHydratingNodeFormRef = useRef(false);
  const isHydratingEdgeFormRef = useRef(false);
  const nodeHydrationRafRef = useRef<number | null>(null);
  const edgeHydrationRafRef = useRef<number | null>(null);

  const selectedSwimlaneLabel = useMemo(() => {
    if (!selectedSwimlaneId) return '';
    return swimlaneLabels[selectedSwimlaneId - 1] || '';
  }, [selectedSwimlaneId, swimlaneLabels]);

  const isSelectedLaneCollapsed = !!selectedSwimlaneId && swimlaneCollapsedIds.includes(selectedSwimlaneId);
  const isSelectedLaneLocked = !!selectedSwimlaneId && swimlaneLockedIds.includes(selectedSwimlaneId);
  const isSelectedLaneHidden = !!selectedSwimlaneId && swimlaneHiddenIds.includes(selectedSwimlaneId);

  const selectedEdgeEndpoints = useMemo(() => {
    if (!selectedEdge) return '';
    const sourceLabel = nodeById.get(selectedEdge.sourceId)?.label || selectedEdge.sourceId;
    const targetLabel = nodeById.get(selectedEdge.targetId)?.label || selectedEdge.targetId;
    return `${sourceLabel} → ${targetLabel}`;
  }, [nodeById, selectedEdge]);

  const modeMeta = useMemo((): { title: string; detail: string } => {
    if (selectionMode === 'empty') {
      return {
        title: 'Nothing selected',
        detail: 'Select a node or edge to edit properties'
      };
    }

    if (selectionMode === 'node') {
      return {
        title: 'Node',
        detail: selectedNode?.label || 'No node selected'
      };
    }

    if (selectionMode === 'edge') {
      return {
        title: 'Edge',
        detail: selectedEdge.label?.trim() || selectedEdgeEndpoints
      };
    }

    if (selectionMode === 'lane') {
      return {
        title: 'Lane',
        detail: selectedSwimlaneLabel || LANE_NAME_PLACEHOLDER
      };
    }

    return {
      title: 'Properties',
      detail: 'Select a node or edge to edit properties'
    };
  }, [selectedEdge, selectedEdgeEndpoints, selectedNode, selectedSwimlaneLabel, selectionMode]);

  useEffect(() => {
    if (!selectedSwimlaneId) {
      setLaneNameDraft('');
      return;
    }
    setLaneNameDraft(selectedSwimlaneLabel);
  }, [selectedSwimlaneId, selectedSwimlaneLabel]);

  useEffect(() => {
    const onFocusLaneName = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as { laneId?: number } | undefined;
      if (!detail?.laneId || detail.laneId !== selectedSwimlaneId) return;
      window.requestAnimationFrame(() => {
        laneNameInputRef.current?.focus();
        laneNameInputRef.current?.select();
      });
    };

    window.addEventListener('finflow:focus-lane-name', onFocusLaneName);
    return () => window.removeEventListener('finflow:focus-lane-name', onFocusLaneName);
  }, [selectedSwimlaneId]);

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
  const watchedEdgeValues = useWatch({ control: edgeForm.control });
  const nodeValues = useMemo<NodeFormValues>(
    () => ({
      ...nodeToFormValues(selectedNode),
      ...(watchedNodeValues as Partial<NodeFormValues>)
    }),
    [selectedNode, watchedNodeValues]
  );
  const edgeValues = useMemo<EdgeFormValues>(
    () => ({
      ...edgeToFormValues(selectedEdge),
      ...(watchedEdgeValues as Partial<EdgeFormValues>)
    }),
    [selectedEdge, watchedEdgeValues]
  );
  const nodeNotesValue = nodeForm.watch('notes');
  const edgeNotesValue = edgeForm.watch('notes');

  const commitNodeNotes = useCallback(
    (nodeId: string, value: string | undefined) => {
      const node = nodeById.get(nodeId);
      if (!node) return;
      const nodeLabel = resolveNodeLabelForForm(node);
      const nodeType = node.type;
      const nextNotes = sanitizeNodeNotes(value, nodeLabel, nodeType);
      const previousNotes = sanitizeNodeNotes(node.data?.notes, nodeLabel, nodeType);
      if (nextNotes === previousNotes) return;

      const nextData: NodeData = {
        ...(node.data || {}),
        notes: nextNotes
      };

      onUpdateNode({
        ...node,
        data: nextData
      });
    },
    [nodeById, onUpdateNode]
  );

  const commitEdgeNotes = useCallback(
    (edgeId: string, value: string | undefined) => {
      const edge = edgeById.get(edgeId);
      if (!edge) return;
      const nextNotes = sanitizeEdgeNotes(value);
      const previousNotes = sanitizeEdgeNotes(edge.data?.notes);
      if (nextNotes === previousNotes) return;

      const nextData: EdgeData = {
        ...(edge.data || {}),
        notes: nextNotes
      };

      onUpdateEdge({
        ...edge,
        data: nextData
      });
    },
    [edgeById, onUpdateEdge]
  );

  const handleNodeMetaChange = useCallback((key: keyof NodeMetaFields, value: string) => {
    setNodeMeta((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleResetNodeFields = useCallback(() => {
    if (selectedNode) {
      commitNodeNotes(selectedNode.id, nodeForm.getValues('notes'));
    }
    nodeForm.reset(nodeToFormValues(selectedNode));
    setNodeMeta(parseNodeDescriptionMeta(selectedNode?.description).meta);
  }, [commitNodeNotes, nodeForm, selectedNode?.id]);

  const handleApplyToSimilarNodes = useCallback(() => {
    if (!selectedNode) return;
    const parsed = nodeSchema.safeParse(nodeValues);
    if (!parsed.success) return;

    const next = parsed.data;
    const nextDescription = buildDescriptionWithNodeMeta(nodeMeta, next.description || undefined);
    const normalizedAccountType = normalizeNodeAccountType(next.accountType);
    const nextType = next.type || selectedNode.type;
    const identity = resolveNodeIdentityState(selectedNode, next.label, nextType);
    const nextDisplayStyle = next.displayStyle || resolveNodeDisplayStyle(selectedNode);
    const nextBorderStyle = next.borderStyle || resolveNodeBorderStyle(selectedNode);

    const nextNodeData = {
      ...selectedNode.data,
      isNameAuto: identity.isNameAuto,
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
      notes: sanitizeNodeNotes(selectedNode.data?.notes, identity.label, nextType)
    };

    const template: Node = {
      ...selectedNode,
      label: identity.label,
      isNameAuto: identity.isNameAuto,
      type: nextType,
      shape: next.shape,
      description: nextDescription,
      color: next.fillColor || undefined,
      data: nextNodeData
    };
    onApplyNodeTemplateToSimilar(template);
  }, [nodeMeta, nodeValues, onApplyNodeTemplateToSimilar, selectedNode]);

  const handleResetEdgeFields = useCallback(() => {
    if (selectedEdge) {
      commitEdgeNotes(selectedEdge.id, edgeForm.getValues('notes'));
    }
    edgeForm.reset(edgeToFormValues(selectedEdge));
  }, [commitEdgeNotes, edgeForm, selectedEdge?.id]);

  const handleResetEdgeStyling = useCallback(() => {
    edgeForm.setValue('style', 'solid', { shouldDirty: true, shouldValidate: true });
    edgeForm.setValue('pathType', 'bezier', { shouldDirty: true, shouldValidate: true });
    edgeForm.setValue('thickness', 2, { shouldDirty: true, shouldValidate: true });
    edgeForm.setValue('showArrowHead', true, { shouldDirty: true, shouldValidate: true });
    edgeForm.setValue('showMidArrow', false, { shouldDirty: true, shouldValidate: true });
  }, [edgeForm]);

  const handleNodeNotesBlur = useCallback(() => {
    if (!selectedNode) return;
    if (nodeNotesCommitTimeoutRef.current !== null) {
      window.clearTimeout(nodeNotesCommitTimeoutRef.current);
      nodeNotesCommitTimeoutRef.current = null;
    }
    commitNodeNotes(selectedNode.id, nodeForm.getValues('notes'));
  }, [commitNodeNotes, nodeForm, selectedNode]);

  const handleEdgeNotesBlur = useCallback(() => {
    if (!selectedEdge) return;
    if (edgeNotesCommitTimeoutRef.current !== null) {
      window.clearTimeout(edgeNotesCommitTimeoutRef.current);
      edgeNotesCommitTimeoutRef.current = null;
    }
    commitEdgeNotes(selectedEdge.id, edgeForm.getValues('notes'));
  }, [commitEdgeNotes, edgeForm, selectedEdge]);

  useEffect(() => {
    const nextId = selectedNode?.id || null;
    const previousId = lastSelectedNodeIdRef.current;
    if (previousId === nextId) return;
    if (previousId && previousId !== selectedNode?.id) {
      const activeField = getActiveFieldName();
      if (activeField === 'notes') {
        commitNodeNotes(previousId, nodeForm.getValues('notes'));
      }
    }
    if (nodeNotesCommitTimeoutRef.current !== null) {
      window.clearTimeout(nodeNotesCommitTimeoutRef.current);
      nodeNotesCommitTimeoutRef.current = null;
    }
    if (nodeHydrationRafRef.current !== null) {
      window.cancelAnimationFrame(nodeHydrationRafRef.current);
      nodeHydrationRafRef.current = null;
    }
    isHydratingNodeFormRef.current = true;
    const fieldToRefocus = pickActiveField(NODE_FIELD_NAMES);
    nodeForm.reset(nodeToFormValues(selectedNode));
    setNodeMeta(parseNodeDescriptionMeta(selectedNode?.description).meta);
    lastSelectedNodeIdRef.current = nextId;
    nodeHydrationRafRef.current = window.requestAnimationFrame(() => {
      isHydratingNodeFormRef.current = false;
      nodeHydrationRafRef.current = null;
      if (fieldToRefocus && selectedNode) {
        nodeForm.setFocus(fieldToRefocus);
      }
    });
  }, [commitNodeNotes, nodeForm, selectedNode]);

  useEffect(() => {
    const nextId = selectedEdge?.id || null;
    const previousId = lastSelectedEdgeIdRef.current;
    if (previousId === nextId) return;
    if (previousId && previousId !== selectedEdge?.id) {
      const activeField = getActiveFieldName();
      if (activeField === 'notes') {
        commitEdgeNotes(previousId, edgeForm.getValues('notes'));
      }
    }
    if (edgeNotesCommitTimeoutRef.current !== null) {
      window.clearTimeout(edgeNotesCommitTimeoutRef.current);
      edgeNotesCommitTimeoutRef.current = null;
    }
    if (edgeHydrationRafRef.current !== null) {
      window.cancelAnimationFrame(edgeHydrationRafRef.current);
      edgeHydrationRafRef.current = null;
    }
    isHydratingEdgeFormRef.current = true;
    const fieldToRefocus = pickActiveField(EDGE_FIELD_NAMES);
    edgeForm.reset(edgeToFormValues(selectedEdge));
    lastSelectedEdgeIdRef.current = nextId;
    edgeHydrationRafRef.current = window.requestAnimationFrame(() => {
      isHydratingEdgeFormRef.current = false;
      edgeHydrationRafRef.current = null;
      if (fieldToRefocus && selectedEdge) {
        edgeForm.setFocus(fieldToRefocus);
      }
    });
  }, [commitEdgeNotes, edgeForm, selectedEdge]);

  useEffect(() => {
    if (!selectedNode) return;
    const label = resolveNodeLabelForForm(selectedNode);
    const cleanedNotes = sanitizeNodeNotes(selectedNode.data?.notes, label, selectedNode.type);
    const currentNotes = sanitizeNotesText(selectedNode.data?.notes);
    if (cleanedNotes === currentNotes) return;
    onUpdateNode({
      ...selectedNode,
      data: {
        ...(selectedNode.data || {}),
        notes: cleanedNotes
      }
    });
  }, [onUpdateNode, selectedNode]);

  useEffect(() => {
    if (!selectedNode) return;
    if (nodeNotesCommitTimeoutRef.current !== null) {
      window.clearTimeout(nodeNotesCommitTimeoutRef.current);
    }
    nodeNotesCommitTimeoutRef.current = window.setTimeout(() => {
      commitNodeNotes(selectedNode.id, nodeNotesValue);
    }, 350);
    return () => {
      if (nodeNotesCommitTimeoutRef.current !== null) {
        window.clearTimeout(nodeNotesCommitTimeoutRef.current);
        nodeNotesCommitTimeoutRef.current = null;
      }
    };
  }, [commitNodeNotes, nodeNotesValue, selectedNode?.id]);

  useEffect(() => {
    if (!selectedEdge) return;
    if (edgeNotesCommitTimeoutRef.current !== null) {
      window.clearTimeout(edgeNotesCommitTimeoutRef.current);
    }
    edgeNotesCommitTimeoutRef.current = window.setTimeout(() => {
      commitEdgeNotes(selectedEdge.id, edgeNotesValue);
    }, 350);
    return () => {
      if (edgeNotesCommitTimeoutRef.current !== null) {
        window.clearTimeout(edgeNotesCommitTimeoutRef.current);
        edgeNotesCommitTimeoutRef.current = null;
      }
    };
  }, [commitEdgeNotes, edgeNotesValue, selectedEdge?.id]);

  useEffect(
    () => () => {
      if (nodeNotesCommitTimeoutRef.current !== null) {
        window.clearTimeout(nodeNotesCommitTimeoutRef.current);
      }
      if (edgeNotesCommitTimeoutRef.current !== null) {
        window.clearTimeout(edgeNotesCommitTimeoutRef.current);
      }
      if (nodeHydrationRafRef.current !== null) {
        window.cancelAnimationFrame(nodeHydrationRafRef.current);
      }
      if (edgeHydrationRafRef.current !== null) {
        window.cancelAnimationFrame(edgeHydrationRafRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedNode) return;
    const parsed = nodeSchema.safeParse(nodeValues);
    if (!parsed.success) return;

    const next = parsed.data;
    const nextDescription = buildDescriptionWithNodeMeta(nodeMeta, next.description || undefined);
    const normalizedAccountType = normalizeNodeAccountType(next.accountType);
    const nextType = next.type || selectedNode.type;
    const identity = resolveNodeIdentityState(selectedNode, next.label, nextType);
    const nextDisplayStyle = next.displayStyle || resolveNodeDisplayStyle(selectedNode);
    const nextBorderStyle = next.borderStyle || resolveNodeBorderStyle(selectedNode);
    const nextNodeData = {
      ...selectedNode.data,
      isNameAuto: identity.isNameAuto,
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
      notes: sanitizeNodeNotes(selectedNode.data?.notes, identity.label, nextType)
    };

    const nextNode: Node = {
      ...selectedNode,
      label: identity.label,
      isNameAuto: identity.isNameAuto,
      type: nextType,
      shape: next.shape,
      description: nextDescription,
      color: next.fillColor || undefined,
      data: nextNodeData
    };

    const hasDataChanged =
      normalizeNodeAccountType(selectedNode.data?.accountType, selectedNode.accountType) !==
        (nextNode.data?.accountType || undefined) ||
      (selectedNode.data?.accountDetails || undefined) !== (nextNode.data?.accountDetails || undefined) ||
      (selectedNode.data?.showLabel ?? false) !== (nextNode.data?.showLabel ?? false) ||
      (selectedNode.data?.showType ?? true) !== (nextNode.data?.showType ?? true) ||
      (selectedNode.data?.showAccount ?? true) !== (nextNode.data?.showAccount ?? true) ||
      (selectedNode.data?.showAccountDetails ?? false) !== (nextNode.data?.showAccountDetails ?? false) ||
      (selectedNode.data?.displayStyle || resolveNodeDisplayStyle(selectedNode)) !==
        (nextNode.data?.displayStyle || resolveNodeDisplayStyle(nextNode)) ||
      (selectedNode.data?.shape || resolveNodeShape(selectedNode)) !==
        (nextNode.data?.shape || resolveNodeShape(nextNode)) ||
      (selectedNode.data?.fillColor || selectedNode.color || undefined) !==
        (nextNode.data?.fillColor || nextNode.color || undefined) ||
      (selectedNode.data?.borderColor || undefined) !== (nextNode.data?.borderColor || undefined) ||
      (selectedNode.data?.borderWidth ?? resolveNodeBorderWidth(selectedNode)) !==
        (nextNode.data?.borderWidth ?? resolveNodeBorderWidth(nextNode)) ||
      (selectedNode.data?.borderStyle || resolveNodeBorderStyle(selectedNode)) !==
        (nextNode.data?.borderStyle || resolveNodeBorderStyle(nextNode)) ||
      (selectedNode.data?.opacity ?? resolveNodeOpacity(selectedNode)) !==
        (nextNode.data?.opacity ?? resolveNodeOpacity(nextNode)) ||
      !!selectedNode.data?.isNameAuto !== !!nextNode.data?.isNameAuto ||
      !!selectedNode.data?.isPhantom !== !!nextNode.data?.isPhantom ||
      !!selectedNode.data?.isLocked !== !!nextNode.data?.isLocked ||
      (selectedNode.data?.scale ?? resolveNodeScale(selectedNode)) !==
        (nextNode.data?.scale ?? resolveNodeScale(nextNode));

    const hasChanged =
      selectedNode.label !== nextNode.label ||
      !!selectedNode.isNameAuto !== !!nextNode.isNameAuto ||
      selectedNode.type !== nextNode.type ||
      selectedNode.shape !== nextNode.shape ||
      selectedNode.description !== nextNode.description ||
      selectedNode.color !== nextNode.color ||
      hasDataChanged;

    if (hasChanged) onUpdateNode(nextNode);
  }, [nodeValues, nodeMeta, selectedNode, onUpdateNode]);

  useEffect(() => {
    if (!selectedEdge) return;
    const parsed = edgeSchema.safeParse(edgeValues);
    if (!parsed.success) return;

    const next = parsed.data;
    const resolvedTiming =
      next.timingPreset === 'other'
        ? (next.timingCustom || '').trim()
        : (next.timingPreset || '').trim();
    const normalizedFlowTypeCustom = (next.flowTypeCustom || '').trim();
    const normalizedRailCustom = (next.railCustom || '').trim();
    const nextEdge: Edge = {
      ...selectedEdge,
      label: next.label,
      rail: next.rail || PaymentRail.BLANK,
      timing: resolvedTiming || undefined,
      style: next.style,
      pathType: next.pathType,
      thickness: next.thickness,
      showArrowHead: next.showArrowHead,
      showMidArrow: next.showMidArrow,
      data: {
        ...(selectedEdge.data || {}),
        notes: sanitizeEdgeNotes(selectedEdge.data?.notes),
        flowType: next.flowType || undefined,
        flowTypeCustom: normalizedFlowTypeCustom || undefined,
        timingPreset: next.timingPreset || undefined,
        timingCustom: (next.timingCustom || '').trim() || undefined,
        railCustom: normalizedRailCustom || undefined
      }
    };

    const hasChanged =
      selectedEdge.label !== nextEdge.label ||
      selectedEdge.rail !== nextEdge.rail ||
      selectedEdge.timing !== nextEdge.timing ||
      selectedEdge.style !== nextEdge.style ||
      selectedEdge.pathType !== nextEdge.pathType ||
      (selectedEdge.thickness ?? 2) !== (nextEdge.thickness ?? 2) ||
      !!selectedEdge.showArrowHead !== !!nextEdge.showArrowHead ||
      !!selectedEdge.showMidArrow !== !!nextEdge.showMidArrow ||
      (selectedEdge.data?.flowType || undefined) !== (nextEdge.data?.flowType || undefined) ||
      (selectedEdge.data?.flowTypeCustom || undefined) !==
        (nextEdge.data?.flowTypeCustom || undefined) ||
      (selectedEdge.data?.timingPreset || undefined) !== (nextEdge.data?.timingPreset || undefined) ||
      (selectedEdge.data?.timingCustom || undefined) !== (nextEdge.data?.timingCustom || undefined) ||
      (selectedEdge.data?.railCustom || undefined) !== (nextEdge.data?.railCustom || undefined);

    if (hasChanged) onUpdateEdge(nextEdge);
  }, [edgeValues, selectedEdge, onUpdateEdge]);

  const renderEmptyState = () => (
    <div className="mb-3 rounded-lg border border-divider/45 bg-surface-elevated/65 p-3 text-left shadow-[var(--ff-shadow-soft)]">
      <p className="text-[12px] text-text-muted">
        Select a node or edge to edit properties, or start by inserting a block.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={onOpenInsertPanel}>
          Open Insert
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onOpenCommandPalette}>
          Command palette
        </Button>
      </div>
    </div>
  );

  const renderLaneState = () => {
    if (!selectedSwimlaneId) return null;
    const handleLaneNameCommit = () => {
      onRenameSwimlane(selectedSwimlaneId, laneNameDraft);
    };
    const laneToggleClass = (active: boolean) =>
      active ? 'status-chip !border-accent/70 !bg-accent/12 !text-accent' : 'status-chip';
    return (
      <div data-testid="inspector-swimlane-panel" className="mb-3 rounded-lg border border-divider/70 bg-surface-muted/40 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[12px] font-semibold text-text-secondary">Lane Properties</p>
          <button
            type="button"
            onClick={() => onSelectSwimlane(null)}
            className="status-chip !h-7 !px-2.5"
          >
            Clear lane selection
          </button>
        </div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted" htmlFor="lane-name-input">
          Lane Name
        </label>
        <input
          ref={laneNameInputRef}
          id="lane-name-input"
          data-testid="inspector-swimlane-name"
          value={laneNameDraft}
          onChange={(event) => setLaneNameDraft(event.target.value)}
          onBlur={handleLaneNameCommit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleLaneNameCommit();
              (event.currentTarget as HTMLInputElement).blur();
            }
          }}
          className="w-full rounded-xl border border-divider/70 bg-surface-panel px-3 py-2 text-[13px] text-text-primary outline-none transition focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
          placeholder={LANE_NAME_PLACEHOLDER}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="inspector-swimlane-toggle-collapse"
            onClick={() => onToggleSwimlaneCollapsed(selectedSwimlaneId)}
            className={laneToggleClass(isSelectedLaneCollapsed)}
          >
            {isSelectedLaneCollapsed ? 'Expand lane' : 'Collapse lane'}
          </button>
          <button
            type="button"
            data-testid="inspector-swimlane-toggle-lock"
            onClick={() => onToggleSwimlaneLocked(selectedSwimlaneId)}
            className={laneToggleClass(isSelectedLaneLocked)}
          >
            {isSelectedLaneLocked ? 'Unlock lane' : 'Lock lane'}
          </button>
          <button
            type="button"
            data-testid="inspector-swimlane-toggle-hide"
            onClick={() => onToggleSwimlaneHidden(selectedSwimlaneId)}
            className={laneToggleClass(isSelectedLaneHidden)}
          >
            {isSelectedLaneHidden ? 'Show lane' : 'Hide lane'}
          </button>
        </div>
        <div className="mt-3 border-t border-divider/70 pt-2">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">All lanes</p>
          <div className="flex flex-wrap gap-2">
            {swimlaneLabels.map((laneLabel, index) => {
              const laneId = index + 1;
              const isActive = selectedSwimlaneId === laneId;
              return (
                <button
                  key={`lane-pill-${laneId}`}
                  type="button"
                  onClick={() => onSelectSwimlane(laneId)}
                  className={isActive ? 'status-chip !border-accent/70 !bg-accent/12 !text-accent' : 'status-chip'}
                >
                  {laneLabel || LANE_NAME_PLACEHOLDER}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className="flex h-full flex-col bg-surface-panel/85"
      data-canvas-interactive="true"
      onPointerDownCapture={(event) => event.stopPropagation()}
      onMouseDownCapture={(event) => event.stopPropagation()}
    >
      <div
        className="sticky top-0 z-10 border-b border-divider/65 bg-surface-panel/88 px-3 py-2 backdrop-blur"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-accent" />
            <h2 className="text-[15px] font-semibold text-text-primary">Inspector</h2>
          </div>
          <button
            onClick={onClose}
            className="ui-icon-button h-8 w-8"
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          data-testid="inspector-mode-title"
          className="mb-2 rounded-lg border border-divider/45 bg-surface-muted/40 px-2.5 py-2"
        >
          <div className="text-[11px] font-semibold text-text-muted">
            {modeMeta.title}
          </div>
          <div className="mt-0.5 truncate text-[13px] font-semibold text-text-primary">
            {modeMeta.detail}
          </div>
        </div>
      </div>

      <div ref={scrollBodyRef} data-testid="inspector-scroll-body" className="custom-scrollbar flex-1 overflow-y-auto p-2.5">
        {selectionMode === 'node' && selectedNode ? (
          <div className="mb-2 flex justify-end">
            <button type="button" onClick={onDuplicateSelection} className="status-chip !h-7 !px-2.5">
              Duplicate
            </button>
          </div>
        ) : null}

        {selectionMode === 'empty' ? renderEmptyState() : null}
        {selectionMode === 'lane' ? renderLaneState() : null}

        {selectionMode === 'node' && selectedNode ? (
          <NodeInspectorSections
            register={nodeForm.register}
            setValue={nodeForm.setValue}
            values={nodeValues}
            isNameAuto={selectedNodeIsNameAuto}
            nodeDetailsOpen={nodeDetailsOpen}
            onToggleNodeDetails={() => setNodeDetailsOpen((prev) => !prev)}
            nodeMeta={nodeMeta}
            onNodeMetaChange={handleNodeMetaChange}
            pinnedNodeAttributes={pinnedNodeAttributes}
            onTogglePinnedNodeAttribute={onTogglePinnedNodeAttribute}
            onResetNodeSection={handleResetNodeFields}
            onApplyNodeSection={handleApplyToSimilarNodes}
            onNotesBlur={handleNodeNotesBlur}
          />
        ) : null}

        {selectionMode === 'edge' && selectedEdge ? (
          <EdgeInspectorSections
            register={edgeForm.register}
            setValue={edgeForm.setValue}
            values={edgeValues}
            onResetEdgeSection={handleResetEdgeFields}
            onResetStylingSection={handleResetEdgeStyling}
            onNotesBlur={handleEdgeNotesBlur}
          />
        ) : null}
      </div>
    </div>
  );
};

export default Inspector;
