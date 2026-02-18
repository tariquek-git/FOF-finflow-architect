import React from 'react';
import {
  Check,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  FilePlus2,
  Import,
  RotateCcw
} from 'lucide-react';
import { DetailsMenu } from '../ui/Menu';

type RecentWorkspaceItem = {
  workspaceId: string;
  name: string;
  shortId: string;
  lastOpenedAt: string;
  isActive: boolean;
};

type FunctionToolbarProps = {
  recentWorkspaces: RecentWorkspaceItem[];
  feedbackHref: string;
  onRestoreRecovery: () => void;
  onResetCanvas: () => void;
  onImportDiagram: () => void;
  onExportDiagram: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onCreateWorkspace: () => void;
  onOpenWorkspace: (workspaceId: string) => void;
  onInsertStarterTemplate: () => void;
};

const FunctionToolbar: React.FC<FunctionToolbarProps> = ({
  recentWorkspaces,
  feedbackHref,
  onRestoreRecovery,
  onResetCanvas,
  onImportDiagram,
  onExportDiagram,
  onExportSvg,
  onExportPng,
  onExportPdf,
  onCreateWorkspace,
  onOpenWorkspace,
  onInsertStarterTemplate
}) => {
  const RECENT_WORKSPACES_LIMIT = 4;
  const visibleRecentWorkspaces = recentWorkspaces.slice(0, RECENT_WORKSPACES_LIMIT);
  const hiddenRecentCount = Math.max(0, recentWorkspaces.length - visibleRecentWorkspaces.length);

  const menuRef = React.useRef<HTMLDetailsElement | null>(null);

  const closeMenu = React.useCallback(() => {
    if (menuRef.current?.open) {
      menuRef.current.open = false;
    }
  }, []);

  const runMenuAction = React.useCallback(
    (callback: () => void) => {
      callback();
      closeMenu();
    },
    [closeMenu]
  );

  const formatRecentTimestamp = React.useCallback((iso: string) => {
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) return 'Unknown';
    return new Date(parsed).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }, []);

  return (
    <div data-testid="primary-actions-strip" className="flex items-center gap-2">
      <DetailsMenu
        detailsRef={menuRef}
        className="relative"
        trigger={<Download className="h-3.5 w-3.5" />}
        triggerProps={{
          'data-testid': 'toolbar-file-trigger',
          className: 'menu-trigger',
          title: 'Export and file actions',
          'aria-label': 'Export and file actions'
        }}
        menuId="toolbar-file-menu"
        menuClassName="menu-panel absolute right-0 z-40 mt-1.5 min-w-[14.5rem]"
      >
          <div className="menu-section-label">Export</div>
          <button
            type="button"
            data-testid="toolbar-export-json"
            onClick={() => runMenuAction(onExportDiagram)}
            className="menu-item"
            title="Export JSON"
          >
            <Download className="h-3.5 w-3.5" />
            Export JSON
          </button>
          <button
            type="button"
            data-testid="toolbar-export-svg"
            onClick={() => runMenuAction(onExportSvg)}
            className="menu-item"
            title="Export SVG"
          >
            <Download className="h-3.5 w-3.5" />
            Export SVG
          </button>
          <button
            type="button"
            data-testid="toolbar-export-png"
            onClick={() => runMenuAction(onExportPng)}
            className="menu-item"
            title="Export PNG"
          >
            <FileImage className="h-3.5 w-3.5" />
            Export PNG
          </button>
          <button
            type="button"
            data-testid="toolbar-export-pdf"
            onClick={() => runMenuAction(onExportPdf)}
            className="menu-item"
            title="Export PDF"
          >
            <FileText className="h-3.5 w-3.5" />
            Export PDF
          </button>
          <div className="menu-divider-soft" />
          <div className="menu-section-label">Workspace</div>
          <button
            type="button"
            data-testid="toolbar-new-workspace"
            onClick={() => runMenuAction(onCreateWorkspace)}
            className="menu-item"
            title="Create workspace"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            New Workspace
          </button>
          {visibleRecentWorkspaces.length > 0 ? (
            <>
              <div className="menu-divider-soft" />
              <div className="menu-section-label">Recent</div>
              <div className="max-h-44 overflow-y-auto">
                {visibleRecentWorkspaces.map((workspace) => (
                  <button
                    key={workspace.workspaceId}
                    type="button"
                    data-testid="toolbar-open-workspace"
                    data-workspace-id={workspace.workspaceId}
                    onClick={() => runMenuAction(() => onOpenWorkspace(workspace.workspaceId))}
                    className="menu-item flex-col items-start gap-0.5 py-2"
                    title={`Open ${workspace.name} · ${workspace.shortId}`}
                  >
                    <span className="inline-flex w-full items-center justify-between gap-2 text-left">
                      <span className="truncate">
                        {workspace.name} · {workspace.shortId}
                      </span>
                      {workspace.isActive ? <Check className="h-3.5 w-3.5 shrink-0 text-cyan-600 dark:text-cyan-300" /> : null}
                    </span>
                    <span className="menu-meta-line">
                      Opened {formatRecentTimestamp(workspace.lastOpenedAt)}
                    </span>
                  </button>
                ))}
              </div>
              {hiddenRecentCount > 0 ? (
                <div className="px-2 pb-1 pt-0.5 text-[10px] font-medium text-text-muted">
                  +{hiddenRecentCount} more in Command Palette
                </div>
              ) : null}
            </>
          ) : null}
          <div className="menu-divider-soft" />
          <button
            type="button"
            data-testid="toolbar-import-json"
            onClick={() => runMenuAction(onImportDiagram)}
            className="menu-item"
            title="Import JSON"
          >
            <Import className="h-3.5 w-3.5" />
            Import JSON
          </button>
          <button
            type="button"
            data-testid="toolbar-insert-starter-template"
            onClick={() => runMenuAction(onInsertStarterTemplate)}
            className="menu-item"
            title="Insert starter template"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            Insert Starter Template
          </button>
          <button
            type="button"
            data-testid="toolbar-restore"
            onClick={onRestoreRecovery}
            className="menu-item"
            title="Restore backup"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore Backup
          </button>
          <button
            type="button"
            data-testid="toolbar-reset-canvas"
            onClick={() => runMenuAction(onResetCanvas)}
            className="menu-item rounded-md text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/30"
            title="Reset to blank"
          >
            Reset Workspace
          </button>
          <a
            href={feedbackHref}
            target="_blank"
            rel="noreferrer"
            className="menu-item"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Feedback
          </a>
      </DetailsMenu>
    </div>
  );
};

export default FunctionToolbar;
