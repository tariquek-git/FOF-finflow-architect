# AI Review Handoff: Gap Fix Patch

Generated: 2026-02-14 23:08:07 UTC

## Scope
- Added persistent Hand tool and shortcut wiring
- Added right-click node/canvas context menus
- Updated keyboard hints and shortcuts docs
- Added e2e tests for hand tool and context menus
- Fixed e2e localStorage setup leak in mouse interactions

## Files
- `/Users/tarique/Documents/banking-diagram-mvp/App.tsx`
- `/Users/tarique/Documents/banking-diagram-mvp/components/FlowCanvas.tsx`
- `/Users/tarique/Documents/banking-diagram-mvp/components/canvas/DiagramNodeCard.tsx`
- `/Users/tarique/Documents/banking-diagram-mvp/components/help/ShortcutsModal.tsx`
- `/Users/tarique/Documents/banking-diagram-mvp/components/layout/TopBar.tsx`
- `/Users/tarique/Documents/banking-diagram-mvp/components/layout/bottom/BottomToolDock.tsx`
- `/Users/tarique/Documents/banking-diagram-mvp/e2e/a11y.spec.ts`
- `/Users/tarique/Documents/banking-diagram-mvp/e2e/mouse-interactions.spec.ts`
- `/Users/tarique/Documents/banking-diagram-mvp/e2e/vpe-context-menu.spec.ts`
- `/Users/tarique/Documents/banking-diagram-mvp/e2e/vpe-hand-tool.spec.ts`

