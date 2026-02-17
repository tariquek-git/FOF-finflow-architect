import React, { useEffect, useMemo, useState } from 'react';
import type { ToolMode } from '../../types';
import ActionOverflowSheet from './bottom/ActionOverflowSheet';
import BottomToolDock from './bottom/BottomToolDock';
import SelectionActionTray from './bottom/SelectionActionTray';

const DevEnvBadge: React.FC = () => {
  const [origin, setOrigin] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOrigin(window.location.origin);
  }, []);

  // Dev-only, visual guard to prevent "wrong localhost port" confusion.
  if (!import.meta.env.DEV) return null;
  if (!origin) return null;

  const label = origin.replace(/^https?:\/\//, '');

  return (
    <div className="pointer-events-none fixed bottom-2 right-2 z-20">
      <div
        data-testid="dev-env-badge"
        aria-hidden="true"
        className="rounded-full border border-divider/35 bg-surface-panel/70 px-2 py-1 text-[10px] font-semibold text-text-muted/90 shadow-sm backdrop-blur"
      >
        DEV · {label}
      </div>
    </div>
  );
};

type FloatingContextBarProps = {
  isDarkMode: boolean;
  isMobileViewport: boolean;
  anchor: { x: number; y: number } | null;
  activeTool: ToolMode;
  zoom: number;
  onSetActiveTool: (tool: ToolMode) => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onResetZoom: () => void;
  onFitView: () => void;
  onSetZoomPercent: (percent: number) => void;
  onAddConnector: () => void;
  onConnectorNativeDragStart: (event: React.DragEvent<HTMLButtonElement>) => void;
  onDelete: () => void;
  onDuplicateSelection: () => void;
  onAlignLeft: () => void;
  onAlignCenter: () => void;
  onAlignRight: () => void;
  onDistribute: () => void;
  selectedNodeCount: number;
  onRenameSelection: () => void;
  onToggleQuickAttribute: () => void;
  isQuickAttributePinned: boolean;
};

const FloatingContextBar: React.FC<FloatingContextBarProps> = ({
  isDarkMode: _isDarkMode,
  isMobileViewport,
  anchor,
  activeTool,
  zoom,
  onSetActiveTool,
  onZoomOut,
  onZoomIn,
  onResetZoom,
  onFitView,
  onSetZoomPercent,
  onAddConnector,
  onConnectorNativeDragStart,
  onDelete,
  onDuplicateSelection,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onDistribute,
  selectedNodeCount,
  onRenameSelection,
  onToggleQuickAttribute,
  isQuickAttributePinned
}) => {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);

  const visibility = useMemo(() => {
    const hasSelection = selectedNodeCount > 0;
    const canShowSelectionActions = hasSelection && activeTool === 'select';
    const shouldShowDesktopTray = canShowSelectionActions && selectedNodeCount >= 2;

    return {
      showDesktopTray: !isMobileViewport && shouldShowDesktopTray && !!anchor,
      showMobileMore: isMobileViewport && canShowSelectionActions
    };
  }, [activeTool, anchor, isMobileViewport, selectedNodeCount]);

  useEffect(() => {
    if (!visibility.showMobileMore && isOverflowOpen) {
      setIsOverflowOpen(false);
    }
  }, [isOverflowOpen, visibility.showMobileMore]);

  useEffect(() => {
    if (!isMobileViewport && isOverflowOpen) {
      setIsOverflowOpen(false);
    }
  }, [isMobileViewport, isOverflowOpen]);

  return (
    <>
      <BottomToolDock
        activeTool={activeTool}
        zoom={zoom}
        isMobileViewport={isMobileViewport}
        showMoreButton={visibility.showMobileMore}
        isMoreOpen={isOverflowOpen}
        onSetActiveTool={onSetActiveTool}
        onZoomOut={onZoomOut}
        onZoomIn={onZoomIn}
        onResetZoom={onResetZoom}
        onFitView={onFitView}
        onSetZoomPercent={onSetZoomPercent}
        onAddConnector={onAddConnector}
        onConnectorNativeDragStart={onConnectorNativeDragStart}
        onToggleMore={() => setIsOverflowOpen((prev) => !prev)}
      />

      {visibility.showDesktopTray ? (
        <SelectionActionTray
          anchor={anchor}
          selectedNodeCount={selectedNodeCount}
          onDelete={onDelete}
          onDuplicateSelection={onDuplicateSelection}
          onRenameSelection={onRenameSelection}
          onToggleQuickAttribute={onToggleQuickAttribute}
          isQuickAttributePinned={isQuickAttributePinned}
          onAlignLeft={onAlignLeft}
          onAlignCenter={onAlignCenter}
          onAlignRight={onAlignRight}
          onDistribute={onDistribute}
        />
      ) : null}

      {isMobileViewport ? (
        <ActionOverflowSheet
          isOpen={isOverflowOpen}
          selectedNodeCount={selectedNodeCount}
          onClose={() => setIsOverflowOpen(false)}
          onDelete={onDelete}
          onDuplicateSelection={onDuplicateSelection}
          onRenameSelection={onRenameSelection}
          onToggleQuickAttribute={onToggleQuickAttribute}
          isQuickAttributePinned={isQuickAttributePinned}
          onAlignLeft={onAlignLeft}
          onAlignCenter={onAlignCenter}
          onAlignRight={onAlignRight}
          onDistribute={onDistribute}
        />
      ) : null}

      <DevEnvBadge />
    </>
  );
};

export default FloatingContextBar;
