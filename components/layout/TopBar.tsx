import React from 'react';
import {
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Command,
  Crosshair,
  HelpCircle,
  LayoutPanelLeft,
  LoaderCircle,
  Maximize2,
  Moon,
  RotateCcw,
  RotateCw,
  Rows3,
  Settings2,
  Sun,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import type { GridMode } from '../../types';
import FunctionToolbar from './FunctionToolbar';

type SaveState = 'saving' | 'saved' | 'error';

type SaveStatus = {
  state: SaveState;
  savedAtLabel: string | null;
  errorText: string | null;
};

type TopBarProps = {
  workspaceName: string;
  workspaceShortId: string;
  recentWorkspaces: Array<{
    workspaceId: string;
    name: string;
    shortId: string;
    lastOpenedAt: string;
    isActive: boolean;
  }>;
  isDarkMode: boolean;
  nodesCount: number;
  edgesCount: number;
  backupStatusText: string;
  hasRecoverySnapshot: boolean;
  recoveryLastSavedAt: string | null;
  feedbackHref: string;
  storageWarning: string | null;
  isSidebarOpen: boolean;
  isInspectorOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  isAIEnabled: boolean;
  isAILoading: boolean;
  snapToGrid: boolean;
  showSwimlanes: boolean;
  showPorts: boolean;
  showMinimap: boolean;
  enableSwimlaneToggle?: boolean;
  gridMode: GridMode;
  saveStatus: SaveStatus;
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
  onToggleTheme: () => void;
  onOpenHelp: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onCenterDiagram: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onToggleSwimlanes: () => void;
  onTogglePorts: () => void;
  onToggleMinimap: () => void;
  onOpenAiLauncher: () => void;
  onOpenCommandPalette: () => void;
  onRestoreRecovery: () => void;
  onCreateWorkspace: () => void;
  onOpenWorkspace: (workspaceId: string) => void;
  onInsertStarterTemplate: () => void;
  onResetCanvas: () => void;
  onImportDiagram: () => void;
  onExportDiagram: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onRetrySave: () => void;
};

const actionButton = (_isDarkMode: boolean) =>
  `menu-trigger tap-target shrink-0 whitespace-nowrap inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5`;

const SaveBadgeIcon: React.FC<{ state: SaveState }> = ({ state }) => {
  if (state === 'saving') {
    return <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />;
  }
  if (state === 'error') {
    return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
  }
  return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
};

const TopBar: React.FC<TopBarProps> = ({
  workspaceName,
  workspaceShortId,
  recentWorkspaces,
  isDarkMode,
  nodesCount,
  edgesCount,
  backupStatusText,
  hasRecoverySnapshot,
  recoveryLastSavedAt,
  feedbackHref,
  storageWarning,
  isSidebarOpen,
  isInspectorOpen,
  canUndo,
  canRedo,
  isAIEnabled,
  isAILoading,
  snapToGrid,
  showSwimlanes,
  showPorts,
  showMinimap,
  enableSwimlaneToggle = true,
  gridMode,
  saveStatus,
  onToggleSidebar,
  onToggleInspector,
  onToggleTheme,
  onOpenHelp,
  onUndo,
  onRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
  onCenterDiagram,
  onToggleGrid,
  onToggleSnap,
  onToggleSwimlanes,
  onTogglePorts,
  onToggleMinimap,
  onOpenAiLauncher: _onOpenAiLauncher,
  onOpenCommandPalette,
  onRestoreRecovery,
  onCreateWorkspace,
  onOpenWorkspace,
  onInsertStarterTemplate,
  onResetCanvas,
  onImportDiagram,
  onExportDiagram,
  onExportSvg,
  onExportPng,
  onExportPdf,
  onRetrySave
}) => {
  const saveStatusText =
    saveStatus.state === 'saving'
      ? 'Saving…'
      : saveStatus.state === 'error'
        ? 'Save failed'
        : saveStatus.savedAtLabel
          ? `Saved ${saveStatus.savedAtLabel}`
          : 'Saved';

  const saveStatusToneClasses =
    saveStatus.state === 'error'
      ? isDarkMode
        ? 'text-rose-200'
        : 'text-rose-700'
      : saveStatus.state === 'saving'
        ? isDarkMode
          ? 'text-cyan-200'
          : 'text-cyan-700'
        : isDarkMode
          ? 'text-emerald-200'
          : 'text-emerald-700';
  const statusDetailsRef = React.useRef<HTMLDetailsElement | null>(null);
  const viewDetailsRef = React.useRef<HTMLDetailsElement | null>(null);

  const closeDetails = React.useCallback((targetRef?: React.RefObject<HTMLDetailsElement | null>) => {
    const refs = [statusDetailsRef, viewDetailsRef];
    refs.forEach((ref) => {
      if (!ref.current?.open) return;
      if (targetRef && ref !== targetRef) return;
      ref.current.open = false;
    });
  }, []);

  React.useEffect(() => {
    const onWindowPointerDownCapture = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      [statusDetailsRef, viewDetailsRef].forEach((ref) => {
        if (!ref.current?.open) return;
        if (!ref.current.contains(target)) {
          ref.current.open = false;
        }
      });
    };

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!statusDetailsRef.current?.open && !viewDetailsRef.current?.open) return;
      event.preventDefault();
      closeDetails();
    };

    window.addEventListener('pointerdown', onWindowPointerDownCapture, true);
    window.addEventListener('keydown', onWindowKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onWindowPointerDownCapture, true);
      window.removeEventListener('keydown', onWindowKeyDown);
    };
  }, [closeDetails]);

  const runMenuAction = React.useCallback(
    (action: () => void, detailsRef: React.RefObject<HTMLDetailsElement | null>) => {
      action();
      closeDetails(detailsRef);
    },
    [closeDetails]
  );

  return (
    <header
      className="ff-topbar shell-panel glass-panel z-50 mx-2 mt-2 flex shrink-0 flex-col gap-2 px-3 py-2.5 md:mx-3 md:px-4"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--ff-accent-primary)] text-[12px] font-semibold text-white shadow-soft">
            FF
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold tracking-tight text-text-primary">Flow of Funds Studio</h1>
            <p className="text-[11px] font-medium text-text-muted">
              Fintech Diagram Workspace
            </p>
          </div>
          <span
            data-testid="workspace-display"
            className="inline-flex min-w-0 max-w-[18rem] items-center truncate rounded-full border border-divider/60 bg-surface-elevated/70 px-2.5 py-1 text-[12px] font-medium text-text-secondary"
            title={`${workspaceName} · ${workspaceShortId}`}
          >
            <span className="truncate">{workspaceName}</span>
            <span className="mx-1.5 text-text-muted/60">·</span>
            <span className="shrink-0 font-bold tracking-[0.08em]">{workspaceShortId}</span>
          </span>

          <details ref={statusDetailsRef} className="relative">
            <summary
              data-testid="backup-status-indicator"
              data-last-saved-at={recoveryLastSavedAt || ''}
              className={`status-pill list-none cursor-pointer ${saveStatusToneClasses}`}
            >
              <SaveBadgeIcon state={saveStatus.state} />
              <span className="max-w-[13rem] truncate">{saveStatusText}</span>
              {!isAIEnabled ? (
                <span
                  data-testid="ai-disabled-badge"
                  title="AI is off for MVP"
                  aria-label="AI is off for MVP"
                  className="ml-1 inline-flex items-center gap-1 rounded-full border border-divider/45 bg-surface-panel/70 px-2 py-0.5 text-[10px] font-semibold text-text-muted"
                >
                  <Bot className="h-3 w-3" aria-hidden="true" />
                  <span className="sr-only">AI Off</span>
                </span>
              ) : null}
            </summary>
            <div
              className="status-pill-menu absolute left-0 z-40 mt-1.5 min-w-[16.5rem]"
              data-canvas-interactive="true"
            >
              <div className="menu-section-label">System</div>
              <div className="px-2 py-1">
                <div className="text-[11px] font-semibold text-text-primary">{saveStatusText}</div>
                {saveStatus.errorText ? (
                  <div className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">{saveStatus.errorText}</div>
                ) : null}
                <div className="menu-meta-line">{backupStatusText}</div>
                <div className="menu-meta-line">Storage: Session-only (export JSON to keep work)</div>
                <div className="menu-meta-line">
                  {isAIEnabled ? (isAILoading ? 'AI status: Running' : 'AI status: Ready') : 'AI status: Off for MVP'}
                </div>
              </div>
              <div className="menu-divider-soft" />
              <div className="menu-section-label">Actions</div>
              {saveStatus.state === 'error' ? (
                <button type="button" onClick={() => runMenuAction(onRetrySave, statusDetailsRef)} className="menu-item mt-1">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry Save
                </button>
              ) : null}
            </div>
          </details>
        </div>

        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-pressed={isSidebarOpen}
            className={`${actionButton(isDarkMode)} lg:hidden`}
          >
            <LayoutPanelLeft className="h-3.5 w-3.5" />
            {isSidebarOpen ? 'Hide Library' : 'Library'}
          </button>

          <button
            type="button"
            onClick={onToggleInspector}
            aria-pressed={isInspectorOpen}
            className={`${actionButton(isDarkMode)} lg:hidden`}
          >
            <Rows3 className="h-3.5 w-3.5" />
            {isInspectorOpen ? 'Hide Inspect' : 'Inspect'}
          </button>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              title="Undo"
              aria-label="Undo"
              onClick={onUndo}
              disabled={!canUndo}
              className={`${actionButton(isDarkMode)} !px-2`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              title="Redo"
              aria-label="Redo"
              onClick={onRedo}
              disabled={!canRedo}
              className={`${actionButton(isDarkMode)} !px-2`}
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <details ref={viewDetailsRef} data-testid="toolbar-view-details" className="relative">
            <summary
              data-testid="toolbar-view-trigger"
              className="menu-trigger list-none cursor-pointer"
              aria-label="View settings"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </summary>
            <div
              data-testid="toolbar-view-menu"
              className="menu-panel absolute right-0 z-40 mt-1.5 min-w-[14rem]"
              data-canvas-interactive="true"
            >
              <div className="menu-section-label">Canvas</div>
              <button
                type="button"
                data-testid="toolbar-view-grid"
                onClick={() => runMenuAction(onToggleGrid, viewDetailsRef)}
                className="menu-item justify-between"
                aria-pressed={gridMode !== 'none'}
              >
                <span>Grid</span>
                {gridMode !== 'none' ? <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" /> : null}
              </button>
              <button
                type="button"
                data-testid="toolbar-view-snap"
                onClick={() => runMenuAction(onToggleSnap, viewDetailsRef)}
                className="menu-item justify-between"
                aria-pressed={snapToGrid}
              >
                <span>Snap</span>
                {snapToGrid ? <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" /> : null}
              </button>
              {enableSwimlaneToggle ? (
                <button
                  type="button"
                  data-testid="toolbar-view-lanes"
                  onClick={() => runMenuAction(onToggleSwimlanes, viewDetailsRef)}
                  className="menu-item justify-between"
                  aria-pressed={showSwimlanes}
                >
                  <span>Lanes</span>
                  {showSwimlanes ? <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" /> : null}
                </button>
              ) : null}
              <button
                type="button"
                data-testid="toolbar-view-handles"
                onClick={() => runMenuAction(onTogglePorts, viewDetailsRef)}
                className="menu-item justify-between"
                aria-pressed={showPorts}
              >
                <span>Handles on hover</span>
                {showPorts ? <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" /> : null}
              </button>
              <button
                type="button"
                data-testid="toolbar-view-minimap"
                onClick={() => runMenuAction(onToggleMinimap, viewDetailsRef)}
                className="menu-item justify-between"
                aria-pressed={showMinimap}
              >
                <span>Minimap</span>
                {showMinimap ? <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" /> : null}
              </button>
              <div className="menu-divider-soft" />
              <div className="menu-section-label">Camera</div>
              <button
                type="button"
                data-testid="toolbar-view-zoom-out"
                onClick={() => runMenuAction(onZoomOut, viewDetailsRef)}
                className="menu-item justify-between"
              >
                <span className="inline-flex items-center gap-1.5">
                  <ZoomOut className="h-3.5 w-3.5" /> Zoom out
                </span>
              </button>
              <button
                type="button"
                data-testid="toolbar-view-zoom-in"
                onClick={() => runMenuAction(onZoomIn, viewDetailsRef)}
                className="menu-item justify-between"
              >
                <span className="inline-flex items-center gap-1.5">
                  <ZoomIn className="h-3.5 w-3.5" /> Zoom in
                </span>
              </button>
              <button
                type="button"
                data-testid="toolbar-view-fit"
                onClick={() => runMenuAction(onFitView, viewDetailsRef)}
                className="menu-item"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Fit view
              </button>
              <button
                type="button"
                data-testid="toolbar-view-center"
                onClick={() => runMenuAction(onCenterDiagram, viewDetailsRef)}
                className="menu-item"
              >
                <Crosshair className="h-3.5 w-3.5" />
                Center diagram
              </button>
            </div>
          </details>

          <button
            type="button"
            data-testid="toolbar-open-command"
            onClick={onOpenCommandPalette}
            className="menu-trigger inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5"
            title="Open command palette (Cmd/Ctrl+K)"
            aria-label="Open command palette"
          >
            <Command className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            data-testid="toolbar-help-open"
            onClick={onOpenHelp}
            className={`${actionButton(isDarkMode)} !px-2`}
            title="Open quick start help ( ? )"
            aria-label="Open quick start help"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            className={`${actionButton(isDarkMode)} !px-2`}
            title={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
            aria-label={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>

          <FunctionToolbar
            recentWorkspaces={recentWorkspaces}
            feedbackHref={feedbackHref}
            onRestoreRecovery={onRestoreRecovery}
            onCreateWorkspace={onCreateWorkspace}
            onOpenWorkspace={onOpenWorkspace}
            onInsertStarterTemplate={onInsertStarterTemplate}
            onResetCanvas={onResetCanvas}
            onImportDiagram={onImportDiagram}
            onExportDiagram={onExportDiagram}
            onExportSvg={onExportSvg}
            onExportPng={onExportPng}
            onExportPdf={onExportPdf}
          />
        </div>
      </div>

      {storageWarning ? (
        <div
          role="status"
          className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
            isDarkMode
              ? 'border-amber-500/35 bg-amber-500/10 text-amber-200'
              : 'border-amber-200 bg-amber-50 text-amber-700'
          }`}
        >
          {storageWarning}
        </div>
      ) : null}
    </header>
  );
};

export default TopBar;