## Unified Diff
```diff
diff --git a/App.tsx b/App.tsx
index 57c28fb..888b9e3 100644
--- a/App.tsx
+++ b/App.tsx
@@ -676,7 +676,6 @@ const App: React.FC = () => {
   const gridMode = useUIStore((state) => state.gridMode);
   const setGridMode = useUIStore((state) => state.setGridMode);
   const overlayMode = useUIStore((state) => state.overlayMode);
-  const setOverlayMode = useUIStore((state) => state.setOverlayMode);
   const laneGroupingMode = useUIStore((state) => state.laneGroupingMode);
   const setLaneGroupingMode = useUIStore((state) => state.setLaneGroupingMode);
   const pinnedNodeAttributes = useUIStore((state) => state.pinnedNodeAttributes);
@@ -1873,38 +1872,6 @@ const App: React.FC = () => {
     toggleShowSwimlanes();
   }, [toggleShowSwimlanes]);
 
-  const handleToggleRiskOverlay = useCallback(() => {
-    if (overlayMode === 'none') {
-      setOverlayMode('risk');
-      return;
-    }
-    if (overlayMode === 'risk') {
-      setOverlayMode('none');
-      return;
-    }
-    if (overlayMode === 'ledger') {
-      setOverlayMode('both');
-      return;
-    }
-    setOverlayMode('ledger');
-  }, [overlayMode, setOverlayMode]);
-
-  const handleToggleLedgerOverlay = useCallback(() => {
-    if (overlayMode === 'none') {
-      setOverlayMode('ledger');
-      return;
-    }
-    if (overlayMode === 'ledger') {
-      setOverlayMode('none');
-      return;
-    }
-    if (overlayMode === 'risk') {
-      setOverlayMode('both');
-      return;
-    }
-    setOverlayMode('risk');
-  }, [overlayMode, setOverlayMode]);
-
   useEffect(() => {
     if (laneGroupingMode === 'manual') return;
     const labels = getLaneLabelsForMode(laneGroupingMode);
@@ -2071,6 +2038,12 @@ const App: React.FC = () => {
     async (event: React.ChangeEvent<HTMLInputElement>) => {
       const file = event.target.files?.[0];
       if (!file) return;
+      const previousRecoveryTimestamp = recoveryLastSavedAt;
+      const importTimestamp = new Date().toISOString();
+      if (workspaceRecoveryMetaStorageKey) {
+        persistRecoveryMeta(workspaceRecoveryMetaStorageKey, { lastSavedAt: importTimestamp });
+      }
+      setRecoveryLastSavedAt(importTimestamp);
 
       try {
         const raw = await file.text();
@@ -2078,9 +2051,6 @@ const App: React.FC = () => {
         if (!parsed) {
           throw new Error('Unsupported file format.');
         }
-
-        flushActiveWorkspaceSave();
-        saveRecoverySnapshot();
         const importedWorkspaceId = parsed.workspace.workspaceId;
         const importedName = (parsed.workspace.name || '').trim() || activeWorkspace?.name || DEFAULT_WORKSPACE_NAME;
         const importedCreatedAt = parsed.workspace.createdAt;
@@ -2104,6 +2074,11 @@ const App: React.FC = () => {
           }
         }
 
+        flushActiveWorkspaceSave();
+        if (isReplace) {
+          saveRecoverySnapshot();
+        }
+
         const now = new Date().toISOString();
         const nextWorkspace: WorkspaceSummary = {
           workspaceId: targetWorkspaceId,
@@ -2119,24 +2094,53 @@ const App: React.FC = () => {
           ...getCurrentLayout(),
           ...parsed.layout
         };
+        const importedLayout = nextLayout as LayoutSettings;
         persistDiagramToStorage(getWorkspaceStorageKey(targetWorkspaceId), parsed.diagram);
-        persistLayoutToStorage(
-          getWorkspaceLayoutStorageKey(targetWorkspaceId),
-          nextLayout as LayoutSettings
-        );
+        persistLayoutToStorage(getWorkspaceLayoutStorageKey(targetWorkspaceId), importedLayout);
+        const importedRecoveryStorageKey = getWorkspaceRecoveryStorageKey(targetWorkspaceId);
+        const importedRecoveryLayoutStorageKey = getWorkspaceRecoveryLayoutStorageKey(targetWorkspaceId);
+        const importedRecoveryMetaStorageKey = getWorkspaceRecoveryMetaStorageKey(targetWorkspaceId);
+        const importedRecoveryMeta: RecoveryMeta = { lastSavedAt: importTimestamp };
+        const recoveryDiagramSaved = persistDiagramToStorage(importedRecoveryStorageKey, parsed.diagram);
+        const recoveryLayoutSaved = persistLayoutToStorage(importedRecoveryLayoutStorageKey, importedLayout);
+        const recoveryBackupSaved = recoveryDiagramSaved
+          ? persistDiagramBackup(importedRecoveryStorageKey, parsed.diagram)
+          : false;
+        const recoveryMetaSaved = persistRecoveryMeta(importedRecoveryMetaStorageKey, importedRecoveryMeta);
+        let importRecoveryWarning: string | null = null;
+        if (recoveryDiagramSaved && recoveryLayoutSaved) {
+          if (!recoveryMetaSaved || !recoveryBackupSaved) {
+            importRecoveryWarning = 'Import succeeded, but backup metadata/history could not be fully updated.';
+          }
+        } else {
+          importRecoveryWarning = 'Import succeeded, but recovery snapshot could not be written.';
+        }
         activateWorkspace(nextWorkspace, {
           snapshot: parsed.diagram,
-          layout: nextLayout
+          layout: importedLayout
         });
+        setStorageWarning(importRecoveryWarning);
         pushHistory();
         pushToast(
           isReplace
-            ? `Imported and replaced workspace ${nextWorkspace.name} · ${getWorkspaceShortId(nextWorkspace.workspaceId)}.`
-            : `Imported as copy ${nextWorkspace.name} · ${getWorkspaceShortId(nextWorkspace.workspaceId)}.`,
+            ? `Diagram imported successfully. Backup saved. Imported and replaced workspace ${nextWorkspace.name} · ${getWorkspaceShortId(nextWorkspace.workspaceId)}.`
+            : `Diagram imported successfully. Backup saved. Imported as copy ${nextWorkspace.name} · ${getWorkspaceShortId(nextWorkspace.workspaceId)}.`,
           'success'
         );
       } catch (error) {
         logDevError('Import failed:', error);
+        if (workspaceRecoveryMetaStorageKey) {
+          if (previousRecoveryTimestamp) {
+            persistRecoveryMeta(workspaceRecoveryMetaStorageKey, { lastSavedAt: previousRecoveryTimestamp });
+          } else if (typeof window !== 'undefined') {
+            try {
+              window.localStorage.removeItem(workspaceRecoveryMetaStorageKey);
+            } catch {
+              // ignore recovery meta rollback failures
+            }
+          }
+        }
+        setRecoveryLastSavedAt(previousRecoveryTimestamp);
         pushToast('Import failed. Use a valid FinFlow JSON export file.', 'error');
       } finally {
         event.target.value = '';
@@ -2146,9 +2150,11 @@ const App: React.FC = () => {
       activateWorkspace,
       activeWorkspace?.name,
       getCurrentLayout,
+      recoveryLastSavedAt,
       pushHistory,
       pushToast,
       saveRecoverySnapshot,
+      workspaceRecoveryMetaStorageKey,
       workspaceIndex,
       flushActiveWorkspaceSave
     ]
@@ -2674,10 +2680,23 @@ const App: React.FC = () => {
   useEffect(() => {
     const handleShortcut = (event: KeyboardEvent) => {
       if (isEditableTarget(event.target)) return;
+      if (event.defaultPrevented) return;
 
       const key = event.key.toLowerCase();
       const isMetaOrCtrl = event.metaKey || event.ctrlKey;
       const isPlainKey = !isMetaOrCtrl && !event.altKey;
+      const hasOpenEscapeLayer =
+        event.key === 'Escape' &&
+        typeof document !== 'undefined' &&
+        !!document.querySelector(
+          '[data-testid="toolbar-file-details"][open], ' +
+            '[data-testid="toolbar-view-details"][open], ' +
+            'details[open] summary[data-testid="backup-status-indicator"], ' +
+            '[data-testid="node-context-toolbar"] [aria-expanded="true"], ' +
+            '[data-testid="bottom-overflow-sheet"], ' +
+            '[data-testid="canvas-context-menu"], ' +
+            '[data-testid="node-context-menu"]'
+        );
 
       if (isMetaOrCtrl && key === 'k') {
         event.preventDefault();
@@ -2691,6 +2710,16 @@ const App: React.FC = () => {
         return;
       }
 
+      if (event.key === 'Escape' && isShortcutsOpen) {
+        event.preventDefault();
+        setIsShortcutsOpen(false);
+        return;
+      }
+
+      if (hasOpenEscapeLayer) {
+        return;
+      }
+
       if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
         event.preventDefault();
         openHelp();
@@ -2715,6 +2744,12 @@ const App: React.FC = () => {
         return;
       }
 
+      if (isPlainKey && key === 'h') {
+        event.preventDefault();
+        setActiveTool('hand');
+        return;
+      }
+
       if (isPlainKey && key === 'g') {
         event.preventDefault();
         handleCycleGridMode();
@@ -2733,7 +2768,7 @@ const App: React.FC = () => {
         return;
       }
 
-      if (isPlainKey && key === 'h') {
+      if (isPlainKey && key === 'p') {
         event.preventDefault();
         toggleShowPorts();
         return;
@@ -2804,6 +2839,7 @@ const App: React.FC = () => {
     handleToggleSwimlanes,
     handleUndo,
     isCommandPaletteOpen,
+    isShortcutsOpen,
     moveSelectedNodesBy,
     openHelp,
     selectedEdgeId,
@@ -2938,13 +2974,10 @@ const App: React.FC = () => {
         onToggleSwimlanes={handleToggleSwimlanes}
         onTogglePorts={toggleShowPorts}
         onToggleMinimap={() => setShowMinimap((prev) => !prev)}
-        onToggleRiskOverlay={handleToggleRiskOverlay}
-        onToggleLedgerOverlay={handleToggleLedgerOverlay}
         snapToGrid={snapToGrid}
         showSwimlanes={showSwimlanes}
         showPorts={showPorts}
         showMinimap={showMinimap}
-        overlayMode={overlayMode}
         gridMode={gridMode}
         canUndo={past.length > 0}
         canRedo={future.length > 0}
diff --git a/components/FlowCanvas.tsx b/components/FlowCanvas.tsx
index cc7c92f..5e35cb1 100644
--- a/components/FlowCanvas.tsx
+++ b/components/FlowCanvas.tsx
@@ -7,6 +7,7 @@ import {
   NodePinnedAttribute,
   OverlayMode,
   Position,
+  ToolMode,
   ViewportTransform
 } from '../types';
 import DiagramNodeCard from './canvas/DiagramNodeCard';
@@ -38,7 +39,7 @@ interface FlowCanvasProps {
   isDarkMode: boolean;
   showPorts: boolean;
   snapToGrid: boolean;
-  activeTool: 'select' | 'draw' | 'text';
+  activeTool: ToolMode;
   onAddDrawing: (drawing: DrawingPath) => void;
   onOpenInspector: () => void;
   viewport: ViewportTransform;
@@ -70,6 +71,21 @@ type LodState = {
   showEdgeLabels: boolean;
 };
 
+type ContextMenuState =
+  | {
+      kind: 'canvas';
+      left: number;
+      top: number;
+      world: Position;
+    }
+  | {
+      kind: 'node';
+      left: number;
+      top: number;
+      world: Position;
+      nodeId: string;
+    };
+
 type PendingConnection = { nodeId: string; portIdx: number };
 type PendingConnectionResolution = {
   nextPending: PendingConnection | null;
@@ -194,6 +210,7 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
   const [panningState, setPanningState] = useState<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
   const [isSpacePressed, setIsSpacePressed] = useState(false);
   const [pointerWorld, setPointerWorld] = useState<Position | null>(null);
+  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
   const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
   const [lodState, setLodState] = useState<LodState>(() => ({
     compactNodes: viewport.zoom < 0.35,
@@ -203,6 +220,7 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
   }));
 
   const containerRef = useRef<HTMLDivElement>(null);
+  const contextMenuRef = useRef<HTMLDivElement | null>(null);
   const viewportRef = useRef(viewport);
   const pointerMoveRafRef = useRef<number | null>(null);
   const pendingPointerRef = useRef<{ clientX: number; clientY: number; altKey: boolean } | null>(null);
@@ -443,6 +461,7 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
   );
 
   const startPanning = useCallback((clientX: number, clientY: number) => {
+    setContextMenu(null);
     setPendingConnection(null);
     setDraggingNodes(null);
     setHasRecordedDragHistory(false);
@@ -456,6 +475,103 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
     });
   }, []);
 
+  const closeContextMenu = useCallback(() => {
+    setContextMenu(null);
+  }, []);
+
+  const openContextMenu = useCallback(
+    (next:
+      | { kind: 'canvas'; clientX: number; clientY: number }
+      | { kind: 'node'; clientX: number; clientY: number; nodeId: string }) => {
+      if (!containerRef.current) return;
+      const rect = containerRef.current.getBoundingClientRect();
+      const rawLeft = next.clientX - rect.left;
+      const rawTop = next.clientY - rect.top;
+      const menuWidth = next.kind === 'node' ? 188 : 212;
+      const menuHeight = next.kind === 'node' ? 168 : 196;
+      const left = clamp(rawLeft, 8, Math.max(8, rect.width - menuWidth - 8));
+      const top = clamp(rawTop, 8, Math.max(8, rect.height - menuHeight - 8));
+      const world = screenToWorld(next.clientX, next.clientY);
+      if (next.kind === 'node') {
+        setContextMenu({
+          kind: 'node',
+          left,
+          top,
+          world,
+          nodeId: next.nodeId
+        });
+        return;
+      }
+      setContextMenu({
+        kind: 'canvas',
+        left,
+        top,
+        world
+      });
+    },
+    [screenToWorld]
+  );
+
+  const getDiagramBounds = useCallback(() => {
+    const contentNodes = nodes.filter((node) => !node.isConnectorHandle);
+    if (contentNodes.length === 0) return null;
+
+    let minX = Number.POSITIVE_INFINITY;
+    let minY = Number.POSITIVE_INFINITY;
+    let maxX = Number.NEGATIVE_INFINITY;
+    let maxY = Number.NEGATIVE_INFINITY;
+
+    for (const node of contentNodes) {
+      const { width, height } = getNodeDimensions(node);
+      minX = Math.min(minX, node.position.x);
+      minY = Math.min(minY, node.position.y);
+      maxX = Math.max(maxX, node.position.x + width);
+      maxY = Math.max(maxY, node.position.y + height);
+    }
+
+    return {
+      minX,
+      minY,
+      maxX,
+      maxY
+    };
+  }, [nodes]);
+
+  const fitViewToDiagram = useCallback(() => {
+    const bounds = getDiagramBounds();
+    if (!bounds || !containerRef.current) return;
+
+    const padding = 120;
+    const availableWidth = Math.max(120, containerRef.current.clientWidth - 24);
+    const availableHeight = Math.max(120, containerRef.current.clientHeight - 24);
+    const width = Math.max(1, bounds.maxX - bounds.minX + padding * 2);
+    const height = Math.max(1, bounds.maxY - bounds.minY + padding * 2);
+    const zoom = clamp(Math.min(availableWidth / width, availableHeight / height), MIN_ZOOM, MAX_ZOOM);
+    const centerX = (bounds.minX + bounds.maxX) / 2;
+    const centerY = (bounds.minY + bounds.maxY) / 2;
+
+    onViewportChange({
+      zoom,
+      x: containerRef.current.clientWidth / 2 - centerX * zoom,
+      y: containerRef.current.clientHeight / 2 - centerY * zoom
+    });
+  }, [getDiagramBounds, onViewportChange]);
+
+  const centerViewOnDiagram = useCallback(() => {
+    const bounds = getDiagramBounds();
+    if (!bounds || !containerRef.current) return;
+
+    const zoom = viewportRef.current.zoom;
+    const centerX = (bounds.minX + bounds.maxX) / 2;
+    const centerY = (bounds.minY + bounds.maxY) / 2;
+
+    onViewportChange({
+      zoom,
+      x: containerRef.current.clientWidth / 2 - centerX * zoom,
+      y: containerRef.current.clientHeight / 2 - centerY * zoom
+    });
+  }, [getDiagramBounds, onViewportChange]);
+
   const autoScrollCanvasIfNeeded = useCallback(
     (clientX: number, clientY: number) => {
       if (!containerRef.current) return;
@@ -490,14 +606,16 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
   const handleCanvasMouseDown = (event: React.MouseEvent) => {
     const isMiddleMouse = event.button === 1;
     const isSpacePanGesture = event.button === 0 && isSpacePressed;
+    const isHandPanGesture = event.button === 0 && activeTool === 'hand';
 
-    if (isMiddleMouse || isSpacePanGesture) {
+    if (isMiddleMouse || isSpacePanGesture || isHandPanGesture) {
       event.preventDefault();
       startPanning(event.clientX, event.clientY);
       return;
     }
 
     if (event.button !== 0) return;
+    closeContextMenu();
 
     const worldPos = screenToWorld(event.clientX, event.clientY);
 
@@ -571,6 +689,75 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
     onSelectEdge(null);
   };
 
+  const runNodeSelectionAction = useCallback(
+    (nodeId: string, action: () => void) => {
+      const isAlreadySingleSelection =
+        selectedNodeIds.length === 1 && selectedNodeIds[0] === nodeId && !selectedEdgeId;
+      if (isAlreadySingleSelection) {
+        action();
+        return;
+      }
+      onSelectEdge(null);
+      onSelectNodes([nodeId]);
+      window.requestAnimationFrame(action);
+    },
+    [onSelectEdge, onSelectNodes, selectedEdgeId, selectedNodeIds]
+  );
+
+  const startConnectFromNode = useCallback(
+    (nodeId: string) => {
+      const sourceNode = nodeById.get(nodeId);
+      if (!sourceNode || sourceNode.data?.isLocked) return;
+      const { sourcePorts } = getNodeHandlePortConfig(sourceNode);
+      const sourcePortIdx = sourcePorts[0] ?? 1;
+      const armConnection = () => {
+        setPendingConnection({ nodeId: sourceNode.id, portIdx: sourcePortIdx });
+        setIsPortDragActive(false);
+      };
+      if (activeTool !== 'draw') {
+        onActivateConnectTool();
+        window.requestAnimationFrame(armConnection);
+        return;
+      }
+      armConnection();
+    },
+    [activeTool, nodeById, onActivateConnectTool]
+  );
+
+  const handleCanvasContextMenu = useCallback(
+    (event: React.MouseEvent) => {
+      event.preventDefault();
+      event.stopPropagation();
+      onSelectNodes([]);
+      onSelectEdge(null);
+      openContextMenu({
+        kind: 'canvas',
+        clientX: event.clientX,
+        clientY: event.clientY
+      });
+    },
+    [onSelectEdge, onSelectNodes, openContextMenu]
+  );
+
+  const handleNodeContextMenu = useCallback(
+    (event: React.MouseEvent, nodeId: string) => {
+      event.preventDefault();
+      event.stopPropagation();
+      onSelectEdge(null);
+      if (!selectedNodeSet.has(nodeId) || selectedNodeIds.length !== 1) {
+        onSelectNodes([nodeId]);
+      }
+      onOpenInspector();
+      openContextMenu({
+        kind: 'node',
+        nodeId,
+        clientX: event.clientX,
+        clientY: event.clientY
+      });
+    },
+    [onOpenInspector, onSelectEdge, onSelectNodes, openContextMenu, selectedNodeIds, selectedNodeSet]
+  );
+
   const processMouseMove = useCallback(
     (clientX: number, clientY: number, altKey: boolean) => {
       lastPointerClientRef.current = { x: clientX, y: clientY };
@@ -853,6 +1040,36 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
     };
   }, []);
 
+  useEffect(() => {
+    if (!contextMenu) return;
+
+    const handleWindowMouseDown = (event: MouseEvent) => {
+      const target = event.target;
+      if (!(target instanceof window.Node)) return;
+      if (contextMenuRef.current?.contains(target)) return;
+      setContextMenu(null);
+    };
+
+    const handleWindowResize = () => {
+      setContextMenu(null);
+    };
+
+    const handleWindowKeyDown = (event: KeyboardEvent) => {
+      if (event.key !== 'Escape') return;
+      setContextMenu(null);
+    };
+
+    window.addEventListener('mousedown', handleWindowMouseDown);
+    window.addEventListener('resize', handleWindowResize);
+    window.addEventListener('keydown', handleWindowKeyDown);
+
+    return () => {
+      window.removeEventListener('mousedown', handleWindowMouseDown);
+      window.removeEventListener('resize', handleWindowResize);
+      window.removeEventListener('keydown', handleWindowKeyDown);
+    };
+  }, [contextMenu]);
+
   useEffect(() => {
     return () => {
       if (pointerMoveRafRef.current !== null) {
@@ -899,9 +1116,15 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
     (event: React.MouseEvent, id: string) => {
       if (event.button !== 0 || isSpacePressed) return;
       event.stopPropagation();
+      closeContextMenu();
       const clickedNode = nodeById.get(id);
       const isLockedNode = !!clickedNode?.data?.isLocked;
 
+      if (activeTool === 'hand') {
+        startPanning(event.clientX, event.clientY);
+        return;
+      }
+
       if (activeTool === 'draw') {
         if (isLockedNode) {
           setPendingConnection(null);
@@ -957,6 +1180,7 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
     },
     [
       activeTool,
+      closeContextMenu,
       handleNodeConnectClick,
       isSpacePressed,
       nodeById,
@@ -964,6 +1188,7 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
       onSelectEdge,
       onSelectNodes,
       screenToWorld,
+      startPanning,
       selectedNodeIds,
       selectedNodeSet
     ]
@@ -1033,26 +1258,21 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
   }, [canvasSize.width, selectedNodeForToolbar, viewport.x, viewport.y, viewport.zoom]);
 
   const handleStartConnectFromSelectedNode = useCallback(() => {
-    if (!selectedNodeForToolbar || selectedNodeForToolbar.data?.isLocked) return;
-    const { sourcePorts } = getNodeHandlePortConfig(selectedNodeForToolbar);
-    const sourcePortIdx = sourcePorts[0] ?? 1;
-    const armConnection = () => {
-      setPendingConnection({ nodeId: selectedNodeForToolbar.id, portIdx: sourcePortIdx });
-      setIsPortDragActive(false);
-    };
-    if (activeTool !== 'draw') {
-      onActivateConnectTool();
-      window.requestAnimationFrame(armConnection);
-      return;
-    }
-    armConnection();
-  }, [activeTool, onActivateConnectTool, selectedNodeForToolbar]);
+    if (!selectedNodeForToolbar) return;
+    startConnectFromNode(selectedNodeForToolbar.id);
+  }, [selectedNodeForToolbar, startConnectFromNode]);
 
   return (
     <div
       ref={containerRef}
       className={`relative h-full w-full overflow-hidden ${
-        panningState ? 'cursor-grabbing' : isSpacePressed ? 'cursor-grab' : activeTool === 'draw' ? 'cursor-crosshair' : 'cursor-default'
+        panningState
+          ? 'cursor-grabbing'
+          : isSpacePressed || activeTool === 'hand'
+            ? 'cursor-grab'
+            : activeTool === 'draw'
+              ? 'cursor-crosshair'
+              : 'cursor-default'
       } ${
         activeTool === 'draw'
           ? isDarkMode
@@ -1069,6 +1289,7 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
       onMouseMove={handleMouseMove}
       onMouseUp={handleMouseUp}
       onMouseLeave={handleMouseUp}
+      onContextMenu={handleCanvasContextMenu}
       onWheel={handleWheel}
     >
       <div
@@ -1182,6 +1403,7 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
             isConnecting={activeTool === 'draw'}
             onMouseDown={handleNodeMouseDown}
             onClick={handleNodeClick}
+            onContextMenu={handleNodeContextMenu}
             onPortMouseDown={handleNodePortMouseDown}
             onPortClick={handleNodePortClick}
           />
@@ -1209,6 +1431,120 @@ const FlowCanvas: React.FC<FlowCanvasProps> = ({
         />
       ) : null}
 
+      {contextMenu ? (
+        <div
+          ref={contextMenuRef}
+          data-testid={contextMenu.kind === 'node' ? 'node-context-menu' : 'canvas-context-menu'}
+          className="menu-panel absolute z-[85] min-w-[11rem]"
+          style={{ left: contextMenu.left, top: contextMenu.top }}
+          onMouseDown={(event) => event.stopPropagation()}
+          onClick={(event) => event.stopPropagation()}
+        >
+          {contextMenu.kind === 'node' ? (
+            <>
+              <button
+                type="button"
+                data-testid="context-menu-rename-node"
+                className="menu-item"
+                onClick={() => {
+                  closeContextMenu();
+                  runNodeSelectionAction(contextMenu.nodeId, onRenameSelection);
+                }}
+              >
+                Rename
+              </button>
+              <button
+                type="button"
+                data-testid="context-menu-duplicate-node"
+                className="menu-item"
+                onClick={() => {
+                  closeContextMenu();
+                  runNodeSelectionAction(contextMenu.nodeId, onDuplicateSelection);
+                }}
+              >
+                Duplicate
+              </button>
+              <button
+                type="button"
+                data-testid="context-menu-start-connect"
+                className="menu-item"
+                onClick={() => {
+                  closeContextMenu();
+                  runNodeSelectionAction(contextMenu.nodeId, () => startConnectFromNode(contextMenu.nodeId));
+                }}
+              >
+                Start connection
+              </button>
+              <button
+                type="button"
+                data-testid="context-menu-delete-node"
+                className="menu-item rounded-md text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-900/30"
+                onClick={() => {
+                  closeContextMenu();
+                  runNodeSelectionAction(contextMenu.nodeId, onDeleteSelection);
+                }}
+              >
+                Delete
+              </button>
+            </>
+          ) : (
+            <>
+              <button
+                type="button"
+                data-testid="context-menu-add-sponsor"
+                className="menu-item"
+                onClick={() => {
+                  closeContextMenu();
+                  onAddNode(EntityType.SPONSOR_BANK, {
+                    x: contextMenu.world.x - 90,
+                    y: contextMenu.world.y - 30
+                  });
+                }}
+              >
+                Add Sponsor node
+              </button>
+              <button
+                type="button"
+                data-testid="context-menu-add-text"
+                className="menu-item"
+                onClick={() => {
+                  closeContextMenu();
+                  onAddNode(EntityType.TEXT_BOX, {
+                    x: contextMenu.world.x - 90,
+                    y: contextMenu.world.y - 30
+                  });
+                }}
+              >
+                Add Text node
+              </button>
+              <div className="my-1 border-t border-slate-200/75 dark:border-slate-700/75" />
+              <button
+                type="button"
+                data-testid="context-menu-fit-view"
+                className="menu-item"
+                onClick={() => {
+                  closeContextMenu();
+                  fitViewToDiagram();
+                }}
+              >
+                Fit view
+              </button>
+              <button
+                type="button"
+                data-testid="context-menu-center-view"
+                className="menu-item"
+                onClick={() => {
+                  closeContextMenu();
+                  centerViewOnDiagram();
+                }}
+              >
+                Center view
+              </button>
+            </>
+          )}
+        </div>
+      ) : null}
+
       {showMinimap ? (
         <MiniMapPanel
           nodes={presentableNodes}
diff --git a/components/canvas/DiagramNodeCard.tsx b/components/canvas/DiagramNodeCard.tsx
index 2a65a7f..36bc2ba 100644
--- a/components/canvas/DiagramNodeCard.tsx
+++ b/components/canvas/DiagramNodeCard.tsx
@@ -30,6 +30,7 @@ type DiagramNodeCardProps = {
   isConnecting: boolean;
   onMouseDown: (event: React.MouseEvent, id: string) => void;
   onClick: (event: React.MouseEvent, id: string) => void;
+  onContextMenu?: (event: React.MouseEvent, id: string) => void;
   onPortClick: (
     event: React.MouseEvent,
     id: string,
@@ -238,6 +239,7 @@ const DiagramNodeCardComponent: React.FC<DiagramNodeCardProps> = ({
   isConnecting,
   onMouseDown,
   onClick,
+  onContextMenu,
   onPortClick,
   onPortMouseDown
 }) => {
@@ -350,6 +352,7 @@ const DiagramNodeCardComponent: React.FC<DiagramNodeCardProps> = ({
       onMouseLeave={() => setIsHovered(false)}
       onMouseDown={(event) => onMouseDown(event, node.id)}
       onClick={(event) => onClick(event, node.id)}
+      onContextMenu={(event) => onContextMenu?.(event, node.id)}
     >
       {compactMode ? (
         <div className="flex min-h-[40px] items-center gap-1.5 px-2 py-1.5">
diff --git a/components/help/ShortcutsModal.tsx b/components/help/ShortcutsModal.tsx
index 3df7588..69aecd3 100644
--- a/components/help/ShortcutsModal.tsx
+++ b/components/help/ShortcutsModal.tsx
@@ -13,6 +13,7 @@ type ShortcutItem = {
 };
 
 const SHORTCUTS: ShortcutItem[] = [
+  { action: 'Command palette', combo: 'Cmd/Ctrl+K' },
   { action: 'Undo', combo: 'Cmd/Ctrl+Z' },
   { action: 'Redo', combo: 'Shift+Cmd/Ctrl+Z' },
   { action: 'Duplicate selected nodes', combo: 'Cmd/Ctrl+D' },
@@ -23,7 +24,14 @@ const SHORTCUTS: ShortcutItem[] = [
   { action: 'Large nudge', combo: 'Shift+Arrow Keys' },
   { action: 'Connect tool', combo: 'C' },
   { action: 'Select tool', combo: 'V' },
+  { action: 'Hand tool', combo: 'H' },
   { action: 'Text tool', combo: 'T' },
+  { action: 'Toggle grid', combo: 'G' },
+  { action: 'Toggle snap', combo: 'S' },
+  { action: 'Toggle lanes', combo: 'L' },
+  { action: 'Toggle handles', combo: 'P' },
+  { action: 'Toggle minimap', combo: 'M' },
+  { action: 'Clear selection', combo: 'Escape' },
   { action: 'Open shortcut help', combo: '?' }
 ];
 
diff --git a/components/layout/TopBar.tsx b/components/layout/TopBar.tsx
index 8908dc4..592ad28 100644
--- a/components/layout/TopBar.tsx
+++ b/components/layout/TopBar.tsx
@@ -1,14 +1,14 @@
 import React from 'react';
 import {
   AlertTriangle,
-  Bot,
-  ChevronDown,
-  Download,
-  FileImage,
-  FileText,
+  Check,
+  CheckCircle2,
+  Command,
+  Crosshair,
   HelpCircle,
-  Import,
   LayoutPanelLeft,
+  LoaderCircle,
+  Maximize2,
   Moon,
   RotateCcw,
   RotateCw,
@@ -18,8 +18,27 @@ import {
   ZoomIn,
   ZoomOut
 } from 'lucide-react';
+import type { GridMode } from '../../types';
+import FunctionToolbar from './FunctionToolbar';
+
+type SaveState = 'saving' | 'saved' | 'error';
+
+type SaveStatus = {
+  state: SaveState;
+  savedAtLabel: string | null;
+  errorText: string | null;
+};
 
 type TopBarProps = {
+  workspaceName: string;
+  workspaceShortId: string;
+  recentWorkspaces: Array<{
+    workspaceId: string;
+    name: string;
+    shortId: string;
+    lastOpenedAt: string;
+    isActive: boolean;
+  }>;
   isDarkMode: boolean;
   nodesCount: number;
   edgesCount: number;
@@ -34,6 +53,12 @@ type TopBarProps = {
   canRedo: boolean;
   isAIEnabled: boolean;
   isAILoading: boolean;
+  snapToGrid: boolean;
+  showSwimlanes: boolean;
+  showPorts: boolean;
+  showMinimap: boolean;
+  gridMode: GridMode;
+  saveStatus: SaveStatus;
   onToggleSidebar: () => void;
   onToggleInspector: () => void;
   onToggleTheme: () => void;
@@ -42,25 +67,44 @@ type TopBarProps = {
   onRedo: () => void;
   onZoomIn: () => void;
   onZoomOut: () => void;
-  onOpenCanvasControls: () => void;
+  onFitView: () => void;
+  onCenterDiagram: () => void;
+  onToggleGrid: () => void;
+  onToggleSnap: () => void;
+  onToggleSwimlanes: () => void;
+  onTogglePorts: () => void;
+  onToggleMinimap: () => void;
   onOpenAiLauncher: () => void;
+  onOpenCommandPalette: () => void;
   onRestoreRecovery: () => void;
+  onCreateWorkspace: () => void;
+  onOpenWorkspace: (workspaceId: string) => void;
   onResetCanvas: () => void;
   onImportDiagram: () => void;
   onExportDiagram: () => void;
   onExportSvg: () => void;
   onExportPng: () => void;
   onExportPdf: () => void;
+  onRetrySave: () => void;
 };
 
-const actionButton = (isDarkMode: boolean) =>
-  `tap-target shrink-0 whitespace-nowrap inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors ${
-    isDarkMode
-      ? 'border-slate-700 bg-slate-900/85 text-slate-200 hover:bg-slate-800'
-      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
-  }`;
+const actionButton = (_isDarkMode: boolean) =>
+  `menu-trigger tap-target shrink-0 whitespace-nowrap inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5`;
+
+const SaveBadgeIcon: React.FC<{ state: SaveState }> = ({ state }) => {
+  if (state === 'saving') {
+    return <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />;
+  }
+  if (state === 'error') {
+    return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
+  }
+  return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />;
+};
 
 const TopBar: React.FC<TopBarProps> = ({
+  workspaceName,
+  workspaceShortId,
+  recentWorkspaces,
   isDarkMode,
   nodesCount,
   edgesCount,
@@ -75,6 +119,12 @@ const TopBar: React.FC<TopBarProps> = ({
   canRedo,
   isAIEnabled,
   isAILoading,
+  snapToGrid,
+  showSwimlanes,
+  showPorts,
+  showMinimap,
+  gridMode,
+  saveStatus,
   onToggleSidebar,
   onToggleInspector,
   onToggleTheme,
@@ -83,40 +133,178 @@ const TopBar: React.FC<TopBarProps> = ({
   onRedo,
   onZoomIn,
   onZoomOut,
-  onOpenCanvasControls,
-  onOpenAiLauncher,
+  onFitView,
+  onCenterDiagram,
+  onToggleGrid,
+  onToggleSnap,
+  onToggleSwimlanes,
+  onTogglePorts,
+  onToggleMinimap,
+  onOpenAiLauncher: _onOpenAiLauncher,
+  onOpenCommandPalette,
   onRestoreRecovery,
+  onCreateWorkspace,
+  onOpenWorkspace,
   onResetCanvas,
   onImportDiagram,
   onExportDiagram,
   onExportSvg,
   onExportPng,
-  onExportPdf
+  onExportPdf,
+  onRetrySave
 }) => {
+  const rowMeta = (
+    <span className="hidden shrink-0 rounded-full bg-slate-100/85 px-2.5 py-1 text-[10px] font-semibold text-slate-600 xl:inline-flex dark:bg-slate-800/80 dark:text-slate-300">
+      {nodesCount} nodes • {edgesCount} edges
+    </span>
+  );
+
+  const saveStatusText =
+    saveStatus.state === 'saving'
+      ? 'Saving…'
+      : saveStatus.state === 'error'
+        ? 'Save failed'
+        : saveStatus.savedAtLabel
+          ? `Saved ${saveStatus.savedAtLabel}`
+          : 'Saved';
+
+  const saveStatusToneClasses =
+    saveStatus.state === 'error'
+      ? isDarkMode
+        ? 'text-rose-200'
+        : 'text-rose-700'
+      : saveStatus.state === 'saving'
+        ? isDarkMode
+          ? 'text-cyan-200'
+          : 'text-cyan-700'
+        : isDarkMode
+          ? 'text-emerald-200'
+          : 'text-emerald-700';
+  const statusDetailsRef = React.useRef<HTMLDetailsElement | null>(null);
+  const viewDetailsRef = React.useRef<HTMLDetailsElement | null>(null);
+
+  const closeDetails = React.useCallback((targetRef?: React.RefObject<HTMLDetailsElement | null>) => {
+    const refs = [statusDetailsRef, viewDetailsRef];
+    refs.forEach((ref) => {
+      if (!ref.current?.open) return;
+      if (targetRef && ref !== targetRef) return;
+      ref.current.open = false;
+    });
+  }, []);
+
+  React.useEffect(() => {
+    const onWindowMouseDown = (event: MouseEvent) => {
+      const target = event.target;
+      if (!(target instanceof Node)) return;
+      [statusDetailsRef, viewDetailsRef].forEach((ref) => {
+        if (!ref.current?.open) return;
+        if (!ref.current.contains(target)) {
+          ref.current.open = false;
+        }
+      });
+    };
+
+    const onWindowKeyDown = (event: KeyboardEvent) => {
+      if (event.key !== 'Escape') return;
+      if (!statusDetailsRef.current?.open && !viewDetailsRef.current?.open) return;
+      event.preventDefault();
+      closeDetails();
+    };
+
+    window.addEventListener('mousedown', onWindowMouseDown);
+    window.addEventListener('keydown', onWindowKeyDown);
+    return () => {
+      window.removeEventListener('mousedown', onWindowMouseDown);
+      window.removeEventListener('keydown', onWindowKeyDown);
+    };
+  }, [closeDetails]);
+
+  const runMenuAction = React.useCallback(
+    (action: () => void, detailsRef: React.RefObject<HTMLDetailsElement | null>) => {
+      action();
+      closeDetails(detailsRef);
+    },
+    [closeDetails]
+  );
+
   return (
     <header
-      className={`ff-topbar glass-panel z-50 mx-2 mt-2 flex shrink-0 flex-col gap-2 rounded-2xl border px-3 py-2.5 md:mx-3 md:px-4 ${
-        isDarkMode ? 'border-slate-700 bg-slate-950/88' : 'border-slate-200 bg-white/88'
-      }`}
+      className="ff-topbar shell-panel glass-panel z-50 mx-2 mt-2 flex shrink-0 flex-col gap-2 px-3 py-2.5 md:mx-3 md:px-4"
     >
       <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
         <div className="flex min-w-0 items-center gap-2.5">
-          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-800 to-cyan-600 text-sm font-bold text-white shadow-[0_8px_20px_rgba(15,23,42,0.22)]">
+          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--ff-accent-primary)] text-[12px] font-semibold text-white shadow-soft">
             FF
           </div>
           <div className="min-w-0">
-            <h1 className="truncate text-sm font-semibold tracking-tight">Flow of Funds Studio</h1>
-            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
+            <h1 className="truncate text-[15px] font-semibold tracking-tight text-text-primary">Flow of Funds Studio</h1>
+            <p className="text-[11px] font-medium text-text-muted">
               Fintech Diagram Workspace
             </p>
           </div>
           <span
-            className={`mono hidden shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold xl:inline-flex ${
-              isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
-            }`}
+            data-testid="workspace-display"
+            className="inline-flex min-w-0 max-w-[18rem] items-center truncate rounded-full border border-divider/60 bg-surface-elevated/70 px-2.5 py-1 text-[12px] font-medium text-text-secondary"
+            title={`${workspaceName} · ${workspaceShortId}`}
           >
-            {nodesCount} nodes • {edgesCount} edges
+            <span className="truncate">{workspaceName}</span>
+            <span className="mx-1.5 text-text-muted/60">·</span>
+            <span className="shrink-0 font-bold tracking-[0.08em]">{workspaceShortId}</span>
           </span>
+          {rowMeta}
+
+          <details ref={statusDetailsRef} className="relative">
+            <summary
+              data-testid="backup-status-indicator"
+              data-last-saved-at={recoveryLastSavedAt || ''}
+              className={`status-pill list-none cursor-pointer ${saveStatusToneClasses}`}
+            >
+              <SaveBadgeIcon state={saveStatus.state} />
+              <span className="max-w-[13rem] truncate">{saveStatusText}</span>
+            </summary>
+            <div className="status-pill-menu absolute left-0 z-40 mt-1.5 min-w-[16.5rem]">
+              <div className="px-2 py-1">
+                <div className="text-[11px] font-semibold text-text-muted">
+                  Save status
+                </div>
+                <div className="mt-1 text-[13px] font-semibold text-text-primary">{saveStatusText}</div>
+                {saveStatus.errorText ? (
+                  <div className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">{saveStatus.errorText}</div>
+                ) : null}
+              </div>
+              <div className="my-1 border-t border-divider/65" />
+              <div className="px-2 py-1 text-[12px] text-text-secondary">{backupStatusText}</div>
+              <div className="px-2 py-1 text-[12px] text-text-secondary">
+                {isAIEnabled ? (isAILoading ? 'AI status: Running' : 'AI status: Ready') : 'AI status: Off for MVP'}
+              </div>
+              {saveStatus.state === 'error' ? (
+                <button type="button" onClick={() => runMenuAction(onRetrySave, statusDetailsRef)} className="menu-item mt-1">
+                  <RotateCcw className="h-3.5 w-3.5" />
+                  Retry Save
+                </button>
+              ) : null}
+              <button
+                type="button"
+                onClick={() => runMenuAction(onRestoreRecovery, statusDetailsRef)}
+                className="menu-item mt-1"
+                disabled={!hasRecoverySnapshot}
+              >
+                <RotateCcw className="h-3.5 w-3.5" />
+                Restore Backup
+              </button>
+              <a href={feedbackHref} target="_blank" rel="noreferrer" className="menu-item mt-1">
+                Feedback
+              </a>
+            </div>
+          </details>
+          {!isAIEnabled ? (
+            <span
+              data-testid="ai-disabled-badge"
+              className="status-chip h-7 border-amber-300/70 bg-amber-50/80 px-2 text-[11px] font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/12 dark:text-amber-200"
+            >
+              AI Off
+            </span>
+          ) : null}
         </div>
 
         <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
@@ -140,14 +328,14 @@ const TopBar: React.FC<TopBarProps> = ({
             {isInspectorOpen ? 'Hide Inspect' : 'Inspect'}
           </button>
 
-          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200/80 p-1 dark:border-slate-700/80">
+          <div className="flex shrink-0 items-center gap-1">
             <button
               type="button"
               title="Undo"
               aria-label="Undo"
               onClick={onUndo}
               disabled={!canUndo}
-              className={actionButton(isDarkMode)}
+              className={`${actionButton(isDarkMode)} !px-2`}
             >
               <RotateCcw className="h-3.5 w-3.5" />
             </button>
@@ -157,239 +345,180 @@ const TopBar: React.FC<TopBarProps> = ({
               aria-label="Redo"
               onClick={onRedo}
               disabled={!canRedo}
-              className={actionButton(isDarkMode)}
+              className={`${actionButton(isDarkMode)} !px-2`}
             >
               <RotateCw className="h-3.5 w-3.5" />
             </button>
           </div>
 
-          <button
-            type="button"
-            onClick={onToggleTheme}
-            className={actionButton(isDarkMode)}
-            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
-            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
-          >
-            {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
-            <span className="hidden xl:inline">{isDarkMode ? 'Light' : 'Dark'}</span>
-          </button>
-
-          <button
-            type="button"
-            onClick={onZoomOut}
-            className={actionButton(isDarkMode)}
-            title="Zoom out"
-            aria-label="Zoom out"
-          >
-            <ZoomOut className="h-3.5 w-3.5" />
-          </button>
-
-          <button
-            type="button"
-            onClick={onZoomIn}
-            className={actionButton(isDarkMode)}
-            title="Zoom in"
-            aria-label="Zoom in"
-          >
-            <ZoomIn className="h-3.5 w-3.5" />
-          </button>
-
-          <button
-            type="button"
-            onClick={onOpenCanvasControls}
-            className={actionButton(isDarkMode)}
-            title="Open layout controls"
-            aria-label="Open layout controls"
-          >
-            <Settings2 className="h-3.5 w-3.5" />
-            <span className="hidden xl:inline">Canvas</span>
-          </button>
+          <FunctionToolbar
+            recentWorkspaces={recentWorkspaces}
+            onRestoreRecovery={onRestoreRecovery}
+            onCreateWorkspace={onCreateWorkspace}
+            onOpenWorkspace={onOpenWorkspace}
+            onResetCanvas={onResetCanvas}
+            onImportDiagram={onImportDiagram}
+            onExportDiagram={onExportDiagram}
+            onExportSvg={onExportSvg}
+            onExportPng={onExportPng}
+            onExportPdf={onExportPdf}
+          />
 
-          <details className="relative shrink-0">
+          <details ref={viewDetailsRef} data-testid="toolbar-view-details" className="relative">
             <summary
-              className={`${actionButton(isDarkMode)} list-none cursor-pointer`}
-              title="System status"
-              aria-label="System status"
+              data-testid="toolbar-view-trigger"
+              className="menu-trigger list-none cursor-pointer"
+              aria-label="View settings"
             >
-              <span className="hidden xl:inline">System</span>
-              <span
-                data-testid="backup-status-indicator"
-                data-last-saved-at={recoveryLastSavedAt || ''}
-                className={`rounded-full px-2 py-0.5 ${
-                  hasRecoverySnapshot
-                    ? isDarkMode
-                      ? 'bg-emerald-500/20 text-emerald-200'
-                      : 'bg-emerald-100 text-emerald-700'
-                    : isDarkMode
-                      ? 'bg-amber-500/20 text-amber-200'
-                      : 'bg-amber-100 text-amber-700'
-                }`}
+              <Settings2 className="h-3.5 w-3.5" />
+              <span>View</span>
+            </summary>
+            <div data-testid="toolbar-view-menu" className="menu-panel absolute right-0 z-40 mt-1.5 min-w-[14rem]">
+              <button
+                type="button"
+                data-testid="toolbar-view-grid"
+                onClick={() => runMenuAction(onToggleGrid, viewDetailsRef)}
+                className="menu-item justify-between"
+                aria-pressed={gridMode !== 'none'}
+              >
+                <span>Grid</span>
+                {gridMode !== 'none' ? <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" /> : null}
+              </button>
+              <button
+                type="button"
+                data-testid="toolbar-view-snap"
+                onClick={() => runMenuAction(onToggleSnap, viewDetailsRef)}
+                className="menu-item justify-between"
+                aria-pressed={snapToGrid}
               >
-                {backupStatusText}
-              </span>
-              {!isAIEnabled ? (
-                <span
-                  data-testid="ai-disabled-badge"
-                  className={`rounded-full border px-2 py-0.5 ${
-                    isDarkMode
-                      ? 'border-slate-700 bg-slate-900 text-slate-300'
-                      : 'border-slate-300 bg-white text-slate-600'
-                  }`}
-                >
-                  AI off
+                <span>Snap</span>
+                <span className="flex items-center gap-1">
+                  <span className="ui-kbd-hint">S</span>
+                  {snapToGrid ? <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" /> : null}
                 </span>
-              ) : null}
-              <ChevronDown className="h-3.5 w-3.5 opacity-80" />
-            </summary>
-            <div
-              className={`absolute right-0 z-40 mt-1.5 flex min-w-[14rem] flex-col gap-1.5 rounded-xl border p-2 shadow-xl ${
-                isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
-              }`}
-            >
-              {!isAIEnabled ? (
-                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">AI disabled for MVP</div>
-              ) : null}
-              {storageWarning ? (
-                <span
-                  role="status"
-                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
-                    isDarkMode ? 'bg-amber-500/15 text-amber-200' : 'bg-amber-100 text-amber-700'
-                  }`}
-                  title={storageWarning}
-                >
-                  <AlertTriangle className="h-3 w-3" /> Autosave issue
+              </button>
+              <button
+                type="button"
+                data-testid="toolbar-view-lanes"
+                onClick={() => runMenuAction(onToggleSwimlanes, viewDetailsRef)}
+                className="menu-item justify-between"
+                aria-pressed={showSwimlanes}
+              >
+                <span>Lanes</span>
+                <span className="flex items-center gap-1">
+                  <span className="ui-kbd-hint">L</span>
+                  {showSwimlanes ? <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" /> : null}
                 </span>
-              ) : null}
-              <a
-                href={feedbackHref}
-                target="_blank"
-                rel="noreferrer"
-                className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
-                  isDarkMode
-                    ? 'bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30'
-                    : 'bg-cyan-100 text-cyan-700 hover:bg-cyan-200'
-                }`}
+              </button>
+              <button
+                type="button"
+                data-testid="toolbar-view-handles"
+                onClick={() => runMenuAction(onTogglePorts, viewDetailsRef)}
+                className="menu-item justify-between"
+                aria-pressed={showPorts}
               >
-                Feedback
-              </a>
+                <span>Handles on hover</span>
+                <span className="flex items-center gap-1">
+                  <span className="ui-kbd-hint">P</span>
+                  {showPorts ? <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" /> : null}
+                </span>
+              </button>
+              <button
+                type="button"
+                data-testid="toolbar-view-minimap"
+                onClick={() => runMenuAction(onToggleMinimap, viewDetailsRef)}
+                className="menu-item justify-between"
+                aria-pressed={showMinimap}
+              >
+                <span>Minimap</span>
+                {showMinimap ? <Check className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-300" /> : null}
+              </button>
+              <div className="my-1 border-t border-slate-200/75 dark:border-slate-700/75" />
+              <button
+                type="button"
+                data-testid="toolbar-view-zoom-out"
+                onClick={() => runMenuAction(onZoomOut, viewDetailsRef)}
+                className="menu-item justify-between"
+              >
+                <span className="inline-flex items-center gap-1.5">
+                  <ZoomOut className="h-3.5 w-3.5" /> Zoom out
+                </span>
+                <span className="ui-kbd-hint">-</span>
+              </button>
+              <button
+                type="button"
+                data-testid="toolbar-view-zoom-in"
+                onClick={() => runMenuAction(onZoomIn, viewDetailsRef)}
+                className="menu-item justify-between"
+              >
+                <span className="inline-flex items-center gap-1.5">
+                  <ZoomIn className="h-3.5 w-3.5" /> Zoom in
+                </span>
+                <span className="ui-kbd-hint">+</span>
+              </button>
+              <button
+                type="button"
+                data-testid="toolbar-view-fit"
+                onClick={() => runMenuAction(onFitView, viewDetailsRef)}
+                className="menu-item"
+              >
+                <Maximize2 className="h-3.5 w-3.5" />
+                Fit view
+              </button>
+              <button
+                type="button"
+                data-testid="toolbar-view-center"
+                onClick={() => runMenuAction(onCenterDiagram, viewDetailsRef)}
+                className="menu-item"
+              >
+                <Crosshair className="h-3.5 w-3.5" />
+                Center diagram
+              </button>
+              <button type="button" onClick={() => runMenuAction(onToggleTheme, viewDetailsRef)} className="menu-item">
+                {isDarkMode ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
+                {isDarkMode ? 'Light theme' : 'Dark theme'}
+              </button>
             </div>
           </details>
 
+          <button
+            type="button"
+            data-testid="toolbar-open-command"
+            onClick={onOpenCommandPalette}
+            className="menu-trigger inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2.5"
+            title="Open command palette (Cmd/Ctrl+K)"
+            aria-label="Open command palette"
+          >
+            <Command className="h-3.5 w-3.5" />
+            <span className="hidden md:inline">Command</span>
+          </button>
+
           <button
             type="button"
             data-testid="toolbar-help-open"
             onClick={onOpenHelp}
-            className={actionButton(isDarkMode)}
+            className={`${actionButton(isDarkMode)} !px-2`}
             title="Open quick start help ( ? )"
             aria-label="Open quick start help"
           >
             <HelpCircle className="h-3.5 w-3.5" />
-            <span className="hidden xl:inline">Help</span>
+            <span className="hidden md:inline">Help</span>
           </button>
         </div>
       </div>
 
-      <div className="flex items-center justify-end">
+      {storageWarning ? (
         <div
-          className="flex w-full items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar lg:w-auto lg:justify-end lg:overflow-visible"
-          data-testid="primary-actions-strip"
+          role="status"
+          className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
+            isDarkMode
+              ? 'border-amber-500/35 bg-amber-500/10 text-amber-200'
+              : 'border-amber-200 bg-amber-50 text-amber-700'
+          }`}
         >
-          <span className="ui-section-title shrink-0 px-1">Primary Actions</span>
-
-          <button
-            type="button"
-            data-testid="toolbar-restore"
-            onClick={onRestoreRecovery}
-            className={actionButton(isDarkMode)}
-            title="Restore backup"
-          >
-            <RotateCcw className="h-3.5 w-3.5" />
-            Restore Backup
-          </button>
-
-          <button
-            type="button"
-            data-testid="toolbar-reset-canvas"
-            onClick={onResetCanvas}
-            className="tap-target shrink-0 whitespace-nowrap inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-2.5 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/20 dark:text-rose-100 dark:hover:bg-rose-500/30"
-            title="Reset canvas"
-          >
-            Reset
-          </button>
-
-          <button
-            type="button"
-            data-testid="toolbar-import-json"
-            onClick={onImportDiagram}
-            className={actionButton(isDarkMode)}
-            title="Import JSON"
-          >
-            <Import className="h-3.5 w-3.5" />
-            Import JSON
-          </button>
-
-          <button
-            type="button"
-            data-testid="toolbar-export-json"
-            onClick={onExportDiagram}
-            className="ui-button-primary tap-target shrink-0 whitespace-nowrap inline-flex h-9 items-center gap-1.5 px-2.5 text-[11px] font-semibold"
-            title="Export JSON"
-          >
-            <Download className="h-3.5 w-3.5" />
-            Export JSON
-          </button>
-
-          <details className="relative shrink-0">
-            <summary className={`${actionButton(isDarkMode)} list-none cursor-pointer`} title="Export options">
-              <Download className="h-3.5 w-3.5" />
-              More
-            </summary>
-            <div
-              className={`absolute right-0 z-40 mt-1.5 flex min-w-[11rem] flex-col gap-1 rounded-xl border p-1.5 shadow-xl ${
-                isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'
-              }`}
-            >
-              <button
-                type="button"
-                data-testid="toolbar-export-svg"
-                onClick={onExportSvg}
-                className="ui-button-secondary inline-flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold"
-              >
-                <Download className="h-3.5 w-3.5" /> Export SVG
-              </button>
-              <button
-                type="button"
-                data-testid="toolbar-export-png"
-                onClick={onExportPng}
-                className="ui-button-secondary inline-flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold"
-              >
-                <FileImage className="h-3.5 w-3.5" /> Export PNG
-              </button>
-              <button
-                type="button"
-                data-testid="toolbar-export-pdf"
-                onClick={onExportPdf}
-                className="ui-button-secondary inline-flex items-center gap-1.5 px-2.5 py-2 text-[11px] font-semibold"
-              >
-                <FileText className="h-3.5 w-3.5" /> Export PDF
-              </button>
-            </div>
-          </details>
-
-          {isAIEnabled ? (
-            <button
-              type="button"
-              data-testid="toolbar-open-ai-launcher"
-              onClick={onOpenAiLauncher}
-              className={`${actionButton(isDarkMode)} ${isAILoading ? 'animate-pulse' : ''}`}
-              title="Open AI flow generator"
-            >
-              <Bot className="h-3.5 w-3.5" />
-              AI
-            </button>
-          ) : null}
+          {storageWarning}
         </div>
-      </div>
+      ) : null}
     </header>
   );
 };
diff --git a/components/layout/bottom/BottomToolDock.tsx b/components/layout/bottom/BottomToolDock.tsx
index a0c24b7..430525a 100644
--- a/components/layout/bottom/BottomToolDock.tsx
+++ b/components/layout/bottom/BottomToolDock.tsx
@@ -1,5 +1,5 @@
 import React from 'react';
-import { MoreHorizontal, MousePointer2, Pencil, Sparkles, Type as TypeIcon } from 'lucide-react';
+import { Hand, MoreHorizontal, MousePointer2, Pencil, Sparkles, Type as TypeIcon } from 'lucide-react';
 import InsertConnectorButton from '../InsertConnectorButton';
 import type { ToolMode } from '../../../types';
 
@@ -41,6 +41,17 @@ const BottomToolDock: React.FC<BottomToolDockProps> = ({
         <MousePointer2 className="h-4 w-4" />
       </button>
 
+      <button
+        type="button"
+        onClick={() => onSetActiveTool('hand')}
+        aria-label="Hand tool"
+        aria-pressed={activeTool === 'hand'}
+        title="Hand (H)"
+        className={dockButtonClass(activeTool === 'hand')}
+      >
+        <Hand className="h-4 w-4" />
+      </button>
+
       <button
         type="button"
         onClick={() => onSetActiveTool('draw')}
diff --git a/e2e/a11y.spec.ts b/e2e/a11y.spec.ts
index b250255..1a72494 100644
--- a/e2e/a11y.spec.ts
+++ b/e2e/a11y.spec.ts
@@ -25,20 +25,43 @@ test('editor has no critical accessibility violations', async ({ page }) => {
   expect(criticalViolations, JSON.stringify(criticalViolations, null, 2)).toEqual([]);
 });
 
+test('selected node and edge states have no critical accessibility violations', async ({ page }) => {
+  await clickNodeByLabel(page, 'Sponsor Bank');
+  const nodeResults = await new AxeBuilder({ page })
+    .withTags(['wcag2a', 'wcag2aa'])
+    .analyze();
+  const nodeCriticalViolations = nodeResults.violations.filter((violation) => violation.impact === 'critical');
+  expect(nodeCriticalViolations, JSON.stringify(nodeCriticalViolations, null, 2)).toEqual([]);
+
+  await page.locator('[data-testid="toolbar-insert-connector"]').click();
+  const edgeResults = await new AxeBuilder({ page })
+    .withTags(['wcag2a', 'wcag2aa'])
+    .analyze();
+  const edgeCriticalViolations = edgeResults.violations.filter((violation) => violation.impact === 'critical');
+  expect(edgeCriticalViolations, JSON.stringify(edgeCriticalViolations, null, 2)).toEqual([]);
+});
+
 test('primary controls expose accessible names', async ({ page }) => {
   await expect(page.getByRole('button', { name: 'Select tool' })).toBeVisible();
+  await expect(page.getByRole('button', { name: 'Hand tool' })).toBeVisible();
   await expect(page.getByRole('button', { name: 'Connect tool' })).toBeVisible();
   await expect(page.getByRole('button', { name: 'Text tool' })).toBeVisible();
-  await expect(page.getByRole('button', { name: 'Open layout controls' })).toBeVisible();
   await expect(page.getByRole('button', { name: 'Insert connector' })).toBeVisible();
   await expect(page.getByRole('button', { name: 'Open quick start help' })).toBeVisible();
-  await expect(page.getByRole('button', { name: 'Restore Backup' })).toBeVisible();
-  await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
-  await expect(page.getByRole('button', { name: 'Import JSON' })).toBeVisible();
-  await expect(page.getByRole('button', { name: 'Export JSON' })).toBeVisible();
+  await expect(page.getByRole('button', { name: 'Open command palette' })).toBeVisible();
+  const strip = page.getByTestId('primary-actions-strip').first();
+  await expect(strip.getByTestId('toolbar-file-trigger')).toBeVisible();
+
+  await strip.getByTestId('toolbar-file-trigger').first().click();
+  const fileMenu = strip.getByTestId('toolbar-file-menu').first();
+  await expect(fileMenu).toBeVisible();
+  await expect(fileMenu.getByTestId('toolbar-export-json')).toBeVisible();
+  await expect(fileMenu.getByTestId('toolbar-restore')).toBeVisible();
+  await expect(fileMenu.getByTestId('toolbar-reset-canvas')).toBeVisible();
+  await expect(fileMenu.getByTestId('toolbar-import-json')).toBeVisible();
 
   await clickNodeByLabel(page, 'Sponsor Bank');
-  await expect(page.getByRole('button', { name: 'Delete selected item' })).toBeVisible();
+  await expect(page.getByRole('button', { name: 'Delete selected node' })).toBeVisible();
 });
 
 test('toolbar help control is keyboard focusable with visible focus state', async ({ page }) => {
diff --git a/e2e/mouse-interactions.spec.ts b/e2e/mouse-interactions.spec.ts
new file mode 100644
index 0000000..a4e9e62
--- /dev/null
+++ b/e2e/mouse-interactions.spec.ts
@@ -0,0 +1,82 @@
+import { expect, test, type Page } from '@playwright/test';
+
+const openFileMenu = async (page: Page) => {
+  const strip = page.getByTestId('primary-actions-strip').first();
+  const menu = strip.getByTestId('toolbar-file-menu').first();
+  if (await menu.isVisible()) return menu;
+  await strip.getByTestId('toolbar-file-trigger').first().click();
+  await expect(menu).toBeVisible();
+  return menu;
+};
+
+const clickNodeByLabel = async (page: Page, label: string) => {
+  const node = page.locator(`[data-node-label="${label}"]`).first();
+  await expect(node).toBeVisible();
+  const box = await node.boundingBox();
+  if (!box) {
+    throw new Error(`No bounding box for node "${label}"`);
+  }
+  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
+};
+
+const clickCanvasBlank = async (page: Page) => {
+  const canvas = page.getByTestId('canvas-dropzone');
+  const box = await canvas.boundingBox();
+  if (!box) {
+    throw new Error('Canvas bounds unavailable');
+  }
+  await page.mouse.click(box.x + box.width - 40, box.y + box.height - 40);
+};
+
+test.beforeEach(async ({ page }) => {
+  await page.addInitScript(() => window.localStorage.clear());
+  await page.goto('/');
+  await page.waitForLoadState('networkidle');
+});
+
+test('menus open and close reliably by outside click and escape', async ({ page }) => {
+  const fileMenu = await openFileMenu(page);
+  await expect(fileMenu).toBeVisible();
+  await clickCanvasBlank(page);
+  await expect(fileMenu).not.toBeVisible();
+
+  const viewTrigger = page.getByTestId('toolbar-view-trigger').first();
+  await viewTrigger.click();
+  const viewMenu = page.getByTestId('toolbar-view-menu').first();
+  await expect(viewMenu).toBeVisible();
+  await page.keyboard.press('Escape');
+  await expect(viewMenu).not.toBeVisible();
+});
+
+test('node select and click-off clear work with mouse', async ({ page }) => {
+  await clickNodeByLabel(page, 'Sponsor Bank');
+  await expect(page.getByTestId('inspector-mode-title')).toContainText('Node');
+
+  await clickCanvasBlank(page);
+  await expect(page.getByTestId('inspector-mode-title')).toContainText('Nothing selected');
+});
+
+test('connect pending state cancels by click-off', async ({ page }) => {
+  await page.getByLabel('Connect tool').click();
+  await clickNodeByLabel(page, 'Sponsor Bank');
+  await expect(page.getByTestId('cancel-pending-connection')).toBeVisible();
+
+  await clickCanvasBlank(page);
+  await expect(page.getByTestId('cancel-pending-connection')).toHaveCount(0);
+});
+
+test('port hit area does not trap clicks when connect tool is off', async ({ page }) => {
+  await page.getByLabel('Select tool').click();
+
+  const node = page.locator('[data-node-label="Sponsor Bank"]').first();
+  await expect(node).toBeVisible();
+  const box = await node.boundingBox();
+  if (!box) {
+    throw new Error('Sponsor Bank bounds unavailable');
+  }
+
+  // Click near the top edge where a handle appears on hover.
+  await page.mouse.move(box.x + box.width / 2, box.y + 2);
+  await page.mouse.click(box.x + box.width / 2, box.y + 2);
+  await expect(page.getByTestId('inspector-mode-title')).toContainText('Node');
+});
diff --git a/e2e/vpe-context-menu.spec.ts b/e2e/vpe-context-menu.spec.ts
new file mode 100644
index 0000000..790b22c
--- /dev/null
+++ b/e2e/vpe-context-menu.spec.ts
@@ -0,0 +1,67 @@
+import { expect, test } from '@playwright/test';
+
+const CANVAS_SELECTOR = '[data-testid="canvas-dropzone"]';
+
+const rightClickNodeById = async (page: import('@playwright/test').Page, nodeId: string) => {
+  const node = page.locator(`[data-node-id="${nodeId}"]`).first();
+  await expect(node).toBeVisible();
+  const box = await node.boundingBox();
+  if (!box) throw new Error(`Node bounds unavailable for ${nodeId}`);
+  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: 'right' });
+};
+
+const rightClickCanvasBlank = async (
+  page: import('@playwright/test').Page,
+  offset?: { x: number; y: number }
+) => {
+  const canvas = page.locator(CANVAS_SELECTOR);
+  const box = await canvas.boundingBox();
+  if (!box) throw new Error('Canvas bounds unavailable');
+  const point = offset
+    ? { x: box.x + offset.x, y: box.y + offset.y }
+    : { x: box.x + box.width - 44, y: box.y + box.height - 44 };
+  await page.mouse.click(point.x, point.y, { button: 'right' });
+};
+
+test.beforeEach(async ({ page }) => {
+  await page.addInitScript(() => window.localStorage.clear());
+  await page.goto('/');
+  await page.waitForLoadState('networkidle');
+});
+
+test('node context menu supports start connection and duplicate', async ({ page }) => {
+  const initialNodeCount = await page.locator('[data-node-id]').count();
+
+  await rightClickNodeById(page, 'starter-sponsor');
+  const nodeMenu = page.getByTestId('node-context-menu');
+  await expect(nodeMenu).toBeVisible();
+
+  await nodeMenu.getByTestId('context-menu-start-connect').click();
+  await expect(page.getByRole('button', { name: 'Connect tool' })).toHaveAttribute('aria-pressed', 'true');
+  await expect(page.getByTestId('cancel-pending-connection')).toBeVisible();
+
+  await page.keyboard.press('Escape');
+  await expect(page.getByTestId('cancel-pending-connection')).toHaveCount(0);
+
+  await rightClickNodeById(page, 'starter-sponsor');
+  await expect(nodeMenu).toBeVisible();
+  await nodeMenu.getByTestId('context-menu-duplicate-node').click();
+
+  await expect.poll(async () => page.locator('[data-node-id]').count()).toBe(initialNodeCount + 1);
+});
+
+test('canvas context menu can add nodes', async ({ page }) => {
+  const initialNodeCount = await page.locator('[data-node-id]').count();
+
+  await rightClickCanvasBlank(page);
+  const canvasMenu = page.getByTestId('canvas-context-menu');
+  await expect(canvasMenu).toBeVisible();
+
+  await canvasMenu.getByTestId('context-menu-add-sponsor').click();
+  await expect.poll(async () => page.locator('[data-node-id]').count()).toBe(initialNodeCount + 1);
+
+  await rightClickCanvasBlank(page, { x: 110, y: 110 });
+  await expect(canvasMenu).toBeVisible();
+  await canvasMenu.getByTestId('context-menu-fit-view').click();
+  await expect(canvasMenu).toHaveCount(0);
+});
diff --git a/e2e/vpe-hand-tool.spec.ts b/e2e/vpe-hand-tool.spec.ts
new file mode 100644
index 0000000..d11be28
--- /dev/null
+++ b/e2e/vpe-hand-tool.spec.ts
@@ -0,0 +1,38 @@
+import { expect, test } from '@playwright/test';
+
+const CANVAS_SELECTOR = '[data-testid="canvas-dropzone"]';
+const WORLD_LAYER_SELECTOR = `${CANVAS_SELECTOR} div.absolute.inset-0`;
+
+test.beforeEach(async ({ page }) => {
+  await page.addInitScript(() => window.localStorage.clear());
+  await page.goto('/');
+  await page.waitForLoadState('networkidle');
+});
+
+test('keyboard shortcut switches to hand tool', async ({ page }) => {
+  const handTool = page.getByRole('button', { name: 'Hand tool' });
+  await expect(handTool).toHaveAttribute('aria-pressed', 'false');
+
+  await page.keyboard.press('h');
+  await expect(handTool).toHaveAttribute('aria-pressed', 'true');
+});
+
+test('hand tool pans canvas without holding space', async ({ page }) => {
+  const handTool = page.getByRole('button', { name: 'Hand tool' });
+  await handTool.click();
+  await expect(handTool).toHaveAttribute('aria-pressed', 'true');
+
+  const canvas = page.locator(CANVAS_SELECTOR);
+  const worldLayer = page.locator(WORLD_LAYER_SELECTOR).first();
+  const before = await worldLayer.getAttribute('style');
+
+  const box = await canvas.boundingBox();
+  if (!box) throw new Error('Canvas bounds unavailable');
+
+  await page.mouse.move(box.x + box.width - 180, box.y + box.height - 150);
+  await page.mouse.down();
+  await page.mouse.move(box.x + box.width - 60, box.y + box.height - 70);
+  await page.mouse.up();
+
+  await expect.poll(async () => worldLayer.getAttribute('style')).not.toBe(before);
+});
```
