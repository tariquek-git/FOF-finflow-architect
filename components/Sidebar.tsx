import React, { useMemo, useState } from 'react';
import { EntityType, OverlayMode } from '../types';
import { ENTITY_ICONS } from '../constants';
import {
  ChevronDown,
  ChevronRight,
  Grid,
  Search,
  ShieldAlert,
  Wallet
} from 'lucide-react';

interface SidebarProps {
  onAddNode: (type: EntityType) => void;
  isDarkMode: boolean;
  overlayMode: OverlayMode;
  onToggleRiskOverlay: () => void;
  onToggleLedgerOverlay: () => void;
}

type LibrarySection = {
  key: string;
  title: string;
  types: EntityType[];
};

const LIBRARY_SECTIONS: LibrarySection[] = [
  {
    key: 'institutions',
    title: 'Institutions',
    types: [
      EntityType.SPONSOR_BANK,
      EntityType.ISSUING_BANK,
      EntityType.ACQUIRING_BANK,
      EntityType.CENTRAL_BANK,
      EntityType.CREDIT_UNION,
      EntityType.CORRESPONDENT_BANK
    ]
  },
  {
    key: 'intermediaries',
    title: 'Intermediaries',
    types: [
      EntityType.PROGRAM_MANAGER,
      EntityType.PROCESSOR,
      EntityType.GATEWAY,
      EntityType.NETWORK,
      EntityType.SWITCH,
      EntityType.WALLET_PROVIDER
    ]
  },
  {
    key: 'treasury',
    title: 'Treasury & Tools',
    types: [EntityType.GATE, EntityType.LIQUIDITY_PROVIDER]
  },
  {
    key: 'endpoints',
    title: 'End Points',
    types: [EntityType.END_POINT, EntityType.TEXT_BOX, EntityType.ANCHOR]
  }
];

const getShortLabel = (type: EntityType) =>
  type
    .replace(' Bank', '')
    .replace(' Provider', '')
    .replace(' Point', '')
    .replace(' / ', '/');

const Sidebar = React.memo<SidebarProps>(({
  onAddNode,
  isDarkMode,
  overlayMode,
  onToggleRiskOverlay,
  onToggleLedgerOverlay
}) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    institutions: true,
    intermediaries: true,
    treasury: true,
    endpoints: true
  });
  const [query, setQuery] = useState('');

  const normalizedQuery = query.trim().toLowerCase();

  const sections = useMemo(() => {
    return LIBRARY_SECTIONS.map((section) => {
      if (!normalizedQuery) return { ...section, filteredTypes: section.types };
      return {
        ...section,
        filteredTypes: section.types.filter((type) =>
          getShortLabel(type).toLowerCase().includes(normalizedQuery)
        )
      };
    }).filter((section) => section.filteredTypes.length > 0);
  }, [normalizedQuery]);

  const totalVisibleBlocks = sections.reduce((acc, section) => acc + section.filteredTypes.length, 0);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const onDragStartShape = (event: React.DragEvent, type: EntityType) => {
    event.dataTransfer.setData('application/finflow/type', type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const renderShapeButton = (type: EntityType) => (
    <button
      key={type}
      draggable
      onDragStart={(event) => onDragStartShape(event, type)}
      onClick={() => onAddNode(type)}
      className={`group flex aspect-square cursor-grab flex-col items-center justify-center rounded-lg border p-1.5 text-center transition-all duration-150 active:cursor-grabbing ${
        isDarkMode
          ? 'border-slate-800 bg-slate-900/80 hover:-translate-y-0.5 hover:border-blue-500/60 hover:bg-slate-800'
          : 'border-slate-200/80 bg-white/90 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/35'
      }`}
      title={`Drag ${type} to canvas`}
    >
      <div
        className={`mb-1.5 flex h-9 w-9 items-center justify-center rounded-md border ${
          isDarkMode
            ? 'border-slate-700 bg-slate-800 text-slate-200'
            : 'border-slate-200 bg-slate-50 text-slate-700'
        }`}
      >
        {ENTITY_ICONS[type]}
      </div>
      <span
        className={`line-clamp-2 text-[10px] font-medium leading-tight ${
          isDarkMode ? 'text-slate-300' : 'text-slate-600'
        }`}
      >
        {getShortLabel(type)}
      </span>
    </button>
  );

  const riskEnabled = overlayMode === 'risk' || overlayMode === 'both';
  const ledgerEnabled = overlayMode === 'ledger' || overlayMode === 'both';

  return (
    <div className={`flex h-full flex-col ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      <div className={`space-y-3 border-b px-4 py-3 ${isDarkMode ? 'border-slate-700/70' : 'border-slate-200/70'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Grid className="h-4 w-4 text-blue-500" />
            <span className="ui-section-title">Component Library</span>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {totalVisibleBlocks}
          </span>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search blocks..."
            className={`ui-input h-9 w-full pl-8 pr-2 text-xs outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${
              isDarkMode ? 'placeholder:text-slate-500' : 'placeholder:text-slate-400'
            }`}
          />
        </div>

        <div
          className={`rounded-lg border p-2 ${
            isDarkMode ? 'border-slate-700/80 bg-slate-900/80' : 'border-slate-200/80 bg-white/90'
          }`}
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-slate-500 dark:text-slate-400">
            Overlay Layers
          </div>
          <p className="mb-2 text-[10px] text-slate-500 dark:text-slate-400">
            Grid, snap, ports, minimap, and lane controls live in the Inspector Canvas tab.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              data-testid="toolbar-toggle-risk-overlay"
              onClick={onToggleRiskOverlay}
              aria-pressed={riskEnabled}
              className={`status-chip ${riskEnabled ? 'is-active' : ''}`}
              title="Toggle risk overlay"
            >
              <ShieldAlert className="h-3.5 w-3.5" /> Risk
            </button>
            <button
              type="button"
              data-testid="toolbar-toggle-ledger-overlay"
              onClick={onToggleLedgerOverlay}
              aria-pressed={ledgerEnabled}
              className={`status-chip ${ledgerEnabled ? 'is-active' : ''}`}
              title="Toggle ledger overlay"
            >
              <Wallet className="h-3.5 w-3.5" /> Ledger
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5">
        {sections.length === 0 ? (
          <div
            className={`rounded-lg border px-3 py-4 text-center text-xs ${
              isDarkMode
                ? 'border-slate-700 bg-slate-900 text-slate-400'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            No matching blocks.
          </div>
        ) : (
          <div className="space-y-2.5">
            {sections.map((section) => (
              <div
                key={section.key}
                className={`overflow-hidden rounded-lg border transition-colors ${
                  isDarkMode ? 'border-slate-800/70 bg-slate-900/70' : 'border-slate-200/70 bg-white/95'
                }`}
              >
                <button
                  onClick={() => toggleSection(section.key)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${
                    isDarkMode ? 'text-slate-300 hover:bg-slate-800/60' : 'text-slate-600 hover:bg-slate-50/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {openSections[section.key] ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    {section.title}
                  </span>
                  <span className="text-[10px] normal-case tracking-normal opacity-70">
                    {section.filteredTypes.length}
                  </span>
                </button>

                {openSections[section.key] ? (
                  <div
                    className={`grid grid-cols-3 gap-1.5 border-t p-1.5 ${
                      isDarkMode
                        ? 'border-slate-700/80 bg-slate-950/35'
                        : 'border-slate-200/80 bg-slate-50/60'
                    }`}
                  >
                    {section.filteredTypes.map(renderShapeButton)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default Sidebar;
