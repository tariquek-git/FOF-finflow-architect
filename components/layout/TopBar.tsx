import React from 'react';
import {
  AlertTriangle,
  Download,
  FileImage,
  FileText,
  HelpCircle,
  LifeBuoy,
  Moon,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sun,
  Upload
} from 'lucide-react';
import IconButton from '../ui/IconButton';

type TopBarProps = {
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
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
  onToggleTheme: () => void;
  onOpenHelp: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onRestoreRecovery: () => void;
  onResetCanvas: () => void;
  onImportDiagram: () => void;
  onExportDiagram: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  centerSlot?: React.ReactNode;
};

const TopBar: React.FC<TopBarProps> = ({
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
  onToggleSidebar,
  onToggleInspector,
  onToggleTheme,
  onOpenHelp,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onRestoreRecovery,
  onResetCanvas,
  onImportDiagram,
  onExportDiagram,
  onExportPng,
  onExportPdf,
  centerSlot
}) => {
  return (
    <header
      className={`ui-panel glass-panel z-40 mx-2 mt-2 flex shrink-0 flex-col gap-2 px-3 py-2 md:mx-3 md:flex-row md:items-center md:justify-between ${
        isDarkMode ? 'bg-slate-900/92' : 'bg-white/95'
      }`}
    >
      <div className="flex min-w-0 items-center gap-2 md:gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 text-lg font-bold text-white shadow-sm">
          F
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold tracking-tight">Flow of Funds Studio</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600 dark:text-blue-300">
            Project Workspace
          </p>
        </div>
        <span
          className={`mono hidden rounded-full px-2 py-0.5 text-[10px] font-medium lg:inline-flex ${
            isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {nodesCount} nodes | {edgesCount} links
        </span>
      </div>

      <div className="flex-1 md:max-w-xl md:px-6">{centerSlot}</div>

      <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
        <div className="flex w-full items-center gap-1.5 overflow-x-auto pb-1 md:w-auto md:overflow-visible md:pb-0">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-pressed={isSidebarOpen}
            className={`tap-target shrink-0 rounded-md border px-2.5 py-2 text-[11px] font-semibold transition lg:hidden ${
              isDarkMode
                ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isSidebarOpen ? 'Hide Library' : 'Library'}
          </button>

          <button
            type="button"
            onClick={onToggleInspector}
            aria-pressed={isInspectorOpen}
            className={`tap-target shrink-0 rounded-md border px-2.5 py-2 text-[11px] font-semibold transition lg:hidden ${
              isDarkMode
                ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isInspectorOpen ? 'Hide Inspect' : 'Inspect'}
          </button>

          <div className="shrink-0 space-y-1">
            <div className="ui-section-title px-1">History</div>
            <div
              className={`flex shrink-0 items-center gap-1 rounded-md border p-1 ${
                isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
              }`}
            >
              <IconButton
                icon={<RotateCcw className="h-4 w-4" />}
                label="Undo"
                title="Undo"
                onClick={onUndo}
                disabled={!canUndo}
                className="!h-8 !w-8 !px-0"
              />
              <IconButton
                icon={<RotateCw className="h-4 w-4" />}
                label="Redo"
                title="Redo"
                onClick={onRedo}
                disabled={!canRedo}
                className="!h-8 !w-8 !px-0"
              />
            </div>
          </div>

          <div className="shrink-0 space-y-1">
            <div className="ui-section-title px-1">Primary Actions</div>
            <div
              data-testid="primary-actions-strip"
              className={`flex flex-wrap items-center gap-1 rounded-md border p-1.5 ${
                isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
              }`}
            >
              <span className="sr-only">Primary Actions</span>
              <button
                onClick={onRestoreRecovery}
                data-testid="toolbar-restore"
                title="Restore backup"
                className={`tap-target inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${
                  isDarkMode
                    ? hasRecoverySnapshot
                      ? 'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20'
                    : hasRecoverySnapshot
                      ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                      : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                }`}
              >
                <LifeBuoy className="h-3.5 w-3.5" />
                <span>Restore Backup</span>
              </button>

              <button
                onClick={onResetCanvas}
                data-testid="toolbar-reset-canvas"
                title="New / Reset canvas"
                className={`tap-target inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${
                  isDarkMode
                    ? 'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>

              <button
                data-testid="toolbar-import-json"
                onClick={onImportDiagram}
                title="Import JSON"
                className={`tap-target inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${
                  isDarkMode
                    ? 'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Upload className="h-3.5 w-3.5" />
                <span>Import JSON</span>
              </button>

              <button
                data-testid="toolbar-export-json"
                onClick={onExportDiagram}
                title="Export JSON"
                className="tap-target inline-flex items-center gap-1.5 rounded-md bg-gradient-to-b from-blue-600 to-blue-700 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:brightness-110 dark:from-blue-500 dark:to-blue-600"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export JSON</span>
              </button>

              <details className="relative">
                <summary
                  className={`tap-target inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${
                    isDarkMode
                      ? 'border-slate-700 bg-slate-800 text-slate-100 hover:bg-slate-700'
                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Download className="h-3.5 w-3.5" /> More
                </summary>
                <div
                  className={`absolute right-0 z-20 mt-1 flex min-w-[9.5rem] flex-col gap-1 rounded-md border p-1.5 shadow-lg ${
                    isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'
                  }`}
                >
                  <button
                    type="button"
                    data-testid="toolbar-export-png"
                    onClick={onExportPng}
                    className="ui-button-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold"
                  >
                    <FileImage className="h-3.5 w-3.5" /> Export PNG
                  </button>
                  <button
                    type="button"
                    data-testid="toolbar-export-pdf"
                    onClick={onExportPdf}
                    className="ui-button-secondary inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold"
                  >
                    <FileText className="h-3.5 w-3.5" /> Export PDF
                  </button>
                </div>
              </details>
            </div>
          </div>

          <IconButton
            icon={isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            label={isDarkMode ? 'Light' : 'Dark'}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={onToggleTheme}
            className="!h-10"
          />

          <button
            data-testid="toolbar-help-open"
            type="button"
            onClick={onOpenHelp}
            aria-label="Open quick start help"
            className={`tap-target shrink-0 rounded-md border px-2.5 py-2 text-[11px] font-semibold transition ${
              isDarkMode
                ? 'border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
            title="Open quick start help ( ? )"
          >
            <span className="inline-flex items-center gap-1">
              <HelpCircle className="h-3.5 w-3.5" />Help
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          <span
            data-testid="backup-status-indicator"
            data-last-saved-at={recoveryLastSavedAt || ''}
            className={`rounded-full px-2 py-0.5 ${
              hasRecoverySnapshot
                ? isDarkMode
                  ? 'bg-emerald-500/20 text-emerald-200'
                  : 'bg-emerald-100 text-emerald-700'
                : isDarkMode
                  ? 'bg-amber-500/20 text-amber-200'
                  : 'bg-amber-100 text-amber-700'
            }`}
          >
            {backupStatusText}
          </span>
          {storageWarning ? (
            <span
              role="status"
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                isDarkMode ? 'bg-amber-500/15 text-amber-200' : 'bg-amber-100 text-amber-700'
              }`}
              title={storageWarning}
            >
              <AlertTriangle className="h-3 w-3" /> Autosave issue
            </span>
          ) : null}
          <a
            href={feedbackHref}
            target="_blank"
            rel="noreferrer"
            className={`rounded-full px-2 py-0.5 transition ${
              isDarkMode
                ? 'bg-blue-500/20 text-blue-200 hover:bg-blue-500/30'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            Feedback
          </a>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
