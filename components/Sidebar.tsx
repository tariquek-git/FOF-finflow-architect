import React, { useEffect, useMemo, useState } from 'react';
import { EntityType } from '../types';
import { ENTITY_ICONS } from '../constants';
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeftRightEllipsis,
  Plus,
  Search,
  Sparkles,
  Star
} from 'lucide-react';

interface SidebarProps {
  onAddNode: (type: EntityType) => void;
  isDarkMode: boolean;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  showQuickStart: boolean;
  onDismissQuickStart: () => void;
}

type LibrarySection = {
  key: string;
  title: string;
  types: EntityType[];
};

const FAVORITES_STORAGE_KEY = 'finflow-builder.library.favorites.v1';
const RECENT_STORAGE_KEY = 'finflow-builder.library.recent.v1';

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
    title: 'Treasury & Controls',
    types: [EntityType.GATE, EntityType.LIQUIDITY_PROVIDER]
  },
  {
    key: 'endpoints',
    title: 'End Points',
    types: [EntityType.END_POINT, EntityType.TEXT_BOX, EntityType.ANCHOR]
  }
];

const TOTAL_LIBRARY_COUNT = LIBRARY_SECTIONS.reduce((count, section) => count + section.types.length, 0);

const DEFAULT_FAVORITES: EntityType[] = [
  EntityType.SPONSOR_BANK,
  EntityType.PROCESSOR,
  EntityType.NETWORK,
  EntityType.END_POINT
];

const getShortLabel = (type: EntityType) =>
  type
    .replace(' Bank', '')
    .replace(' Provider', '')
    .replace(' Point', '')
    .replace(' / ', '/');

const loadFavorites = () => {
  if (typeof window === 'undefined') return DEFAULT_FAVORITES;
  try {
    const raw = window.sessionStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return DEFAULT_FAVORITES;
    const parsed = JSON.parse(raw) as EntityType[];
    const valid = Array.isArray(parsed)
      ? parsed.filter((item): item is EntityType => Object.values(EntityType).includes(item))
      : [];
    return valid.length > 0 ? valid : DEFAULT_FAVORITES;
  } catch {
    return DEFAULT_FAVORITES;
  }
};

const loadRecents = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EntityType[];
    const valid = Array.isArray(parsed)
      ? parsed.filter((item): item is EntityType => Object.values(EntityType).includes(item))
      : [];
    return valid.slice(0, 8);
  } catch {
    return [];
  }
};

