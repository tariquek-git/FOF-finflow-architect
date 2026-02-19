import React, { useCallback, useRef } from 'react';
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
import { DetailsMenu } from '../../ui/Menu';

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

  return (
    <div data-testid="bottom-tool-dock" className="ff-bottom-dock" data-canvas-interactive="true">
      <div
        className="ff-bottom-group"
        data-testid="bottom-group-navigation"
        role="group"
        aria-label="Navigation tools"
      >
        <button
          type="button"
          data-testid="bottom-tool-select"
          onClick={() => onSetActiveTool('select')}
          aria-label="Select tool"
          aria-keyshortcuts="V"
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
          aria-keyshortcuts="H"
          aria-pressed={activeTool === 'hand'}
          title="Hand (H)"
          className={dockButtonClass(activeTool === 'hand')}
        >
          <Hand className="h-4 w-4" />
        </button>
      </div>

      <div
        className="ff-bottom-group"
        data-testid="bottom-group-creation"
        role="group"
        aria-label="Creation tools"
      >
        <button
          type="button"
          data-testid="bottom-tool-connect"
          onClick={() => onSetActiveTool('draw')}
          aria-label="Connect tool"
          aria-keyshortcuts="C"
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
          aria-keyshortcuts="T"
          aria-pressed={activeTool === 'text'}
          title="Text (T)"
          className={dockButtonClass(activeTool === 'text')}
        >
          <TypeIcon className="h-4 w-4" />
        </button>

        <InsertConnectorButton
          onClick={onAddConnector}
          onNativeDragStart={onConnectorNativeDragStart}
          className="ff-bottom-btn"
          showLabel={false}
        />
      </div>

      <div
        className="ff-bottom-group"
        data-testid="bottom-group-view"
        role="group"
        aria-label="View controls"
      >
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

        <DetailsMenu
          detailsRef={zoomDetailsRef as unknown as React.RefObject<HTMLDetailsElement | null>}
          className="ff-bottom-zoom-details"
          trigger={
            <>
              <span className="ff-bottom-zoom-text">{zoomPercent}%</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </>
          }
          triggerProps={{
            'data-testid': 'bottom-zoom-menu-trigger',
            className: 'ff-bottom-btn ff-bottom-zoom-trigger',
            'aria-label': 'Zoom level',
            title: 'Zoom level'
          }}
          menuId="bottom-zoom-menu"
          menuClassName="menu-panel ff-bottom-zoom-menu"
        >
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
              <div className="menu-divider-soft" aria-hidden="true" />
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
        </DetailsMenu>

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

      </div>

      <div
        className="ff-bottom-group"
        data-testid="bottom-group-utility"
        role="group"
        aria-label="Utility actions"
      >
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
    </div>
  );
};

export default BottomToolDock;
