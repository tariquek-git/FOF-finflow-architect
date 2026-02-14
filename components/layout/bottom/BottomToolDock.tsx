import React from 'react';
import { Hand, MoreHorizontal, MousePointer2, Pencil, Sparkles, Type as TypeIcon } from 'lucide-react';
import InsertConnectorButton from '../InsertConnectorButton';
import type { ToolMode } from '../../../types';

type BottomToolDockProps = {
  activeTool: ToolMode;
  isMobileViewport: boolean;
  showMoreButton: boolean;
  isMoreOpen: boolean;
  onSetActiveTool: (tool: ToolMode) => void;
  onAutoConnectEdge: () => void;
  onAddConnector: () => void;
  onConnectorNativeDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onToggleMore: () => void;
};

const dockButtonClass = (isActive = false) => `ff-bottom-btn${isActive ? ' is-active' : ''}`;

const BottomToolDock: React.FC<BottomToolDockProps> = ({
  activeTool,
  isMobileViewport,
  showMoreButton,
  isMoreOpen,
  onSetActiveTool,
  onAutoConnectEdge,
  onAddConnector,
  onConnectorNativeDragStart,
  onToggleMore
}) => {
  return (
    <div data-testid="bottom-tool-dock" className="ff-bottom-dock">
      <button
        type="button"
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

      {!isMobileViewport ? (
        <button
          type="button"
          onClick={onAutoConnectEdge}
          title="Auto-connect edge"
          aria-label="Auto-connect edge"
          className={dockButtonClass()}
        >
          <Sparkles className="h-4 w-4" />
        </button>
      ) : null}

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
