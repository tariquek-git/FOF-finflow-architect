import React, { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Node,
  Edge,
  EntityType,
  PaymentRail,
  TimingType,
  AccountType,
  FlowDirection,
  ReconciliationMethod
} from '../types';
import {
  X,
  DollarSign,
  MousePointer2,
  FileJson,
  ShieldCheck,
  Zap,
  Repeat,
  ListOrdered
} from 'lucide-react';

interface InspectorProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onUpdateNode: (node: Node) => void;
  onUpdateEdge: (edge: Edge) => void;
  isDarkMode: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  { hex: '#020617', label: 'Dark' },
  { hex: '#ffffff', label: 'Light' },
  { hex: '#ef4444', label: 'Danger' },
  { hex: '#10b981', label: 'Success' },
  { hex: '#6366f1', label: 'Indigo' }
];

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

const FIELD_HELPERS: Record<string, string> = {
  direction: 'Use Push/Pull/Settlement to describe how value or messages move.',
  rail: 'Select the operating network or rail for this connection.',
  timing: 'Capture settlement cadence or SLA window for this flow.'
};

const Section: React.FC<{ title: string; icon: React.ReactNode; children?: React.ReactNode }> = ({
  title,
  icon,
  children
}) => (
  <div className="mb-5 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 animate-in fade-in slide-in-from-right-1 duration-200">
    <div className="mb-3 flex items-center gap-2 border-b border-slate-200 px-1 pb-1.5 dark:border-slate-700">
      <div className="text-blue-600 dark:text-blue-300">{icon}</div>
      <h3 className="ui-section-title">{title}</h3>
    </div>
    <div className="space-y-3 px-1">{children}</div>
  </div>
);

const Field: React.FC<{ label: string; helper?: string; children?: React.ReactNode }> = ({ label, helper, children }) => (
  <div className="flex flex-col gap-1">
    <label className="ml-0.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-slate-500 dark:text-slate-400">
      {label}
    </label>
    {children}
    {helper && <span className="ml-0.5 text-[10px] text-slate-500 dark:text-slate-400">{helper}</span>}
  </div>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input
    {...props}
    className="ui-input h-9 w-full px-3 text-xs font-medium outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
  />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select
    {...props}
    className="ui-input h-9 w-full cursor-pointer appearance-none px-3 text-xs font-medium outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
  >
    {props.children}
  </select>
);