const Sidebar = React.memo<SidebarProps>(({
  onAddNode,
  isDarkMode,
  isExpanded,
  onToggleExpanded,
  showQuickStart,
  onDismissQuickStart
}) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    institutions: true,
    intermediaries: true,
    treasury: true,
    endpoints: true
  });
  const [query, setQuery] = useState('');
  const [hoveredType, setHoveredType] = useState<EntityType | null>(null);
  const [favorites, setFavorites] = useState<EntityType[]>(() => loadFavorites());
  const [recent, setRecent] = useState<EntityType[]>(() => loadRecents());
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);

  const normalizedQuery = query.trim().toLowerCase();
  const isSearchMode = normalizedQuery.length > 0;

  const typeToSectionTitle = useMemo(() => {
    const map = new Map<EntityType, string>();
    for (const section of LIBRARY_SECTIONS) {
      for (const type of section.types) {
        map.set(type, section.title);
      }
    }
    return map;
  }, []);

  const sections = useMemo(() => {
    return LIBRARY_SECTIONS.map((section) => {
      if (!normalizedQuery) return { ...section, filteredTypes: section.types };
      return {
        ...section,
        filteredTypes: section.types.filter((type) => getShortLabel(type).toLowerCase().includes(normalizedQuery))
      };
    }).filter((section) => section.filteredTypes.length > 0);
  }, [normalizedQuery]);

  const totalVisibleBlocks = sections.reduce((acc, section) => acc + section.filteredTypes.length, 0);
  const flattenedVisibleTypes = useMemo(
    () => sections.flatMap((section) => section.filteredTypes),
    [sections]
  );
  const keyboardActiveType = flattenedVisibleTypes[activeSearchIndex] || null;

  useEffect(() => {
    setActiveSearchIndex(0);
  }, [normalizedQuery, flattenedVisibleTypes.length]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const persistFavorites = (nextFavorites: EntityType[]) => {
    setFavorites(nextFavorites);
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(nextFavorites));
    } catch {
      // Ignore local storage write errors and keep favorites in memory.
    }
  };

  const toggleFavorite = (type: EntityType) => {
    if (favorites.includes(type)) {
      persistFavorites(favorites.filter((item) => item !== type));
      return;
    }
    persistFavorites([type, ...favorites].slice(0, 8));
  };

  const persistRecents = (nextRecents: EntityType[]) => {
    setRecent(nextRecents);
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(nextRecents));
    } catch {
      // Ignore local storage write failures.
    }
  };

  const markRecent = (type: EntityType) => {
    const next = [type, ...recent.filter((item) => item !== type)].slice(0, 8);
    persistRecents(next);
  };

  const handleAddFromLibrary = (type: EntityType) => {
    markRecent(type);
    onAddNode(type);
  };

  const onDragStartShape = (event: React.DragEvent, type: EntityType) => {
    event.dataTransfer.setData('application/finflow/type', type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const renderSearchResults = () => {
    if (flattenedVisibleTypes.length === 0) {
      return (
        <div className="rounded-lg border border-divider/35 bg-surface-muted/25 px-2.5 py-2 text-[11px] text-text-muted">
          No results for "{query}".
        </div>
      );
    }

    return (
      <div
        className={`overflow-hidden rounded-lg border ${
          isDarkMode ? 'border-divider/30 bg-surface-elevated/38' : 'border-divider/30 bg-surface-elevated/62'
        }`}
      >
        <div className="flex items-center justify-between px-2.5 py-2">
          <span className="ui-section-title">Results</span>
          <span className="text-[10px] text-text-muted">Enter to add · Esc to clear</span>
        </div>
        <div role="listbox" aria-label="Search results" className="max-h-56 overflow-y-auto px-1.5 pb-1.5">
          {flattenedVisibleTypes.map((type, idx) => {
            const short = getShortLabel(type);
            const sectionTitle = typeToSectionTitle.get(type) || 'Other';
            const isActive = keyboardActiveType === type;
            const isFavorite = favorites.includes(type);
            return (
              <div
                key={`search-${type}`}
                className={`group flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors ${
                  isActive
                    ? 'border-accent/45 bg-accent/10'
                    : 'border-transparent hover:border-divider/45 hover:bg-surface-muted/40'
                }`}
                onMouseEnter={() => setActiveSearchIndex(idx)}
              >
                <button
                  type="button"
                  draggable
                  onDragStart={(event) => onDragStartShape(event, type)}
                  onClick={() => handleAddFromLibrary(type)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title={`Add ${type}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-divider/55 bg-surface-muted/45 text-text-secondary">
                    {ENTITY_ICONS[type]}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-text-secondary">{short}</span>
                    <span className="block truncate text-[10px] text-text-muted">{sectionTitle}</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => toggleFavorite(type)}
                  aria-label={isFavorite ? `Remove ${short} from favorites` : `Add ${short} to favorites`}
                  className={`rounded-md p-1 transition-colors ${
                    isFavorite
                      ? 'text-amber-500'
                      : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200'
                  }`}
                  title={isFavorite ? 'Unfavorite' : 'Favorite'}
                >
                  <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTile = (type: EntityType) => {
    const short = getShortLabel(type);
    const isFavorite = favorites.includes(type);
    const isHovered = hoveredType === type;
    return (
      <div
        key={type}
        className={`group relative min-h-[4.2rem] overflow-hidden rounded-lg border transition-all ${
          keyboardActiveType === type
            ? 'border-accent/45 bg-accent/10'
            : isDarkMode
              ? 'border-divider/45 bg-surface-elevated/45 hover:border-divider/70'
              : 'border-divider/45 bg-surface-elevated/75 hover:border-divider/70 hover:bg-surface-muted/60'
        }`}
        onMouseEnter={() => setHoveredType(type)}
        onMouseLeave={() => setHoveredType((prev) => (prev === type ? null : prev))}
      >
        <button
          draggable
          onDragStart={(event) => onDragStartShape(event, type)}
          onClick={() => handleAddFromLibrary(type)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleAddFromLibrary(type);
            }
          }}
          className="flex h-full w-full cursor-grab flex-col items-center gap-1 px-2 py-1.5 text-center active:cursor-grabbing"
          title={`Drag ${type} to canvas`}
        >
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
              isDarkMode
                ? 'border-divider/80 bg-surface-muted/70 text-text-secondary'
                : 'border-divider/80 bg-surface-muted/70 text-text-secondary'
            }`}
          >
            {ENTITY_ICONS[type]}
          </span>
          <span className="line-clamp-2 text-[10.5px] font-medium leading-4 text-text-secondary">
            {short}
          </span>
        </button>

        <div className="pointer-events-none absolute right-1 top-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => toggleFavorite(type)}
            aria-label={isFavorite ? `Remove ${short} from favorites` : `Add ${short} to favorites`}
            className={`pointer-events-auto rounded-md p-1 transition-colors ${
              isFavorite
                ? 'text-amber-500'
                : isDarkMode
                  ? 'text-slate-500 hover:text-slate-200'
                  : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleAddFromLibrary(type)}
          aria-label={`Quick add ${short}`}
          className={`absolute bottom-1.5 right-1.5 rounded-md border p-1 transition-all ${
            isHovered
              ? isDarkMode
                ? 'border-accent/45 bg-accent/20 text-indigo-100 opacity-100'
                : 'border-accent/45 bg-accent/10 text-accent opacity-100'
              : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  };

  const compactLibraryChipClass = `inline-flex h-6 items-center gap-1 rounded-full border border-divider/55 px-2 text-[10px] font-medium ${
    isDarkMode ? 'bg-surface-muted/55 text-text-secondary' : 'bg-surface-muted/72 text-text-secondary'
  }`;

  return (
    <div className={`flex h-full ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
      {isExpanded ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="space-y-2 border-b border-divider/35 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-pressed={isExpanded}
                onClick={onToggleExpanded}
                className="ui-icon-button h-8 w-8"
                title="Collapse library"
                aria-label="Collapse library"
              >
                <ChevronsLeftRightEllipsis className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent" />
                <span className="ui-section-title">Node Library</span>
              </div>
              <span
                className="shrink-0 rounded-full border border-divider/50 px-2 py-0.5 text-[10px] font-medium text-text-muted"
              >
                {totalVisibleBlocks}/{TOTAL_LIBRARY_COUNT}
              </span>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                data-testid="sidebar-search-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (flattenedVisibleTypes.length === 0) return;
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveSearchIndex((prev) => (prev + 1) % flattenedVisibleTypes.length);
                    return;
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveSearchIndex((prev) =>
                      prev <= 0 ? flattenedVisibleTypes.length - 1 : prev - 1
                    );
                    return;
                  }
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const typeToAdd = flattenedVisibleTypes[activeSearchIndex] || flattenedVisibleTypes[0];
                    if (typeToAdd) {
                      handleAddFromLibrary(typeToAdd);
                    }
                    return;
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setQuery('');
                  }
                }}
                placeholder="Search node types..."
                className={`ui-input h-8 w-full pl-8 pr-2 text-[13px] outline-none transition-all focus:border-accent/70 focus:ring-2 focus:ring-accent/20 ${
                  isDarkMode ? 'placeholder:text-slate-500' : 'placeholder:text-slate-400'
                }`}
              />
            </div>

            {!isSearchMode && showQuickStart ? (
              <div
                data-testid="quickstart-panel"
                className="flex items-center justify-between gap-2 rounded-lg border border-divider/35 bg-surface-muted/30 px-2 py-1"
              >
                <span className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
                  <Sparkles className="h-3.5 w-3.5 text-accent/80" aria-hidden="true" />
                  Quick Start checklist
                </span>
                <button
                  data-testid="quickstart-dismiss"
                  onClick={onDismissQuickStart}
                  className="status-chip !h-6 !px-2 text-[11px]"
                >
                  Hide
                </button>
              </div>
            ) : null}

            {!isSearchMode ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="ui-section-title">Favorites</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Max 6</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {favorites.length === 0 ? (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">No favorites yet.</span>
                  ) : (
                    favorites.slice(0, 6).map((type) => (
                      <button
                        key={`fav-${type}`}
                        type="button"
                        draggable
                        onDragStart={(event) => onDragStartShape(event, type)}
                        onClick={() => handleAddFromLibrary(type)}
                        title={`Drag ${type} to canvas`}
                        className={compactLibraryChipClass}
                      >
                        {ENTITY_ICONS[type]}
                        <span>{getShortLabel(type)}</span>
                      </button>
                    ))
                  )}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="ui-section-title">Recent</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Arrow keys + Enter</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {recent.length === 0 ? (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">No recent nodes yet.</span>
                  ) : (
                    recent.slice(0, 6).map((type) => (
                      <button
                        key={`recent-${type}`}
                        type="button"
                        draggable
                        onDragStart={(event) => onDragStartShape(event, type)}
                        onClick={() => handleAddFromLibrary(type)}
                        title={`Drag ${type} to canvas`}
                        className={compactLibraryChipClass}
                      >
                        {ENTITY_ICONS[type]}
                        <span>{getShortLabel(type)}</span>
                      </button>
                    ))
                  )}
                </div>

                <p className="text-[10px] text-slate-500/85 dark:text-slate-400/90">
                  Click, hover + <span className="mono">+</span>, press <span className="mono">Enter</span>, or drag to canvas.
                </p>
              </>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-2.5 py-2">
            {isSearchMode ? (
              renderSearchResults()
            ) : sections.length === 0 ? (
              <div
                className={`rounded-xl border px-3 py-4 text-center text-xs ${
                  isDarkMode
                    ? 'border-slate-700 bg-slate-900 text-slate-400'
                    : 'border-slate-200 bg-white text-slate-500'
                }`}
              >
                No matching blocks for "{query}".
              </div>
            ) : (
              <div className="space-y-2">
                {sections.map((section) => (
                  <div
                    key={section.key}
                    className={`overflow-hidden rounded-lg border ${
                      isDarkMode ? 'border-divider/30 bg-surface-elevated/38' : 'border-divider/30 bg-surface-elevated/58'
                    }`}
                  >
                    <button
                      onClick={() => toggleSection(section.key)}
                      className={`flex w-full items-center justify-between px-2.5 py-2 text-[12px] font-semibold ${
                        isDarkMode ? 'text-text-secondary hover:bg-surface-muted/45' : 'text-text-secondary hover:bg-surface-muted/50'
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
                      <span className="text-[11px] normal-case tracking-normal opacity-75">
                        {section.filteredTypes.length}
                      </span>
                    </button>

                    {openSections[section.key] ? (
                      <div className="grid grid-cols-3 gap-1.5 p-1.5">
                        {section.filteredTypes.map(renderTile)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <aside
          className={`flex w-full flex-col items-center gap-1.5 px-1.5 py-2 ${
            isDarkMode ? 'bg-slate-950/85' : 'bg-slate-50/90'
          }`}
        >
          <button
            type="button"
            aria-pressed={isExpanded}
            onClick={onToggleExpanded}
            className="status-chip h-8 w-full justify-center"
            title="Expand library"
            aria-label="Expand library"
          >
            <ChevronsLeftRightEllipsis className="h-4 w-4" />
          </button>
        </aside>
      )}
    </div>
  );
});

export default Sidebar;
