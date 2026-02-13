import React from 'react';
import { Crosshair, Grid2x2, Minus, Plus, Rows3 } from 'lucide-react';
import type { GridMode, Position } from '../../types';

type BottomStatusBarProps = {
  isDarkMode: boolean;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetView: () => void;
  onFitView: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  gridMode: GridMode;
  onCycleGridMode: () => void;
  pointerWorld: Position | null;
  selectedNodeCount: number;
  hasSelectedEdge: boolean;
  onOpenCanvasControls: () => void;
};

const BottomStatusBar: React.FC<BottomStatusBarProps> = ({
  isDarkMode,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetView,
  onFitView,
  snapToGrid,
  onToggleSnap,
  gridMode,
  onCycleGridMode,
  pointerWorld,
  selectedNodeCount,
  hasSelectedEdge,
  onOpenCanvasControls
}) => {
  const pointerLabel = pointerWorld
    ? `X:${Math.round(pointerWorld.x)} Y:${Math.round(pointerWorld.y)}`
    : 'X:- Y:-';

  const selectionLabel = `${selectedNodeCount} node${selectedNodeCount === 1 ? '' : 's'}${
    hasSelectedEdge ? ' • 1 edge' : ''
  }`;

  return (
    <div
      data-testid="bottom-status-bar"
      className="pointer-events-none absolute bottom-2 left-1/2 z-30 w-[min(98%,1200px)] -translate-x-1/2"
    >
      <div className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1.5 text-[11px]">
        <div
          className={`pointer-events-auto flex items-center gap-1.5 rounded-lg border px-1.5 py-1 shadow-sm ${
            isDarkMode
              ? 'border-slate-700 bg-slate-900/92 text-slate-200'
              : 'border-slate-300 bg-white/96 text-slate-700'
          }`}
        >
          <button
            type="button"
            onClick={onZoomOut}
            aria-label="Zoom out"
            className="status-chip"
            title="Zoom out"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            aria-label="Zoom in"
            className="status-chip"
            title="Zoom in"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onResetView} className="status-chip" title="Reset view">
            {Math.round(zoom * 100)}%
          </button>
          <button type="button" onClick={onFitView} className="status-chip" title="Fit graph to view">
            Fit
          </button>
        </div>

        <div
          className={`pointer-events-auto flex items-center gap-1.5 rounded-lg border px-1.5 py-1 shadow-sm ${
            isDarkMode
              ? 'border-slate-700 bg-slate-900/92 text-slate-200'
              : 'border-slate-300 bg-white/96 text-slate-700'
          }`}
        >
          <button
            type="button"
            onClick={onToggleSnap}
            className={`status-chip ${snapToGrid ? 'is-active' : ''}`}
            title="Toggle snap to grid"
          >
            Snap
          </button>
          <button
            type="button"
            onClick={onCycleGridMode}
            className={`status-chip ${gridMode !== 'none' ? 'is-active' : ''}`}
            title="Toggle grid mode"
          >
            <Grid2x2 className="h-3.5 w-3.5" />
            <span>{gridMode}</span>
          </button>
          <button
            type="button"
            onClick={onOpenCanvasControls}
            className="status-chip"
            title="Open layout controls"
            aria-label="Open layout controls"
          >
            <Rows3 className="h-3.5 w-3.5" />
            <span>Canvas</span>
          </button>
        </div>

        <div
          className={`pointer-events-auto flex items-center gap-1.5 rounded-lg border px-1.5 py-1 shadow-sm ${
            isDarkMode
              ? 'border-slate-700 bg-slate-900/92 text-slate-200'
              : 'border-slate-300 bg-white/96 text-slate-700'
          }`}
        >
          <span className="status-chip status-readonly" title="Selection count">
            {selectionLabel}
          </span>
          <span className="status-chip status-readonly" title="Cursor coordinates">
            <Crosshair className="h-3.5 w-3.5" />
            <span>{pointerLabel}</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default BottomStatusBar;
