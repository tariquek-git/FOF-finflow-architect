import React, { useState } from 'react';
import {
  Node,
  Edge,
  ConnectorPresetKey,
  EntityType,
  PaymentRail,
  SettlementType,
  TimingType,
  FlowDirection,
  BankAccountType,
  EndPointType,
  GateCategory,
  GateControl,
  CardNetwork,
  TransactionLifecycle,
  ArrowType,
  NodeShape
} from '../types';
import {
  BANK_ACCOUNT_TYPE_ORDER,
  BANK_ENTITY_TYPES,
  CONNECTOR_PRESETS,
  CONNECTOR_PRESET_ORDER,
  GATE_CONTROLS_BY_CATEGORY
} from '../constants';
import { 
  Settings, X, Activity, CornerDownRight, ArrowRight, ArrowLeft, ArrowRightLeft, 
  DollarSign, Maximize2, Ghost, Palette, MousePointer2, Briefcase, CreditCard,
  MoveHorizontal, Layers, Map, FileJson, Gauge, Sparkles, Wand2
} from 'lucide-react';

interface InspectorProps {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onUpdateNode: (node: Node) => void;
  onUpdateEdge: (edge: Edge) => void;
  onApplyEdgePreset: (edgeId: string, preset: ConnectorPresetKey) => void;
  onSelectNode: (id: string | null) => void;
  onSelectEdge: (id: string | null) => void;
  isDarkMode: boolean;
  onClose: () => void;
}

// "Banking Safe" Palette
const PRESET_COLORS = [
  { hex: '#020617', label: 'Black' },     
  { hex: '#ffffff', label: 'White' },
  { hex: '#f8fafc', label: 'Slate 50' },
  { hex: '#cbd5e1', label: 'Slate 300' },
  { hex: '#94a3b8', label: 'Slate 400' }, 
  { hex: '#fca5a5', label: 'Red' },      
  { hex: '#fdba74', label: 'Orange' },   
  { hex: '#fcd34d', label: 'Amber' },    
  { hex: '#86efac', label: 'Green' },    
  { hex: '#93c5fd', label: 'Blue' },     
  { hex: '#a5b4fc', label: 'Indigo' },   
  { hex: '#d8b4fe', label: 'Purple' },   
  { hex: '#f0abfc', label: 'Fuchsia' },  
];

