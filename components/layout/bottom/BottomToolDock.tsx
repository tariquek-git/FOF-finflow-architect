import React, { useCallback, useEffect, useRef } from 'react';
import {
  ChevronDown,
  Hand,
  Maximize2,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  Plus,
  Type as TypeIcon
} from 'lucide-react';
import InsertConnectorButton from '../InsertConnectorButton';
import type { ToolMode } from '../../../types';

type BottomToolDockProps = {
  activeTool: ToolMode;
  zoom: number;
  isMobileViewport: boolean;
  showMoreButton: boolean;
  isMoreOpen: boolean;
  onSetActiveTool: (tool: ToolMode) => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetZoom: () => void;
  onFitView: () => void;
  onSetZoomPercent: (percent: number) => void;
  onAddConnector: () => void;
  onConnectorNativeDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onToggleMore: () => void;
};

const dockButtonClass = (isActive = false) => `ff-bottom-btn${isActive ? ' is-active' : ''}`;

const BottomToolDock: React.FC<BottomToolDockProps> = ({
  activeTool,
  zoom,
  isMobileViewport,
  showMoreButton,
  isMoreOpen,
  onSetActiveTool,
  onZoomOut,
  onZoomIn,
  onResetZoom,
  onFitView,
  onSetZoomPercent,
  onAddConnector,
  onConnectorNativeDragStart,
  onToggleMore
}) => {
  const zoomPercent = Math.round(zoom * 100);
  const commonZoomLevels = [50, 75, 100, 125, 150, 200];
  const zoomDetailsRef = useRef<HTMLDetailsElement>(null);
  const showInlineZoomButtons = !isMobileViewport;

  const closeZoomMenu = useCallback(() => {
    const details = zoomDetailsRef.current;
    if (details && details.open) {
      details.open = false;
    }
  }, []);

  useEffect(() => {
    const details = zoomDetailsRef.current;
    if (!details) return;

    // <details> stays open by default; close it on outside click + Escape so it never blocks canvas interactions.
    const onWindowPointerDown = (event: PointerEvent) => {
      if (!details.open) return;
      const target = event.target as Node | null;
      if (target && details.contains(target)) return;
      details.open = false;
    };

    const onWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!details.open) return;
      details.open = false;
    };

    window.addEventListener('pointerdown', onWindowPointerDown, true);
    window.addEventListener('keydown', onWindowKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onWindowPointerDown, true);
      window.removeEventListener('keydown', onWindowKeyDown);
    };
  }, []);

  return (
    <div data-testid="bottom-tool-dock" className="ff-bottom-dock" data-canvas-interactive="true">
      <button
        type="button"
        data-testid="bottom-tool-select"
        onClick={() => onSetActiveTool('select')}
        aria-label="Select tool"
        aria-pressed={activeTool === 'select'}
        title="Select (V)"
        className={dockButtonClass(activeTool === 'select')}
      >
        <MousePointer2 className="h-4 w-4" />
      </button>

      <button
        type="button"
        data-testid="bottom-tool-hand"
        onClick={() => onSetActiveTool('hand')}
        aria-label="Hand tool"
        aria-pressed={activeTool === 'hand'}
        title="Hand (H)"
        className={dockButtonClass(activeTool === 'hand')}
      >
        <Hand className="h-4 w-4" />
      </button>

      <button
        type="button"
        data-testid="bottom-tool-connect"
        onClick={() => onSetActiveTool('draw')}
        aria-label="Connect tool"
        aria-pressed={activeTool === 'draw'}
        title="Connect mode (C)"
        className={dockButtonClass(activeTool === 'draw')}
      >
        <Pencil className="h-4 w-4" />
      </button>

      <button
        type="button"
        data-testid="bottom-tool-text"
        onClick={() => onSetActiveTool('text')}
        aria-label="Text tool"
        aria-pressed={activeTool === 'text'}
        title="Text (T)"
        className={dockButtonClass(activeTool === 'text')}
      >
        <TypeIcon className="h-4 w-4" />
      </button>

      <span className="ff-bottom-divider" aria-hidden="true" />

      <InsertConnectorButton
        onClick={onAddConnector}
        onNativeDragStart={onConnectorNativeDragStart}
        className="ff-bottom-btn"
        showLabel={false}
      />

      <span className="ff-bottom-divider" aria-hidden="true" />

      <button
        type="button"
        data-testid="bottom-zoom-out"
        onClick={onZoomOut}
        aria-label="Zoom out"
        title="Zoom out (Ctrl/Cmd -)"
        className={dockButtonClass()}
        style={{ display: showInlineZoomButtons ? undefined : 'none' }}
      >
        <Minus className="h-4 w-4" />
      </button>

      <details ref={zoomDetailsRef} className="ff-bottom-zoom-details">
        <summary
          data-testid="bottom-zoom-menu-trigger"
          className="ff-bottom-btn ff-bottom-zoom-trigger list-none"
          aria-label="Zoom level"
          title="Zoom level"
        >
          <span className="ff-bottom-zoom-text">{zoomPercent}%</span>
          <ChevronDown className="h-3.5 w-3.5" />
        </summary>
        <div data-testid="bottom-zoom-menu" className="menu-panel ff-bottom-zoom-menu">
          <div className="menu-section-label">Zoom</div>
          {!showInlineZoomButtons ? (
            <>
              <button
                type="button"
                onClick={() => {
                  onZoomIn();
                  closeZoomMenu();
                }}
                className="menu-item"
              >
                Zoom in
              </button>
              <button
                type="button"
                onClick={() => {
                  onZoomOut();
                  closeZoomMenu();
                }}
                className="menu-item"
              >
                Zoom out
              </button>
              <button
                type="button"
                onClick={() => {
                  onFitView();
                  closeZoomMenu();
                }}
                className="menu-item"
              >
                Fit view
              </button>
              <div className="menu-separator" />
            </>
          ) : null}
          <button
            type="button"
            data-testid="bottom-zoom-reset-100"
            onClick={() => {
              onResetZoom();
              closeZoomMenu();
            }}
            className="menu-item"
          >
            Reset to 100%
          </button>
          {commonZoomLevels.map((percent) => (
            <button
              key={`zoom-${percent}`}
              type="button"
              data-testid={`bottom-zoom-set-${percent}`}
              onClick={() => {
                onSetZoomPercent(percent);
                closeZoomMenu();
              }}
              className={`menu-item justify-between ${percent === zoomPercent ? 'is-active' : ''}`}
            >
              <span>{percent}%</span>
            </button>
          ))}
        </div>
      </details>

      <button
        type="button"
        data-testid="bottom-zoom-in"
        onClick={onZoomIn}
        aria-label="Zoom in"
        title="Zoom in (Ctrl/Cmd +)"
        className={dockButtonClass()}
        style={{ display: showInlineZoomButtons ? undefined : 'none' }}
      >
        <Plus className="h-4 w-4" />
      </button>

      <button
        type="button"
        data-testid="bottom-fit-view"
        onClick={onFitView}
        aria-label="Fit view"
        title="Fit to view"
        className={dockButtonClass()}
        style={{ display: showInlineZoomButtons ? undefined : 'none' }}
      >
        <Maximize2 className="h-4 w-4" />
      </button>

      {isMobileViewport && showMoreButton ? (
        <button
          type="button"
          data-testid="bottom-more-actions"
          onClick={onToggleMore}
          aria-label="More actions"
          aria-expanded={isMoreOpen}
          title="More actions"
          className={dockButtonClass(isMoreOpen)}
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
};

export default BottomToolDock;