const DetailToggle: React.FC<{
  isActive: boolean;
  label: string;
  onClick: () => void;
}> = ({ isActive, label, onClick }) => (
  <button
    onClick={onClick}
    className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
    }`}
  >
    {label}
  </button>
);

const nodeToFormValues = (node: Node | undefined): NodeFormValues => ({
  label: node?.label || '',
  type: node?.type || EntityType.PROCESSOR,
  accountType: node?.accountType || '',
  description: node?.description || '',
  color: node?.color || ''
});

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

const Inspector: React.FC<InspectorProps> = ({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  onUpdateNode,
  onUpdateEdge,
  isDarkMode,
  onClose
}) => {
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId),
    [nodes, selectedNodeId]
  );
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId),
    [edges, selectedEdgeId]
  );
  const [detailLevel, setDetailLevel] = useState<'basic' | 'advanced'>('basic');

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

  useEffect(() => {
    setDetailLevel('basic');
  }, [selectedNodeId, selectedEdgeId]);

  useEffect(() => {
    nodeForm.reset(nodeToFormValues(selectedNode));
  }, [selectedNode?.id, nodeForm]);

  useEffect(() => {
    edgeForm.reset(edgeToFormValues(selectedEdge));
  }, [selectedEdge?.id, edgeForm]);

  useEffect(() => {
    if (!selectedNode) return;
    const parsed = nodeSchema.safeParse(nodeValues);
    if (!parsed.success) return;

    const next = parsed.data;
    const nextNode: Node = {
      ...selectedNode,
      label: next.label,
      type: next.type,
      accountType: next.accountType || undefined,
      description: next.description || undefined,
      color: next.color || undefined
    };

    const hasChanged =
      selectedNode.label !== nextNode.label ||
      selectedNode.type !== nextNode.type ||
      selectedNode.accountType !== nextNode.accountType ||
      selectedNode.description !== nextNode.description ||
      selectedNode.color !== nextNode.color;

    if (hasChanged) onUpdateNode(nextNode);
  }, [nodeValues, selectedNode, onUpdateNode]);

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

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center opacity-40">
        <MousePointer2 className="mb-4 h-12 w-12 text-slate-300" />
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          Select an object to inspect properties
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex h-full flex-col ${
        isDarkMode
          ? 'bg-slate-900'
          : 'bg-white'
      }`}
    >
      <div className={`sticky top-0 z-10 flex items-center justify-between border-b px-4 py-3 backdrop-blur ${isDarkMode ? 'border-slate-700 bg-slate-900/95' : 'border-slate-200 bg-white/95'}`}>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500" />
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] dark:text-slate-200">
            {selectedNode ? 'Entity Profile' : 'Link Logic'}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-slate-300 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-800">
            <DetailToggle
              isActive={detailLevel === 'basic'}
              label="Basic"
              onClick={() => setDetailLevel('basic')}
            />
            <DetailToggle
              isActive={detailLevel === 'advanced'}
              label="Advanced"
              onClick={() => setDetailLevel('advanced')}
            />
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-slate-300 p-1.5 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-700"
            aria-label="Close inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="custom-scrollbar flex-1 overflow-y-auto p-4">
        {selectedNode && detailLevel === 'basic' && (
          <Section title="Entity Basics" icon={<Zap className="h-3.5 w-3.5" />}>
            <Field label="Entity Label">
              <Input {...nodeForm.register('label')} />
            </Field>
            <Field label="Archetype">
              <Select {...nodeForm.register('type')}>
                {Object.values(EntityType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Brand Context">
              <div className="flex gap-2 pt-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.hex}
                    onClick={() => nodeForm.setValue('color', color.hex, { shouldDirty: true, shouldValidate: true })}
                    title={color.label}
                    className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      selectedNodeColor === color.hex
                        ? 'scale-110 border-blue-500 shadow-lg'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
            </Field>
          </Section>
        )}

        {selectedNode && detailLevel === 'advanced' && (
          <Section title="Entity Advanced" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
            <Field label="Accounting Record">
              <Select {...nodeForm.register('accountType')}>
                <option value="">None / Off-Ledger</option>
                {Object.values(AccountType).map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Entity Notes">
              <textarea
                {...nodeForm.register('description')}
                className="ui-input h-24 w-full resize-none p-3 text-xs outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                placeholder="Optional notes for this entity..."
              />
            </Field>
          </Section>
        )}

        {selectedEdge && detailLevel === 'basic' && (
          <>
            <Section title="Link Basics" icon={<ListOrdered className="h-3.5 w-3.5" />}>
              <Field label="Technical Description">
                <Input {...edgeForm.register('label')} />
              </Field>
              <Field label="Infrastructure Rail" helper={FIELD_HELPERS.rail}>
                <Select {...edgeForm.register('rail')}>
                  <option value="">Generic Path</option>
                  {Object.values(PaymentRail)
                    .filter((rail) => rail !== '')
                    .map((rail) => (
                      <option key={rail} value={rail}>
                        {rail}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Accounting Direction" helper={FIELD_HELPERS.direction}>
                <Select {...edgeForm.register('direction')}>
                  {Object.values(FlowDirection).map((direction) => (
                    <option key={direction} value={direction}>
                      {direction}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="SLA / Timing" helper={FIELD_HELPERS.timing}>
                <Select {...edgeForm.register('timing')}>
                  <option value="">Undetermined</option>
                  {Object.values(TimingType).map((timing) => (
                    <option key={timing} value={timing}>
                      {timing}
                    </option>
                  ))}
                </Select>
              </Field>
            </Section>

            <Section title="Financial Data" icon={<DollarSign className="h-3.5 w-3.5" />}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Base Amount">
                  <Input {...edgeForm.register('amount')} placeholder="0.00" />
                </Field>
                <Field label="ISO Currency">
                  <Input {...edgeForm.register('currency')} placeholder="USD" />
                </Field>
              </div>
            </Section>
          </>
        )}

        {selectedEdge && detailLevel === 'advanced' && (
          <>
            <Section title="Link Advanced" icon={<ListOrdered className="h-3.5 w-3.5" />}>
              <Field label="Order">
                <Input type="number" min="0" {...edgeForm.register('sequence', { valueAsNumber: true })} />
              </Field>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={() =>
                    edgeForm.setValue('isFX', !edgeIsFX, {
                      shouldDirty: true,
                      shouldValidate: true
                    })
                  }
                  className={`rounded-md border px-3 py-2 text-[10px] font-semibold uppercase transition-all ${
                    edgeIsFX
                      ? 'border-emerald-600 bg-emerald-500 text-white shadow-md'
                      : 'border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800'
                  }`}
                >
                  Foreign Exchange (FX)
                </button>
                <button
                  onClick={() =>
                    edgeForm.setValue('isExceptionPath', !edgeIsExceptionPath, {
                      shouldDirty: true,
                      shouldValidate: true
                    })
                  }
                  className={`rounded-md border px-3 py-2 text-[10px] font-semibold uppercase transition-all ${
                    edgeIsExceptionPath
                      ? 'bg-rose-500 border-rose-600 text-white shadow-md'
                      : 'border-slate-300 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800'
                  }`}
                >
                  Exception / Return Path
                </button>
              </div>
              {edgeIsFX && (
                <Field label="Market Pair">
                  <Input {...edgeForm.register('fxPair')} placeholder="USD/EUR" />
                </Field>
              )}
            </Section>

            <Section title="Reconciliation" icon={<Repeat className="h-3.5 w-3.5" />}>
              <Field label="Reco Logic">
                <Select {...edgeForm.register('recoMethod')}>
                  {Object.values(ReconciliationMethod).map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </Select>
              </Field>
            </Section>

            <Section title="Architecture" icon={<FileJson className="h-3.5 w-3.5" />}>
              <Field label="Message Format">
                <Input {...edgeForm.register('dataSchema')} placeholder="e.g. ISO 20022" />
              </Field>
              <Field label="Architect Notes">
                <textarea
                  {...edgeForm.register('description')}
                  className="ui-input h-24 w-full resize-none p-3 text-xs outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                  placeholder="Explain cut-offs, retries, dependencies..."
                />
              </Field>
            </Section>
          </>
        )}
      </div>
    </div>
  );
};

export default Inspector;
