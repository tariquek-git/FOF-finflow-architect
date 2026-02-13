import React from 'react';
import {
  ArrowRight,
  ArrowRightLeft,
  Divide,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  Sparkles,
  Trash2,
  Type as TypeIcon
} from 'lucide-react';
import InsertConnectorButton from './InsertConnectorButton';
import type { ToolMode } from '../../types';

type FloatingContextBarProps = {
  isDarkMode: boolean;
  anchor: { x: number; y: number } | null;
  activeTool: ToolMode;
  onSetActiveTool: (tool: ToolMode) => void;
  onAutoConnectEdge: () => void;
  onAddConnector: () => void;
  onConnectorNativeDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDelete: () => void;
  onDuplicateSelection: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onDistribute: () => void;
  selectedNodeCount: number;
  hasSelectedEdge: boolean;
  activeEdgeStyle: 'solid' | 'dashed' | 'dotted';
  onSetEdgeStyle: (style: 'solid' | 'dashed' | 'dotted') => void;
  arrowHeadEnabled: boolean;
  midArrowEnabled: boolean;
  onToggleArrowHead: () => void;
  onToggleMidArrow: () => void;
};

const FloatingContextBar: React.FC<FloatingContextBarProps> = ({
  isDarkMode,
  anchor,
  activeTool,
  onSetActiveTool,
  onAutoConnectEdge,
  onAddConnector,
  onConnectorNativeDragStart,
  onDelete,
  onDuplicateSelection,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onDistribute,
  selectedNodeCount,
  hasSelectedEdge,
  activeEdgeStyle,
  onSetEdgeStyle,
  arrowHeadEnabled,
  midArrowEnabled,
  onToggleArrowHead,
  onToggleMidArrow
}) => {
  const isConnectMode = activeTool === 'draw';
  const showArrangeControls = selectedNodeCount >= 2;

  const style = anchor
    ? {
        left: `${anchor.x}px`,
        top: `${Math.max(56, anchor.y - 6)}px`,
        transform: 'translate(-50%, -100%)'
      }
    : { left: '50%', bottom: '5.15rem', transform: 'translateX(-50%)' };

  return (
    <div
      className={`pointer-events-auto absolute z-30 flex max-w-[calc(100%-1rem)] flex-col gap-1 rounded-xl border px-2 py-1 shadow-lg transition-opacity ${
        isConnectMode ? 'opacity-80' : 'opacity-100'
      } ${
        isDarkMode
          ? 'border-slate-700 bg-slate-900/96 text-slate-200'
          : 'border-slate-300 bg-white/97 text-slate-700'
      }`}
      style={style}
    >
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSetActiveTool('select')}
            aria-label="Select tool"
            aria-pressed={activeTool === 'select'}
            title="Select (V)"
            className={`toolbar-chip ${activeTool === 'select' ? 'is-active' : ''}`}
          >
            <MousePointer2 className="h-4 w-4" />
            <span className="hidden lg:inline">Select</span>
          </button>
          <button
            type="button"
            onClick={() => onSetActiveTool('draw')}
            aria-label="Connect tool"
            aria-pressed={activeTool === 'draw'}
            title="Connect mode (C)"
            className={`toolbar-chip ${activeTool === 'draw' ? 'is-active' : ''}`}
          >
            <Pencil className="h-4 w-4" />
            <span className="hidden lg:inline">Connect</span>
          </button>
          <button
            type="button"
            onClick={() => onSetActiveTool('text')}
            aria-label="Text tool"
            aria-pressed={activeTool === 'text'}
            title="Text (T)"
            className={`toolbar-chip ${activeTool === 'text' ? 'is-active' : ''}`}
          >
            <TypeIcon className="h-4 w-4" />
            <span className="hidden lg:inline">Text</span>
          </button>
        </div>

        {isConnectMode ? (
          <span
            className={`hidden rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] xl:inline-flex ${
              isDarkMode
                ? 'border-sky-300/40 bg-sky-500/15 text-sky-100'
                : 'border-sky-200 bg-sky-50 text-sky-700'
            }`}
          >
            Connect Mode
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={onAutoConnectEdge}
              title="Auto-connect edge"
              aria-label="Auto-connect edge"
              className="toolbar-chip"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Auto Edge</span>
            </button>

            <InsertConnectorButton onClick={onAddConnector} onNativeDragStart={onConnectorNativeDragStart} />

            <button
              type="button"
              onClick={onDelete}
              title="Delete selected"
              aria-label="Delete selected item"
              className="toolbar-chip"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Delete</span>
            </button>

            <button
              type="button"
              onClick={onDuplicateSelection}
              disabled={selectedNodeCount === 0}
              title="Duplicate selected nodes"
              aria-label="Duplicate selected nodes"
              className="toolbar-chip"
            >
              <span className="hidden sm:inline">Duplicate</span>
              <span className="sm:hidden">Dup</span>
            </button>
          </>
        )}
      </div>

      {!isConnectMode || hasSelectedEdge ? (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border-t border-slate-200/70 pt-1 dark:border-slate-700/80">
          {!isConnectMode && showArrangeControls ? (
            <>
              <button
                type="button"
                onClick={onAlignLeft}
                disabled={selectedNodeCount < 2}
                title="Align left"
                aria-label="Align selected left"
                className="toolbar-chip !px-2"
              >
                L
              </button>
              <button
                type="button"
                onClick={onAlignCenter}
                disabled={selectedNodeCount < 2}
                title="Align center"
                aria-label="Align selected center"
                className="toolbar-chip !px-2"
              >
                C
              </button>
              <button
                type="button"
                onClick={onAlignRight}
                disabled={selectedNodeCount < 2}
                title="Align right"
                aria-label="Align selected right"
                className="toolbar-chip !px-2"
              >
                R
              </button>
              <button
                type="button"
                onClick={onDistribute}
                disabled={selectedNodeCount < 3}
                title="Distribute horizontally"
                aria-label="Distribute selected horizontally"
                className="toolbar-chip"
              >
                Dist
              </button>
              <div className="mx-0.5 h-5 w-px bg-slate-300 dark:bg-slate-600" />
            </>
          ) : null}

          {[
            { id: 'solid', icon: <Minus className="h-4 w-4" />, title: 'solid line style' },
            { id: 'dashed', icon: <Divide className="h-4 w-4 rotate-90" />, title: 'dashed line style' },
            { id: 'dotted', icon: <MoreHorizontal className="h-4 w-4" />, title: 'dotted line style' }
          ].map((styleOption) => (
            <button
              key={styleOption.id}
              type="button"
              onClick={() => onSetEdgeStyle(styleOption.id as 'solid' | 'dashed' | 'dotted')}
              disabled={!hasSelectedEdge}
              title={styleOption.title}
              aria-label={styleOption.title}
              aria-pressed={hasSelectedEdge && activeEdgeStyle === styleOption.id}
              className={`toolbar-chip !h-8 !w-8 !px-0 ${hasSelectedEdge && activeEdgeStyle === styleOption.id ? 'is-active' : ''}`}
            >
              {styleOption.icon}
            </button>
          ))}

          <button
            type="button"
            onClick={onToggleArrowHead}
            disabled={!hasSelectedEdge}
            aria-pressed={hasSelectedEdge && arrowHeadEnabled}
            title="Toggle arrow head"
            aria-label="Toggle arrow head"
            className={`toolbar-chip !h-8 !w-8 !px-0 ${hasSelectedEdge && arrowHeadEnabled ? 'is-active' : ''}`}
          >
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleMidArrow}
            disabled={!hasSelectedEdge}
            aria-pressed={hasSelectedEdge && midArrowEnabled}
            title="Toggle middle arrow"
            aria-label="Toggle middle arrow"
            className={`toolbar-chip !h-8 !w-8 !px-0 ${hasSelectedEdge && midArrowEnabled ? 'is-active' : ''}`}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default FloatingContextBar;