const Inspector = React.memo<InspectorProps>(({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
  onUpdateNode,
  onUpdateEdge,
  onApplyEdgePreset,
  onSelectNode,
  onSelectEdge,
  isDarkMode,
  onClose
}) => {
  const [assistEnabled, setAssistEnabled] = useState(false);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);
  const hasSelection = !!selectedNode || !!selectedEdge;
  const isSelectedNodeBank = !!selectedNode && BANK_ENTITY_TYPES.includes(selectedNode.type);

  const panelBg = isDarkMode ? 'bg-slate-900' : 'bg-white';
  const borderColor = isDarkMode ? 'border-slate-800' : 'border-slate-200';
  const labelColor = isDarkMode ? 'text-slate-500' : 'text-slate-400';
  const valueColor = isDarkMode ? 'text-slate-200' : 'text-slate-800';

  const formatAmount = (val: string) => {
    const numbers = val.replace(/[^0-9.]/g, '');
    if (!numbers) return '';
    return '$' + Number(numbers).toLocaleString();
  };

  const handleFXToggle = () => {
      if (!selectedEdge) return;
      const newState = !selectedEdge.isFX;
      const updates: Partial<Edge> = { isFX: newState };
      if (newState) {
          if (selectedEdge.timing !== TimingType.T_PLUS_3 && selectedEdge.timing !== TimingType.T_PLUS_2) {
              updates.timing = TimingType.T_PLUS_2;
          }
      }
      onUpdateEdge({ ...selectedEdge, ...updates, connectorPreset: 'custom' });
  };

  const updateSelectedEdge = (updates: Partial<Edge>) => {
    if (!selectedEdge) return;
    onUpdateEdge({
      ...selectedEdge,
      ...updates,
      connectorPreset: 'custom'
    });
  };

  const updateSelectedNode = (updates: Partial<Node>) => {
    if (!selectedNode) return;
    onUpdateNode({
      ...selectedNode,
      ...updates
    });
  };

  const toggleBankAccountType = (type: BankAccountType) => {
    if (!selectedNode || !isSelectedNodeBank) return;
    const current = new Set(selectedNode.accountTypes || []);
    if (current.has(type)) {
      current.delete(type);
    } else {
      current.add(type);
    }
    updateSelectedNode({ accountTypes: Array.from(current) });
  };

  const toggleGateControl = (control: GateControl) => {
    if (!selectedNode || selectedNode.type !== EntityType.GATE) return;
    const current = new Set(selectedNode.gateChecks || []);
    if (current.has(control)) {
      current.delete(control);
    } else {
      current.add(control);
    }
    updateSelectedNode({ gateChecks: Array.from(current) });
  };

  const autoFillNodeDetails = () => {
    if (!selectedNode) return;
    const bankHint = isSelectedNodeBank
      ? `Accounts: ${(selectedNode.accountTypes || []).join(', ') || 'Not specified'}`
      : '';
    const gateHint =
      selectedNode.type === EntityType.GATE
        ? `Gate Controls: ${(selectedNode.gateChecks || []).join(', ') || 'Not specified'}`
        : '';
    const suggested = [
      `${selectedNode.label} is modeled as ${selectedNode.type} in this flow.`,
      selectedNode.swimlaneId ? `Operates primarily in Lane ${selectedNode.swimlaneId}.` : '',
      bankHint,
      gateHint
    ]
      .filter(Boolean)
      .join(' ');
    updateSelectedNode({
      description: selectedNode.description?.trim() ? selectedNode.description : suggested
    });
  };

  const autoFillEdgeDetails = () => {
    if (!selectedEdge) return;
    const isInstant = (selectedEdge.settlementTiming || selectedEdge.timing || '').toLowerCase().includes('instant');
    const suggestedSystem =
      selectedEdge.rail === PaymentRail.CARD_NETWORK
        ? 'Card Processor Ledger'
        : selectedEdge.rail === PaymentRail.ACH
          ? 'Core Banking ACH Ledger'
          : selectedEdge.rail === PaymentRail.INTERNAL_LEDGER
            ? 'Internal Ledger'
            : 'Payments Orchestration';
    updateSelectedEdge({
      riskOwner: selectedEdge.riskOwner || 'Payments Operations',
      fraudLiabilityOwner: selectedEdge.fraudLiabilityOwner || 'Risk and Compliance',
      dataExchanged: selectedEdge.dataExchanged || (selectedEdge.rail ? `${selectedEdge.rail} transfer instruction` : 'Transfer instruction'),
      dataLatency: selectedEdge.dataLatency || (isInstant ? 'Real-time' : 'Batch'),
      systemOfRecord: selectedEdge.systemOfRecord || suggestedSystem,
      finality: selectedEdge.finality || (isInstant ? 'Near-immediate finality' : 'Deferred finality'),
      cutoffDependency: selectedEdge.cutoffDependency || (isInstant ? 'No cutoff dependency' : 'Dependent on processing window')
    });
  };

  // Helper Component for Property Row
  const PropRow = ({ label, children, icon }: { label: string, children: React.ReactNode, icon?: React.ReactNode }) => (
      <div className="grid grid-cols-[100px_1fr] items-center gap-2 py-2 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
          <div className={`text-[10px] font-medium uppercase tracking-wider flex items-center gap-1.5 ${labelColor}`}>
              {icon && <span className="opacity-70 group-hover:opacity-100 transition-opacity">{icon}</span>}
              {label}
          </div>
          <div className="min-w-0">
              {children}
          </div>
      </div>
  );

  const TransparentInput = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
      <input 
          {...props}
          className={`w-full bg-transparent border-none p-0 text-sm font-medium focus:ring-0 focus:outline-none placeholder:opacity-30 ${valueColor} ${props.className}`} 
      />
  );

  const TransparentSelect = (props: React.SelectHTMLAttributes<HTMLSelectElement>) => (
      <select 
          {...props}
          className={`w-full bg-transparent border-none p-0 text-sm font-medium focus:ring-0 focus:outline-none cursor-pointer ${valueColor} ${props.className}`}
      >
          {props.children}
      </select>
  );

  // --- EMPTY STATE ---
  if (!hasSelection) {
    return (
      <div className={`flex h-full flex-col items-center justify-center p-8 text-center ${panelBg} border-l ${borderColor}`}>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
             <MousePointer2 className={`w-8 h-8 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`} />
        </div>
        <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>No Selection</h3>
        <p className="text-xs text-slate-500 max-w-[200px]">
             Select a node or connection on the canvas to edit its properties.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex h-full flex-col ${panelBg} border-l ${borderColor}`}>
      
      {/* HEADER */}
      <div className={`flex items-center justify-between border-b px-4 py-3 ${borderColor}`}>
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-indigo-500" />
          <h2 className={`text-sm font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
            {selectedNode ? 'Entity Properties' : 'Connection Properties'}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className={`px-4 py-2 border-b flex items-center justify-between ${borderColor}`}>
        <div className="flex items-center gap-2">
          <Sparkles className={`w-3.5 h-3.5 ${assistEnabled ? 'text-indigo-500' : 'text-slate-400'}`} />
          <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            Smart Assist
          </span>
        </div>
        <button 
          onClick={() => setAssistEnabled((prev) => !prev)}
          className={`w-8 h-4 rounded-full transition-colors relative ${assistEnabled ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-700'}`}
          title="Enable smart autofill actions"
        >
          <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${assistEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">

        {/* --- NODE INSPECTOR --- */}
        {selectedNode && (
          <div className="space-y-4">
             
             {/* 1. Identity Group */}
             <div className="space-y-1">
                <PropRow label="Label">
                    <TransparentInput
                        value={selectedNode.label}
                        onChange={(e) => onUpdateNode({ ...selectedNode, label: e.target.value })}
                    />
                </PropRow>
                <PropRow label="Type">
                    <TransparentSelect
                        value={selectedNode.type}
                        onChange={(e) => onUpdateNode({ ...selectedNode, type: e.target.value as EntityType })}
                    >
                        {Object.values(EntityType).map((type) => (
                            <option key={type} value={type}>{type}</option>
                        ))}
                    </TransparentSelect>
                </PropRow>

                {selectedNode.type === EntityType.END_POINT && (
                     <PropRow label="User Class">
                        <TransparentSelect
                            value={selectedNode.endPointType || ''}
                            onChange={(e) => onUpdateNode({ ...selectedNode, endPointType: e.target.value as EndPointType })}
                        >
                            <option value="">(None)</option>
                            {Object.values(EndPointType).map((t) => <option key={t} value={t}>{t}</option>)}
                        </TransparentSelect>
                     </PropRow>
                )}

                {isSelectedNodeBank && (
                  <PropRow label="Accounts">
                    <div className="flex flex-wrap gap-1">
                      {BANK_ACCOUNT_TYPE_ORDER.map((accountType) => {
                        const active = (selectedNode.accountTypes || []).includes(accountType);
                        return (
                          <button
                            key={accountType}
                            onClick={() => toggleBankAccountType(accountType)}
                            className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                              active
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700'
                                : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                            }`}
                          >
                            {accountType}
                          </button>
                        );
                      })}
                    </div>
                  </PropRow>
                )}

                {selectedNode.type === EntityType.GATE && (
                  <PropRow label="Category">
                    <TransparentSelect
                      value={selectedNode.gateCategory || ''}
                      onChange={(e) => {
                        const nextCategory = (e.target.value || undefined) as GateCategory | undefined;
                        updateSelectedNode({
                          gateCategory: nextCategory,
                          gateChecks: nextCategory ? [...GATE_CONTROLS_BY_CATEGORY[nextCategory]] : []
                        });
                      }}
                    >
                      <option value="">(None)</option>
                      {Object.values(GateCategory).map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </TransparentSelect>
                  </PropRow>
                )}
             </div>

             <div className={`h-px mx-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />

             {selectedNode.type === EntityType.GATE && (
                <>
                  <div className="space-y-1">
                    <div className="px-2 pb-1 pt-2">
                      <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>Gate Controls</span>
                    </div>
                    <div className="px-2 flex flex-wrap gap-1">
                      {(selectedNode.gateCategory
                        ? GATE_CONTROLS_BY_CATEGORY[selectedNode.gateCategory]
                        : Object.values(GateControl)
                      ).map((control) => {
                        const active = (selectedNode.gateChecks || []).includes(control);
                        return (
                          <button
                            key={control}
                            onClick={() => toggleGateControl(control)}
                            className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                              active
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700'
                                : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                            }`}
                          >
                            {control}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className={`h-px mx-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                </>
             )}

             {isSelectedNodeBank && (
                <>
                  <div className="space-y-1">
                    <div className="px-2 pb-1 pt-2">
                      <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>Bank Accounts</span>
                    </div>
                    <PropRow label="Owner">
                      <TransparentInput
                        value={selectedNode.ownerOfRecord || ''}
                        onChange={(e) => updateSelectedNode({ ownerOfRecord: e.target.value })}
                        placeholder="Owner of record"
                      />
                    </PropRow>
                    <PropRow label="Beneficial">
                      <TransparentInput
                        value={selectedNode.beneficialOwner || ''}
                        onChange={(e) => updateSelectedNode({ beneficialOwner: e.target.value })}
                        placeholder="Beneficial owner"
                      />
                    </PropRow>
                    <PropRow label="Balance Sheet">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedNode.onBalanceSheet || false}
                          onChange={(e) => updateSelectedNode({ onBalanceSheet: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </PropRow>
                    <PropRow label="Access">
                      <TransparentInput
                        value={selectedNode.accessRights || ''}
                        onChange={(e) => updateSelectedNode({ accessRights: e.target.value })}
                        placeholder="Read, Write, Approve"
                      />
                    </PropRow>
                    <PropRow label="Reconcile">
                      <TransparentInput
                        value={selectedNode.reconciliationOwner || ''}
                        onChange={(e) => updateSelectedNode({ reconciliationOwner: e.target.value })}
                        placeholder="Reconciliation owner"
                      />
                    </PropRow>
                  </div>
                  <div className={`h-px mx-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />
                </>
             )}

             {/* 2. Visuals Group */}
             <div className="space-y-1">
                 <div className="px-2 pb-1 pt-2">
                     <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>Appearance</span>
                 </div>
                 
                 <PropRow label="Shape">
                    <div className="flex gap-1">
                        {[
                          NodeShape.RECTANGLE,
                          ...(selectedNode.type === EntityType.GATE ? [] : [NodeShape.CIRCLE, NodeShape.DIAMOND])
                        ].map(s => (
                            <button
                                key={s}
                                onClick={() => onUpdateNode({...selectedNode, shape: s})}
                                className={`w-6 h-6 rounded flex items-center justify-center border ${selectedNode.shape === s ? 'border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400'}`}
                            >
                                <div className={`w-3 h-3 border-2 border-current ${s === NodeShape.CIRCLE ? 'rounded-full' : s === NodeShape.DIAMOND ? 'rotate-45 rounded-[1px]' : 'rounded-sm'}`} />
                            </button>
                        ))}
                    </div>
                 </PropRow>

                 <PropRow label="Color">
                    <div className="flex flex-wrap gap-1.5">
                        {PRESET_COLORS.map(c => (
                            <button
                                key={c.hex}
                                onClick={() => onUpdateNode({ ...selectedNode, color: c.hex })}
                                className={`w-4 h-4 rounded-full border shadow-sm transition-transform hover:scale-125 ${selectedNode.color === c.hex ? 'ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900' : 'border-slate-200 dark:border-slate-600'}`}
                                style={{ backgroundColor: c.hex }}
                                title={c.label}
                            />
                        ))}
                    </div>
                 </PropRow>

                 <PropRow label="Phantom" icon={<Ghost className="w-3 h-3"/>}>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={selectedNode.isPhantom || false}
                            onChange={(e) => onUpdateNode({ ...selectedNode, isPhantom: e.target.checked })}
                            className="sr-only peer" 
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                 </PropRow>

                 <PropRow label="Layer" icon={<Layers className="w-3 h-3"/>}>
                     <div className="flex items-center gap-2">
                        <span className={`text-xs ${valueColor}`}>Z: {selectedNode.zIndex || 10}</span>
                        <button 
                           onClick={() => onUpdateNode({...selectedNode, zIndex: (selectedNode.zIndex || 10) + 10})}
                           className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                            Bring Fwd
                        </button>
                     </div>
                 </PropRow>

                 <PropRow label="Size">
                     <div className="flex gap-2 w-full">
                         <input 
                            type="range" min={60} max={400} step={10}
                            value={selectedNode.width || (selectedNode.type === EntityType.GATE ? 132 : 180)}
                            onChange={(e) => onUpdateNode({ ...selectedNode, width: Number(e.target.value) })}
                            className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-indigo-600 my-auto"
                            title="Width"
                        />
                     </div>
                 </PropRow>
             </div>

             <div className={`h-px mx-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />

             {/* 3. Description Group */}
             <div className="px-2 pt-2">
                <div className="mb-2 flex items-center justify-between">
                  <label className={`block text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>Documentation</label>
                  {assistEnabled && (
                    <button
                      onClick={autoFillNodeDetails}
                      className="text-[10px] text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                    >
                      <Wand2 className="w-3 h-3" />
                      Auto-Fill
                    </button>
                  )}
                </div>
                <textarea
                    value={selectedNode.description || ''}
                    onChange={(e) => onUpdateNode({ ...selectedNode, description: e.target.value })}
                    className={`w-full rounded-lg border px-3 py-2 text-sm h-32 resize-none outline-none transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'} focus:border-indigo-500`}
                    placeholder="Add detailed architectural notes..."
                />
            </div>
          </div>
        )}

        {/* --- EDGE INSPECTOR --- */}
        {selectedEdge && (
          <div className="space-y-4">
            
            {/* 1. Logic Group */}
            <div className="space-y-1">
                <PropRow label="Label">
                    <TransparentInput
                      value={selectedEdge.label}
                      onChange={(e) => updateSelectedEdge({ label: e.target.value })}
                      placeholder="e.g. Settlement"
                    />
                </PropRow>
                <PropRow label="Preset">
                    <TransparentSelect
                        value={selectedEdge.connectorPreset || 'custom'}
                        onChange={(e) => onApplyEdgePreset(selectedEdge.id, e.target.value as ConnectorPresetKey)}
                    >
                        <option value="custom">Custom</option>
                        {CONNECTOR_PRESET_ORDER.map((key) => (
                            <option key={key} value={key}>{CONNECTOR_PRESETS[key].label}</option>
                        ))}
                    </TransparentSelect>
                </PropRow>
                <PropRow label="Rail">
                    <TransparentSelect
                        value={selectedEdge.rail}
                        onChange={(e) => updateSelectedEdge({ rail: e.target.value as PaymentRail })}
                    >
                        <option value="">(None)</option>
                        {Object.values(PaymentRail).filter(r => r !== '').map(r => <option key={r} value={r}>{r}</option>)}
                    </TransparentSelect>
                </PropRow>
                <PropRow label="Direction">
                    <TransparentSelect
                        value={selectedEdge.direction}
                        onChange={(e) => updateSelectedEdge({ direction: e.target.value as FlowDirection })}
                    >
                        {Object.values(FlowDirection).map((d) => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </TransparentSelect>
                </PropRow>
                <PropRow label="Netting">
                    <TransparentSelect
                        value={selectedEdge.netting || selectedEdge.settlementType || ''}
                        onChange={(e) =>
                          updateSelectedEdge({
                            netting: e.target.value || undefined,
                            settlementType: (e.target.value as SettlementType) || undefined
                          })
                        }
                    >
                        <option value="">(None)</option>
                        {Object.values(SettlementType).map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </TransparentSelect>
                </PropRow>
                <PropRow label="Lifecycle">
                    <TransparentSelect
                        value={selectedEdge.lifecycle || ''}
                        onChange={(e) => updateSelectedEdge({ lifecycle: e.target.value as TransactionLifecycle || undefined })}
                    >
                        <option value="">(None)</option>
                        {Object.values(TransactionLifecycle).map((stage) => (
                            <option key={stage} value={stage}>{stage}</option>
                        ))}
                    </TransparentSelect>
                </PropRow>
                <PropRow label="Settle Time">
                    <TransparentSelect
                        value={selectedEdge.settlementTiming || selectedEdge.timing || ''}
                        onChange={(e) =>
                          updateSelectedEdge({
                            settlementTiming: e.target.value as TimingType,
                            timing: e.target.value as TimingType
                          })
                        }
                    >
                        <option value="">(None)</option>
                        {Object.values(TimingType).map(t => <option key={t} value={t}>{t}</option>)}
                    </TransparentSelect>
                </PropRow>
                <PropRow label="Currency">
                    <TransparentInput
                        value={selectedEdge.currency || ''}
                        onChange={(e) => updateSelectedEdge({ currency: e.target.value.toUpperCase() })}
                        placeholder="USD"
                    />
                </PropRow>
                <PropRow label="Finality">
                    <TransparentInput
                        value={selectedEdge.finality || ''}
                        onChange={(e) => updateSelectedEdge({ finality: e.target.value })}
                        placeholder="Provisional / Final"
                    />
                </PropRow>
                <PropRow label="Cutoff Dep.">
                    <TransparentInput
                        value={selectedEdge.cutoffDependency || ''}
                        onChange={(e) => updateSelectedEdge({ cutoffDependency: e.target.value })}
                        placeholder="Depends on 5:00 PM ET"
                    />
                </PropRow>

                {selectedEdge.rail === PaymentRail.CARD_NETWORK && (
                    <PropRow label="Network" icon={<CreditCard className="w-3 h-3"/>}>
                        <TransparentSelect
                          value={selectedEdge.cardNetwork || ''}
                          onChange={(e) => updateSelectedEdge({ cardNetwork: e.target.value as CardNetwork })}
                        >
                           <option value="">(Select)</option>
                           {Object.values(CardNetwork).map(c => <option key={c} value={c}>{c}</option>)}
                        </TransparentSelect>
                    </PropRow>
                )}

                <PropRow label="Value" icon={<DollarSign className="w-3 h-3"/>}>
                    <TransparentInput
                        value={selectedEdge.amount || ''}
                        onChange={(e) => updateSelectedEdge({ amount: formatAmount(e.target.value) })}
                        placeholder="$0.00"
                    />
                </PropRow>
            </div>

            <div className={`h-px mx-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />

            {/* 2. Risk & Liability */}
            <div className="space-y-1">
                 <div className="px-2 pb-1 pt-2">
                     <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>Risk & Liability</span>
                 </div>
                 <PropRow label="Risk Owner">
                    <TransparentInput
                        value={selectedEdge.riskOwner || ''}
                        onChange={(e) => updateSelectedEdge({ riskOwner: e.target.value })}
                        placeholder="Who owns operational risk"
                    />
                 </PropRow>
                 <PropRow label="Fraud Owner">
                    <TransparentInput
                        value={selectedEdge.fraudLiabilityOwner || ''}
                        onChange={(e) => updateSelectedEdge({ fraudLiabilityOwner: e.target.value })}
                        placeholder="Fraud liability owner"
                    />
                 </PropRow>
                 <PropRow label="Chargeback">
                    <TransparentInput
                        value={selectedEdge.chargebackExposure || ''}
                        onChange={(e) => updateSelectedEdge({ chargebackExposure: e.target.value })}
                        placeholder="Chargeback exposure notes"
                    />
                 </PropRow>
                 <PropRow label="Dispute">
                    <TransparentInput
                        value={selectedEdge.disputeWindow || ''}
                        onChange={(e) => updateSelectedEdge({ disputeWindow: e.target.value })}
                        placeholder="e.g. 60 days"
                    />
                 </PropRow>
            </div>

            <div className={`h-px mx-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />

            {/* 3. Data Exchange */}
            <div className="space-y-1">
                 <div className="px-2 pb-1 pt-2 flex justify-between items-center">
                     <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>Data Exchange</span>
                     {assistEnabled && (
                       <button
                         onClick={autoFillEdgeDetails}
                         className="text-[10px] text-indigo-500 hover:text-indigo-600 flex items-center gap-1"
                       >
                         <Wand2 className="w-3 h-3" />
                         Auto-Fill
                       </button>
                     )}
                 </div>
                 <PropRow label="Data Exch.">
                    <TransparentInput
                        value={selectedEdge.dataExchanged || ''}
                        onChange={(e) => updateSelectedEdge({ dataExchanged: e.target.value })}
                        placeholder="Auth payload, settlement file"
                    />
                 </PropRow>
                 <PropRow label="Latency">
                    <TransparentInput
                        value={selectedEdge.dataLatency || ''}
                        onChange={(e) => updateSelectedEdge({ dataLatency: e.target.value })}
                        placeholder="Near real-time / batch"
                    />
                 </PropRow>
                 <PropRow label="SOR">
                    <TransparentInput
                        value={selectedEdge.systemOfRecord || ''}
                        onChange={(e) => updateSelectedEdge({ systemOfRecord: e.target.value })}
                        placeholder="System of record"
                    />
                 </PropRow>
                 
                 <PropRow label="Schema" icon={<FileJson className="w-3 h-3"/>}>
                    <TransparentInput
                        value={selectedEdge.dataSchema || ''}
                        onChange={(e) => updateSelectedEdge({ dataSchema: e.target.value })}
                        placeholder="e.g. ISO 20022"
                    />
                 </PropRow>
                 <PropRow label="Velocity" icon={<Activity className="w-3 h-3"/>}>
                    <TransparentInput
                        value={selectedEdge.velocityLimit || ''}
                        onChange={(e) => updateSelectedEdge({ velocityLimit: e.target.value })}
                        placeholder="e.g. 10k/day"
                    />
                 </PropRow>
                 <PropRow label="Volume" icon={<Gauge className="w-3 h-3"/>}>
                    <TransparentInput
                        value={selectedEdge.volumeLimit || ''}
                        onChange={(e) => updateSelectedEdge({ volumeLimit: e.target.value })}
                        placeholder="e.g. $1M/mo"
                    />
                 </PropRow>
            </div>

            <div className={`h-px mx-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />

            {/* 4. Visuals Group */}
            <div className="space-y-1">
                 <div className="px-2 pb-1 pt-2">
                     <span className={`text-[10px] font-bold uppercase ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>Routing</span>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-2 px-2 mb-2">
                    <button
                        onClick={() => updateSelectedEdge({ pathType: 'bezier' })}
                        className={`py-1.5 rounded text-xs font-medium transition-colors border ${selectedEdge.pathType !== 'orthogonal' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800' : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        Curved
                    </button>
                    <button
                        onClick={() => updateSelectedEdge({ pathType: 'orthogonal' })}
                        className={`py-1.5 rounded text-xs font-medium transition-colors border ${selectedEdge.pathType === 'orthogonal' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800' : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                        Orthogonal
                    </button>
                 </div>

                 <PropRow label="Pattern">
                     <TransparentSelect
                        value={selectedEdge.style}
                        onChange={(e) => updateSelectedEdge({ style: e.target.value as 'solid' | 'dashed' | 'dotted' })}
                     >
                         <option value="solid">Solid</option>
                         <option value="dashed">Dashed</option>
                         <option value="dotted">Dotted</option>
                     </TransparentSelect>
                 </PropRow>
                 
                 <PropRow label="Width">
                      <input
                        type="range" min={1} max={8}
                        value={selectedEdge.thickness || 2}
                        onChange={(e) => updateSelectedEdge({ thickness: Number(e.target.value) })}
                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-indigo-600"
                     />
                 </PropRow>

                 <PropRow label="Arrow Ends">
                     <div className="flex gap-1">
                        <button onClick={() => updateSelectedEdge({ showStartArrow: !selectedEdge.showStartArrow })} className={`px-2 py-0.5 rounded text-[10px] border ${selectedEdge.showStartArrow ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900 dark:border-indigo-700' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Start</button>
                        <button onClick={() => updateSelectedEdge({ showMidArrow: !selectedEdge.showMidArrow })} className={`px-2 py-0.5 rounded text-[10px] border ${selectedEdge.showMidArrow ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900 dark:border-indigo-700' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Mid</button>
                        <button onClick={() => updateSelectedEdge({ showArrowHead: !selectedEdge.showArrowHead })} className={`px-2 py-0.5 rounded text-[10px] border ${selectedEdge.showArrowHead ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900 dark:border-indigo-700' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>End</button>
                     </div>
                 </PropRow>
                 <PropRow label="Label Detail">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedEdge.showDetailsOnCanvas || false}
                          onChange={(e) => updateSelectedEdge({ showDetailsOnCanvas: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                 </PropRow>
            </div>

            <div className={`h-px mx-2 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`} />

            {/* 4. Advanced FX */}
            <div className="px-2">
                 <button
                    onClick={handleFXToggle}
                    className={`w-full py-2 px-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between group ${
                        selectedEdge.isFX 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' 
                        : 'border-dashed border-slate-300 text-slate-400 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'
                    }`}
                 >
                     <span>Foreign Exchange</span>
                     <span className={`w-2 h-2 rounded-full ${selectedEdge.isFX ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                 </button>

                 {selectedEdge.isFX && (
                     <div className="mt-2 pl-2 border-l-2 border-emerald-100 dark:border-emerald-900/50 space-y-2">
                         <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold">Source</label>
                                <input 
                                   value={selectedEdge.sourceCurrency || 'USD'}
                                   onChange={(e) => updateSelectedEdge({ sourceCurrency: e.target.value.toUpperCase() })}
                                   className={`w-full bg-transparent border-b border-slate-200 dark:border-slate-700 py-1 text-xs font-mono uppercase focus:border-emerald-500 outline-none ${valueColor}`}
                                   maxLength={3}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-400 font-bold">Target</label>
                                <input 
                                   value={selectedEdge.targetCurrency || 'EUR'}
                                   onChange={(e) => updateSelectedEdge({ targetCurrency: e.target.value.toUpperCase() })}
                                   className={`w-full bg-transparent border-b border-slate-200 dark:border-slate-700 py-1 text-xs font-mono uppercase focus:border-emerald-500 outline-none ${valueColor}`}
                                   maxLength={3}
                                />
                            </div>
                         </div>
                     </div>
                 )}
            </div>

          </div>
        )}

      </div>
      
      {/* FOOTER */}
      <div className={`p-3 border-t text-[10px] text-center text-slate-400 ${borderColor} ${isDarkMode ? 'bg-slate-900' : 'bg-slate-50'}`}>
         {selectedNode && `${selectedNode.id} • Lane ${selectedNode.swimlaneId || 1}`}
         {selectedEdge && `${selectedEdge.id} • ${selectedEdge.pathType} • ${selectedEdge.connectorPreset || 'custom'}`}
      </div>
    </div>
  );
});

export default Inspector;
