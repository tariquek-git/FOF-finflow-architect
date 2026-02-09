import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Node, Edge, Position, PaymentRail, DrawingPath, EntityType, FlowDirection, NodeShape, EndPointType, ArrowType, ViewportTransform } from '../types';
import { ENTITY_ICONS, RAIL_COLORS, ENDPOINT_ICONS } from '../constants';
import { Copy, Link as LinkIcon, Trash2 } from 'lucide-react';

// --- MATH HELPERS (Moved outside component to avoid recreation) ---
const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const ANCHOR_SIZE = 16; 
const SNAP_THRESHOLD = 5;

const createId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const getBezierPoint = (t: number, p0: Position, p1: Position, p2: Position, p3: Position) => {
  const x = Math.pow(1 - t, 3) * p0.x + 3 * Math.pow(1 - t, 2) * t * p1.x + 3 * (1 - t) * Math.pow(t, 2) * p2.x + Math.pow(t, 3) * p3.x;
  const y = Math.pow(1 - t, 3) * p0.y + 3 * Math.pow(1 - t, 2) * t * p1.y + 3 * (1 - t) * Math.pow(t, 2) * p2.y + Math.pow(t, 3) * p3.y;
  return { x, y };
};

const getBezierAngle = (t: number, p0: Position, p1: Position, p2: Position, p3: Position) => {
  const dx = 3 * Math.pow(1 - t, 2) * (p1.x - p0.x) + 6 * (1 - t) * t * (p2.x - p1.x) + 3 * Math.pow(t, 2) * (p3.x - p2.x);
  const dy = 3 * Math.pow(1 - t, 2) * (p1.y - p0.y) + 6 * (1 - t) * t * (p2.y - p1.y) + 3 * Math.pow(t, 2) * (p3.y - p2.y);
  return Math.atan2(dy, dx) * (180 / Math.PI);
};

// Improved Orthogonal Pathing Logic
const getOrthogonalPath = (start: Position, end: Position, sourcePort: number, targetPort: number, offset: number) => {
  const points: Position[] = [start];
  
  // Directions: 0:Up, 1:Right, 2:Down, 3:Left
  const dir = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }
  ];
  
  const MIN_DIST = 25; // Minimum distance to travel before turning
  
  // 1. Exit Source
  const p1 = { 
      x: start.x + dir[sourcePort].x * MIN_DIST, 
      y: start.y + dir[sourcePort].y * MIN_DIST 
  };
  points.push(p1);

  // 2. Approach Target
  // We use the midpoint logic but respect directionality better to create clean 90-degree turns
  
  // Vertical split or Horizontal split?
  // If leaving horizontally (1 or 3)
  if (sourcePort === 1 || sourcePort === 3) {
      // If target is entering horizontally (1 or 3)
      if (targetPort === 1 || targetPort === 3) {
          const midX = (p1.x + end.x - dir[targetPort].x * MIN_DIST) / 2 + offset;
          points.push({ x: midX, y: p1.y });
          points.push({ x: midX, y: end.y });
      } else {
          // Target is vertical (0 or 2)
          points.push({ x: end.x, y: p1.y });
      }
  } else {
      // Source is vertical (0 or 2)
      // If target is entering vertically (0 or 2)
      if (targetPort === 0 || targetPort === 2) {
          const midY = (p1.y + end.y - dir[targetPort].y * MIN_DIST) / 2 + offset;
          points.push({ x: p1.x, y: midY });
          points.push({ x: end.x, y: midY });
      } else {
          // Target is horizontal
          points.push({ x: p1.x, y: end.y });
      }
  }
  
  // 3. Enter Target
  points.push(end);

  const d = `M ${start.x} ${start.y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
  
  // Calculate angles for arrows
  const prev = points[points.length - 2];
  const angle = Math.atan2(end.y - prev.y, end.x - prev.x) * (180/Math.PI);
  const second = points[1];
  const startAngle = Math.atan2(second.y - start.y, second.x - start.x) * (180/Math.PI);
  
  // Label Logic - Try to find the longest segment
  let maxLen = 0;
  let labelPos = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  
  for(let i=0; i<points.length-1; i++) {
      const segStart = points[i];
      const segEnd = points[i+1];
      const len = Math.sqrt(Math.pow(segEnd.x - segStart.x, 2) + Math.pow(segEnd.y - segStart.y, 2));
      if (len > maxLen) {
          maxLen = len;
          labelPos = { x: (segStart.x + segEnd.x)/2, y: (segStart.y + segEnd.y)/2 };
      }
  }

  return { d, angleAtEnd: angle, angleAtStart: startAngle, labelPos };
};

const getPortPosition = (node: Node, portIdx: number) => {
  if (node.type === EntityType.ANCHOR) {
      return { x: node.position.x + ANCHOR_SIZE/2, y: node.position.y + ANCHOR_SIZE/2 };
  }
  const w = node.width || (node.type === EntityType.GATE ? 132 : (node.shape === NodeShape.CIRCLE ? 80 : (node.shape === NodeShape.DIAMOND ? 100 : NODE_WIDTH)));
  const h = node.height || (node.type === EntityType.GATE ? 36 : (node.shape === NodeShape.CIRCLE ? 80 : (node.shape === NodeShape.DIAMOND ? 100 : NODE_HEIGHT)));
  
  const x = node.position.x;
  const y = node.position.y;
  const cx = x + w/2;
  const cy = y + h/2;

  if (node.shape === NodeShape.DIAMOND && node.type !== EntityType.GATE) {
     if (portIdx === 0) return { x: cx, y }; 
     if (portIdx === 1) return { x: x + w, y: cy }; 
     if (portIdx === 2) return { x: cx, y: y + h }; 
     if (portIdx === 3) return { x, y: cy }; 
  }
  if (portIdx === 0) return { x: cx, y }; 
  if (portIdx === 1) return { x: x + w, y: cy }; 
  if (portIdx === 2) return { x: cx, y: y + h }; 
  if (portIdx === 3) return { x, y: cy }; 
  return { x, y };
};

const getArrowPath = (type: ArrowType) => {
     switch (type) {
         case ArrowType.SHARP: return "M -10 -4 L 0 0 L -10 4 L -8 0 Z";
         case ArrowType.OPEN: return "M -10 -5 L 0 0 L -10 5"; 
         case ArrowType.CIRCLE: return "M -5 0 A 5 5 0 1 0 5 0 A 5 5 0 1 0 -5 0 Z";
         case ArrowType.DIAMOND: return "M -10 0 L -5 -5 L 0 0 L -5 5 Z";
         case ArrowType.CLASSIC: default: return "M -10 -5 L 0 0 L -10 5 Z";
     }
};

const EDGE_LABEL_WIDTH = 132;
const EDGE_LABEL_HEIGHT = 64;

const getEdgeLabelAnchor = (
  edge: Edge,
  source: Node,
  target: Node,
  offsetIndex: number,
  totalEdges: number
) => {
  const start = getPortPosition(source, edge.sourcePortIdx);
  const end = getPortPosition(target, edge.targetPortIdx);
  const gap = 20;
  const centerOffset = (totalEdges - 1) * gap / 2;
  const offsetValue = offsetIndex * gap - centerOffset;

  if (edge.pathType === 'straight') {
    return {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2
    };
  }

  if (edge.pathType === 'orthogonal') {
    const ortho = getOrthogonalPath(start, end, edge.sourcePortIdx, edge.targetPortIdx, offsetValue);
    return {
      x: ortho.labelPos.x,
      y: ortho.labelPos.y
    };
  }

  const midX = (start.x + end.x) / 2;
  const cpOffset =
    Math.abs(start.x - end.x) > Math.abs(start.y - end.y)
      ? { x: 0, y: offsetValue * 3 }
      : { x: offsetValue * 3, y: 0 };
  const p1 = { x: midX + cpOffset.x, y: start.y + cpOffset.y };
  const p2 = { x: midX + cpOffset.x, y: end.y + cpOffset.y };
  return getBezierPoint(0.5, start, p1, p2, end);
};


// --- MEMOIZED CHILD COMPONENTS ---

const DiagramEdge = React.memo(({ edge, source, target, isSelected, isDarkMode, onSelect, offsetIndex, totalEdges, labelPosition }: { 
    edge: Edge; 
    source: Node; 
    target: Node; 
    isSelected: boolean; 
    isDarkMode: boolean;
    onSelect: (id: string) => void;
    offsetIndex: number;
    totalEdges: number;
    labelPosition?: Position;
}) => {
    const start = getPortPosition(source, edge.sourcePortIdx);
    const end = getPortPosition(target, edge.targetPortIdx);
    
    // Calculate Offset for Parallel Edges
    const gap = 20;
    const centerOffset = (totalEdges - 1) * gap / 2;
    const offsetValue = (offsetIndex * gap) - centerOffset;

    const baseColor = RAIL_COLORS[edge.rail] || '#94a3b8';
    let strokeColor = edge.color || baseColor;
    
    if (!edge.color && edge.rail === PaymentRail.BLANK) {
        strokeColor = isDarkMode ? '#94a3b8' : '#64748b';
    }
    
    let strokeDash = "";
    if (edge.style === 'dashed') strokeDash = "6,4";
    else if (edge.style === 'dotted') strokeDash = "2,4";
    else if (edge.direction === FlowDirection.AUTH) strokeDash = "5,5";
    else if (edge.direction === FlowDirection.INTERNAL) strokeDash = "2,2";
    else if (edge.direction === FlowDirection.RETURN) strokeDash = "4,2";

    let pathD = "";
    let midMarker = null;
    let labelX = 0;
    let labelY = 0;
    let endAngle = 0; 
    let startAngle = 0;

    const arrowType = edge.arrowType || ArrowType.CLASSIC;
    const arrowPath = getArrowPath(arrowType);
    const arrowScale = edge.arrowSize || 1;
    const isArrowOpen = arrowType === ArrowType.OPEN;
    const arrowFill = isArrowOpen ? 'none' : strokeColor;
    const arrowStroke = strokeColor;
    const arrowStrokeWidth = isArrowOpen ? 2 : 0;

    if (edge.pathType === 'straight') {
        pathD = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
        labelX = (start.x + end.x) / 2;
        labelY = (start.y + end.y) / 2;
        endAngle = Math.atan2(end.y - start.y, end.x - start.x) * (180/Math.PI);
        startAngle = endAngle;
    } 
    else if (edge.pathType === 'orthogonal') {
        const ortho = getOrthogonalPath(start, end, edge.sourcePortIdx, edge.targetPortIdx, offsetValue);
        pathD = ortho.d;
        labelX = ortho.labelPos.x;
        labelY = ortho.labelPos.y;
        endAngle = ortho.angleAtEnd;
        startAngle = ortho.angleAtStart;
    } else {
        // Bezier (Default)
        const midX = (start.x + end.x) / 2;
        let cpOffset = { x: 0, y: 0 };
        if (Math.abs(start.x - end.x) > Math.abs(start.y - end.y)) {
             cpOffset = { x: 0, y: offsetValue * 3 }; 
        } else {
             cpOffset = { x: offsetValue * 3, y: 0 };
        }

        const p1 = { x: midX + cpOffset.x, y: start.y + cpOffset.y };
        const p2 = { x: midX + cpOffset.x, y: end.y + cpOffset.y };
        
        pathD = `M ${start.x} ${start.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${end.x} ${end.y}`;
        const midPoint = getBezierPoint(0.5, start, p1, p2, end);
        labelX = midPoint.x;
        labelY = midPoint.y;
        endAngle = getBezierAngle(1, start, p1, p2, end);
        startAngle = getBezierAngle(0, start, p1, p2, end);
    }

    if (edge.showMidArrow) {
       // Only show mid arrow for bezier for now as ortho handles it differently
       if (edge.pathType !== 'orthogonal') {
          // simple calc for straight/bezier mid angle
          // For straight:
          const angle = edge.pathType === 'straight' ? endAngle : getBezierAngle(0.5, start, 
              { x: (start.x + end.x) / 2, y: start.y }, 
              { x: (start.x + end.x) / 2, y: end.y }, end); // simplified bezier points for calc
          midMarker = (
            <g transform={`translate(${labelX}, ${labelY}) rotate(${angle}) scale(${arrowScale})`}>
              <path d={arrowPath} fill={arrowFill} stroke={arrowStroke} strokeWidth={arrowStrokeWidth} />
            </g>
          );
       }
    }

    const railLabel = edge.rail === PaymentRail.OTHER
      ? (edge.customRailLabel || 'Other')
      : (edge.rail === PaymentRail.CARD_NETWORK && edge.cardNetwork ? edge.cardNetwork : edge.rail);
    const primaryLabel = railLabel || edge.label || '';
    const showLabel = !!primaryLabel;
    const showDetailLabels = edge.showDetailsOnCanvas === true;
    const resolvedLabelPos = labelPosition || { x: labelX, y: labelY };

    return (
      <g className="cursor-pointer group" 
         onClick={(e) => { e.stopPropagation(); onSelect(edge.id); }}
         onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onSelect(edge.id); }}>
        <path d={pathD} stroke="transparent" strokeWidth="16" fill="none" />
        <path d={pathD} stroke={strokeColor} strokeWidth={isSelected ? (edge.thickness ? edge.thickness + 2 : 4) : (edge.thickness || 2)} strokeDasharray={strokeDash} fill="none" className={`transition-all ${isSelected ? 'opacity-100' : 'opacity-80 hover:opacity-100'}`} />
        {isSelected && (
          <path
            d={pathD}
            stroke={isDarkMode ? '#e2e8f0' : '#0f172a'}
            strokeWidth="1"
            strokeDasharray="4,12"
            fill="none"
            className="animate-flow-dash opacity-70"
          />
        )}
        {midMarker}
        {edge.showStartArrow ? (
           <g transform={`translate(${start.x}, ${start.y}) rotate(${startAngle + 180}) scale(${arrowScale})`}>
              <path d={arrowPath} fill={arrowFill} stroke={arrowStroke} strokeWidth={arrowStrokeWidth} />
           </g>
        ) : null}
        {edge.showArrowHead ? (
           <g transform={`translate(${end.x}, ${end.y}) rotate(${endAngle}) scale(${arrowScale})`}>
              <path d={arrowPath} fill={arrowFill} stroke={arrowStroke} strokeWidth={arrowStrokeWidth} />
           </g>
        ) : (
           <circle cx={end.x} cy={end.y} r="3" fill={strokeColor} />
        )}
        {showLabel && (
          <foreignObject x={resolvedLabelPos.x - 66} y={resolvedLabelPos.y - 32} width="132" height="64" style={{ pointerEvents: 'none' }}>
             <div className="flex flex-col items-center justify-center gap-1 w-full h-full">
               <div className={`max-w-[128px] px-2 py-0.5 rounded-md shadow-sm border backdrop-blur-sm ${
                 isDarkMode ? 'bg-slate-900/80 border-slate-700' : 'bg-white/80 border-slate-200'
               }`}>
                 <span
                   className="block text-[9px] font-bold px-1 py-0.5 rounded text-white shadow-sm whitespace-nowrap overflow-hidden text-ellipsis"
                   style={{ backgroundColor: strokeColor }}
                 >
                   {primaryLabel}
                 </span>
               </div>
               {showDetailLabels && (
                 <div className={`max-w-[128px] px-2 py-0.5 rounded-md border text-[8px] font-medium whitespace-nowrap overflow-hidden text-ellipsis ${
                   isDarkMode ? 'bg-slate-900/80 border-slate-700 text-slate-200' : 'bg-white/80 border-slate-200 text-slate-700'
                 }`}>
                   {[
                     edge.settlementTiming || edge.timing,
                     edge.netting || edge.settlementType,
                     edge.currency
                   ]
                     .filter(Boolean)
                     .join(' • ')}
                 </div>
               )}
             </div>
          </foreignObject>
        )}
      </g>
    );
}, (prev, next) => {
    return (
        prev.edge === next.edge &&
        prev.isSelected === next.isSelected &&
        prev.isDarkMode === next.isDarkMode &&
        prev.source.position.x === next.source.position.x &&
        prev.source.position.y === next.source.position.y &&
        prev.target.position.x === next.target.position.x &&
        prev.target.position.y === next.target.position.y &&
        prev.offsetIndex === next.offsetIndex &&
        prev.totalEdges === next.totalEdges &&
        prev.labelPosition?.x === next.labelPosition?.x &&
        prev.labelPosition?.y === next.labelPosition?.y
    );
});

type DiagramNodeProps = {
  node: Node;
  isSelected: boolean;
  isDarkMode: boolean;
  blurData: boolean;
  showPorts: boolean;
  connecting: { id: string; portIdx: number } | null;
  isExportMode: boolean;
  activeTool: 'select' | 'draw' | 'text';
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onPortClick: (e: React.MouseEvent, nodeId: string, portIdx: number) => void;
  isEditing: boolean;
  onEditStart: (id: string) => void;
  onLabelChange: (id: string, newLabel: string) => void;
  onEditComplete: () => void;
};

const DiagramNode = React.memo(({
    node,
    isSelected,
    isDarkMode,
    blurData,
    showPorts,
    connecting,
    isExportMode,
    activeTool,
    onMouseDown,
    onClick,
    onContextMenu,
    onPortClick,
    isEditing,
    onEditStart,
    onLabelChange,
    onEditComplete
}: DiagramNodeProps) => {
    // Use stored zIndex or default fallback
    const isGateChip = node.type === EntityType.GATE;
    const nodeWidth = node.width || (isGateChip ? 132 : (node.shape === NodeShape.CIRCLE ? 80 : (node.shape === NodeShape.DIAMOND ? 100 : NODE_WIDTH)));
    const nodeHeight = node.height || (isGateChip ? 36 : (node.shape === NodeShape.CIRCLE ? 80 : (node.shape === NodeShape.DIAMOND ? 100 : NODE_HEIGHT)));
    const zIndex = node.zIndex || (isGateChip ? 32 : (node.shape === NodeShape.DIAMOND ? 30 : 20));
    const activeZIndex = isSelected ? 999 : zIndex;
    
    // ANCHOR RENDERING
    if (node.type === EntityType.ANCHOR) {
        return (
            <div
                className={`absolute rounded-full shadow-sm cursor-grab active:cursor-grabbing hover:scale-125 transition-transform
                    ${isSelected ? 'ring-2 ring-indigo-500 bg-indigo-500' : (isDarkMode ? 'bg-slate-400' : 'bg-slate-500')}
                `}
                style={{
                    left: node.position.x,
                    top: node.position.y,
                    width: ANCHOR_SIZE,
                    height: ANCHOR_SIZE,
                    zIndex: activeZIndex + 20 // Anchors above lines
                }}
                onMouseDown={(e) => onMouseDown(e, node.id)}
                onClick={(e) => {
                     e.stopPropagation();
                     if(connecting) {
                          onPortClick(e, node.id, 0); 
                     } else {
                         onPortClick(e, node.id, 0);
                     }
                }}
                onContextMenu={(e) => onContextMenu(e, node.id)}
            />
        );
    }

    // NORMAL NODE RENDERING
    const isDarkNode = ['#1e293b', '#0f172a', '#172554', '#020617', '#ef4444', '#10b981', '#6366f1'].includes(node.color || '');
    const textColor = isDarkNode ? 'text-white' : (isDarkMode ? 'text-slate-200' : 'text-slate-900');
    const iconColor = isDarkNode ? 'text-white' : undefined; 

    return (
        <div
          className={`absolute transition-all overflow-visible group flex flex-col items-center justify-center
            ${node.type === EntityType.TEXT_BOX ? 'bg-transparent border-transparent' : 'border shadow-md'}
            ${isSelected ? 'ring-2 ring-indigo-500 shadow-xl' : (isDarkMode ? 'border-slate-700' : 'border-slate-200')}
            ${node.isPhantom ? 'opacity-60 border-dashed bg-transparent' : ''}
          `}
          style={{
             left: node.position.x,
             top: node.position.y,
             width: nodeWidth,
             height: nodeHeight,
             backgroundColor: node.type === EntityType.TEXT_BOX || node.isPhantom ? 'transparent' : (node.color || (isDarkMode ? '#1e293b' : 'white')),
             borderRadius: isGateChip ? '9999px' : (node.shape === NodeShape.CIRCLE ? '9999px' : (node.shape === NodeShape.DIAMOND ? '0.5rem' : '0.75rem')),
             zIndex: activeZIndex,
             transform: !isGateChip && node.shape === NodeShape.DIAMOND ? 'rotate(45deg)' : 'none'
          }}
          onMouseDown={(e) => onMouseDown(e, node.id)}
          onClick={onClick}
          onDoubleClick={(e: React.MouseEvent) => { e.stopPropagation(); onEditStart(node.id); }}
          onContextMenu={(e) => onContextMenu(e, node.id)}
        >
          <div className={`flex ${isGateChip ? 'flex-row gap-2 px-3' : 'flex-col'} items-center justify-center pointer-events-none w-full h-full ${!isGateChip && node.shape === NodeShape.DIAMOND ? '-rotate-45' : ''}`}>
            {node.type === EntityType.TEXT_BOX ? (
              isEditing ? (
                <textarea
                  className="pointer-events-auto bg-transparent border-b border-indigo-500 text-center resize-none outline-none overflow-hidden font-medium"
                  style={{ 
                       color: isDarkMode ? '#cbd5e1' : '#475569',
                       width: '90%', 
                       height: '90%', 
                       fontSize: node.fontSize || 14
                  }}
                  autoFocus
                  value={node.label}
                  onChange={(e) => onLabelChange(node.id, e.target.value)}
                  onBlur={onEditComplete}
                  onKeyDown={(e) => {
                      if(e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          onEditComplete();
                      }
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                <div className={`p-2 font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'} ${blurData ? 'blur-sm' : ''}`} style={{ fontSize: node.fontSize || 14 }}>
                   {node.label || 'Double click to edit'}
                </div>
              )
            ) : (
              <>
                {!node.isPhantom && (
                    <div className={`rounded-lg flex items-center justify-center w-8 h-8 ${isGateChip ? 'mb-0' : 'mb-1'} ${isDarkNode ? 'bg-white/10' : (isDarkMode ? 'bg-black/20' : 'bg-slate-50')}`}>
                       <span className={iconColor}>
                         {node.type === EntityType.END_POINT && node.endPointType ? ENDPOINT_ICONS[node.endPointType] : ENTITY_ICONS[node.type]}
                       </span>
                    </div>
                )}
                {node.isPhantom && (
                     <div className="mb-1 opacity-70">
                        {node.type === EntityType.END_POINT && node.endPointType ? ENDPOINT_ICONS[node.endPointType] : ENTITY_ICONS[node.type]}
                     </div>
                )}
                
                {isEditing ? (
                     <textarea
                        className="pointer-events-auto bg-transparent border-b border-white/20 text-center resize-none outline-none overflow-hidden text-xs font-semibold px-2 leading-tight"
                        style={{ 
                             color: isDarkNode ? 'white' : (isDarkMode ? '#e2e8f0' : '#0f172a'),
                             width: '90%', 
                             height: '24px'
                        }}
                        autoFocus
                        value={node.label}
                        onChange={(e) => onLabelChange(node.id, e.target.value)}
                        onBlur={onEditComplete}
                        onKeyDown={(e) => {
                            if(e.key === 'Enter') {
                                e.preventDefault();
                                onEditComplete();
                            }
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                     />
                ) : (
                    <span className={`text-xs font-semibold px-2 text-center leading-tight max-w-[95%] truncate ${textColor} ${blurData ? 'blur-sm select-none' : ''}`}>
                      {node.label}
                    </span>
                )}

                {node.isPhantom && <span className="text-[9px] uppercase tracking-widest text-indigo-500 mt-1 font-bold">Phantom</span>}
              </>
            )}
          </div>

          {showPorts && !isExportMode && node.type !== EntityType.TEXT_BOX && [0,1,2,3].map(idx => {
            let portStyle = {};
            if (node.shape === NodeShape.DIAMOND && node.type !== EntityType.GATE) {
               if(idx===0) portStyle = { top: -6, left: -6 }; 
               if(idx===1) portStyle = { top: -6, right: -6 }; 
               if(idx===2) portStyle = { bottom: -6, right: -6 }; 
               if(idx===3) portStyle = { bottom: -6, left: -6 }; 
            } else {
               if(idx===0) portStyle = { left: '50%', top: -6, transform: 'translateX(-50%)' };
               if(idx===1) portStyle = { right: -6, top: '50%', transform: 'translateY(-50%)' };
               if(idx===2) portStyle = { left: '50%', bottom: -6, transform: 'translateX(-50%)' };
               if(idx===3) portStyle = { left: -6, top: '50%', transform: 'translateY(-50%)' };
            }

            return (
              <button
                key={idx}
                className={`absolute w-3 h-3 rounded-full border border-white dark:border-slate-800 shadow-sm transition-all hover:scale-150 z-50
                  ${connecting?.id === node.id && connecting.portIdx === idx ? 'bg-indigo-600 ring-2 ring-indigo-500/30' : 'bg-slate-400 dark:bg-slate-600 opacity-0 group-hover:opacity-100'}
                `}
                style={portStyle}
                onClick={(e) => onPortClick(e, node.id, idx)}
              />
            );
          })}
        </div>
    );
}, (prev, next) => {
    return (
        prev.node === next.node &&
        prev.isSelected === next.isSelected &&
        prev.isDarkMode === next.isDarkMode &&
        prev.blurData === next.blurData &&
        prev.showPorts === next.showPorts &&
        prev.connecting?.id === next.connecting?.id && 
        prev.connecting?.portIdx === next.connecting?.portIdx &&
        prev.activeTool === next.activeTool &&
        prev.isEditing === next.isEditing
    );
});

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  drawings: DrawingPath[];
  selectedNodeId: string | null;
  selectedNodeIds?: string[];
  selectedEdgeId: string | null;
  onSelectNode: (id: string | null) => void;
  onToggleNodeSelection?: (id: string) => void;
  onSelectEdge: (id: string | null) => void;
  onUpdateNodePosition: (id: string, pos: Position) => void;
  onNodeDragStart?: (id: string) => void;
  onNodeDragEnd?: (id: string) => void;
  onConnect: (sourceId: string, targetId: string, spIdx: number, tpIdx: number) => void;
  onUpdateNode: (node: Node) => void; 
  isDarkMode: boolean;
  showPorts: boolean;
  activeTool: 'select' | 'draw' | 'text';
  onAddDrawing: (path: DrawingPath) => void;
  onOpenInspector: () => void;
  onQuickAddNode: (type: EntityType, pos: Position) => void;
  onAddConnectedNode: (sourceId: string, type: EntityType) => void;
  onDuplicateNode: (sourceId: string) => void; 
  onDeleteNode: (sourceId: string) => void;
  showSwimlanes: boolean;
  gridMode: 'dots' | 'lines' | 'none';
  blurData: boolean;
  swimlaneCount: number;
  isExportMode?: boolean;
  onCanvasMount?: (element: HTMLDivElement | null) => void;
  viewport: ViewportTransform;
  onViewportChange: (newViewport: ViewportTransform) => void;
  // --- VISUAL STYLE PROPS ---
  activeColor: string;
  activeLineStyle: 'solid' | 'dashed' | 'dotted';
  activeArrowMode: 'forward' | 'reverse' | 'both' | 'none';
  activePathType: 'bezier' | 'orthogonal' | 'straight';
}

const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes,
  edges,
  drawings,
  selectedNodeId,
  selectedNodeIds = [],
  selectedEdgeId,
  onSelectNode,
  onToggleNodeSelection,
  onSelectEdge,
  onUpdateNodePosition,
  onNodeDragStart,
  onNodeDragEnd,
  onConnect,
  onUpdateNode,
  isDarkMode,
  showPorts,
  activeTool,
  onAddDrawing,
  onOpenInspector,
  onQuickAddNode,
  onAddConnectedNode,
  onDuplicateNode,
  onDeleteNode,
  showSwimlanes,
  gridMode,
  blurData,
  swimlaneCount,
  isExportMode = false,
  onCanvasMount,
  viewport,
  onViewportChange,
  activeColor,
  activeLineStyle,
  activeArrowMode,
  activePathType
}) => {
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<{ id: string; portIdx: number } | null>(null);
  const [mousePos, setMousePos] = useState<Position>({ x: 0, y: 0 }); // World Coordinates
  const [currentPath, setCurrentPath] = useState<Position[] | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Position>({ x: 0, y: 0 });
  const [alignmentGuides, setAlignmentGuides] = useState<{ x?: number, y?: number }>({});
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsSpacePressed(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        setIsSpacePressed(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (connecting && !nodes.some((n) => n.id === connecting.id)) {
      setConnecting(null);
    }
  }, [connecting, nodes]);

  useEffect(() => {
    if (!draggingNodeId) return;
    const handleWindowMouseUp = () => {
      onNodeDragEnd?.(draggingNodeId);
      setDraggingNodeId(null);
      setAlignmentGuides({});
    };
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => window.removeEventListener('mouseup', handleWindowMouseUp);
  }, [draggingNodeId, onNodeDragEnd]);

  // --- SCREEN TO WORLD CONVERSION ---
  const screenToWorld = useCallback((clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const containerX = clientX - rect.left;
      const containerY = clientY - rect.top;
      return {
          x: (containerX - viewport.x) / viewport.zoom,
          y: (containerY - viewport.y) / viewport.zoom
      };
  }, [viewport]);

  // --- EVENTS ---

  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
          const zoomSensitivity = 0.001;
          const delta = -e.deltaY * zoomSensitivity;
          const newZoom = Math.min(Math.max(viewport.zoom + delta, 0.1), 5); 

          if (containerRef.current) {
               const rect = containerRef.current.getBoundingClientRect();
               const mouseX = e.clientX - rect.left;
               const mouseY = e.clientY - rect.top;
               
               const worldX = (mouseX - viewport.x) / viewport.zoom;
               const worldY = (mouseY - viewport.y) / viewport.zoom;

               const newX = mouseX - worldX * newZoom;
               const newY = mouseY - worldY * newZoom;

               onViewportChange({ x: newX, y: newY, zoom: newZoom });
          }
          return;
      }

      // Default wheel behavior: pan the canvas.
      onViewportChange({
        ...viewport,
        x: viewport.x - e.deltaX,
        y: viewport.y - e.deltaY
      });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && isSpacePressed)) {
        e.preventDefault();
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
    }

    if (activeTool === 'draw') {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      setCurrentPath([{ x: worldPos.x, y: worldPos.y }]);
    }

    // Click on canvas clears selection and edit mode
    if (activeTool === 'select' && !isSpacePressed) {
         onSelectNode(null);
         onSelectEdge(null);
         setEditingNodeId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        onViewportChange({
            ...viewport,
            x: viewport.x + dx,
            y: viewport.y + dy
        });
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
    }

    const worldPos = screenToWorld(e.clientX, e.clientY);
    setMousePos(worldPos);

    if (draggingNodeId) {
      const node = nodes.find(n => n.id === draggingNodeId);
      if (!node) return;

      const w = node.width || (node.type === EntityType.GATE ? 132 : NODE_WIDTH);
      const h = node.height || (node.type === EntityType.GATE ? 36 : NODE_HEIGHT);
      
      let rawX = worldPos.x - w / 2;
      let rawY = worldPos.y - h / 2;

      // --- ALIGNMENT GUIDES & SNAPPING ---
      let newGuides: { x?: number, y?: number } = {};
      let snappedX = rawX;
      let snappedY = rawY;

      // Only calculate guides if we are dragging a single node
      if (node) {
          // Center points
          const cx = rawX + w/2;
          const cy = rawY + h/2;

          nodes.forEach(other => {
              if (other.id === draggingNodeId) return;
              
              const ow = other.width || (other.type === EntityType.GATE ? 132 : (other.shape === NodeShape.CIRCLE ? 80 : NODE_WIDTH));
              const oh = other.height || (other.type === EntityType.GATE ? 36 : (other.shape === NodeShape.CIRCLE ? 80 : NODE_HEIGHT));
              const ocx = other.position.x + ow/2;
              const ocy = other.position.y + oh/2;

              // Vertical Alignment (Align Centers X)
              if (Math.abs(cx - ocx) < SNAP_THRESHOLD) {
                  snappedX = ocx - w/2;
                  newGuides.x = ocx;
              }
              // Align Left to Left
              else if (Math.abs(rawX - other.position.x) < SNAP_THRESHOLD) {
                  snappedX = other.position.x;
                  newGuides.x = other.position.x;
              }

              // Horizontal Alignment (Align Centers Y)
              if (Math.abs(cy - ocy) < SNAP_THRESHOLD) {
                  snappedY = ocy - h/2;
                  newGuides.y = ocy;
              }
              // Align Top to Top
              else if (Math.abs(rawY - other.position.y) < SNAP_THRESHOLD) {
                  snappedY = other.position.y;
                  newGuides.y = other.position.y;
              }
          });
      }
      
      setAlignmentGuides(newGuides);
      
      // If no snap guide, optional grid snap
      if (newGuides.x === undefined) snappedX = Math.round(snappedX / 10) * 10;
      if (newGuides.y === undefined) snappedY = Math.round(snappedY / 10) * 10;
      
      onUpdateNodePosition(draggingNodeId, { x: snappedX, y: snappedY });
    } else {
        if(Object.keys(alignmentGuides).length > 0) setAlignmentGuides({});
    }

    if (currentPath) {
      setCurrentPath([...currentPath, worldPos]);
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
        setIsPanning(false);
    }
    if (currentPath && currentPath.length > 2) {
      onAddDrawing({
        id: createId('path'),
        points: currentPath,
        color: isDarkMode ? '#818cf8' : '#6366f1',
        width: 2
      });
    }
    setCurrentPath(null);
    if (!draggingNodeId) {
      setAlignmentGuides({});
    }
  };

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, id: string) => {
      if(activeTool === 'select' && !isSpacePressed) { 
          e.stopPropagation(); 
          if (e.shiftKey && onToggleNodeSelection) {
              onToggleNodeSelection(id);
              return;
          }
          // If already editing this node, don't drag
          if (editingNodeId === id) return;

          onSelectNode(id); 
          onSelectEdge(null); 
          setDraggingNodeId(id);
          onNodeDragStart?.(id);
      }
  }, [activeTool, isSpacePressed, onSelectNode, onSelectEdge, onNodeDragStart, editingNodeId, onToggleNodeSelection]);

  const handleNodeClick = useCallback((e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.shiftKey) return;
      onOpenInspector();
  }, [onOpenInspector]);
  
  // EDIT Handlers
  const handleNodeEditStart = useCallback((id: string) => {
      setEditingNodeId(id);
  }, []);

  const handleNodeLabelChange = useCallback((id: string, newLabel: string) => {
      const node = nodes.find(n => n.id === id);
      if (node) {
          onUpdateNode({ ...node, label: newLabel });
      }
  }, [nodes, onUpdateNode]);

  const handleNodeEditComplete = useCallback(() => {
      setEditingNodeId(null);
  }, []);


  const handleNodeContextMenu = useCallback((e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      onSelectNode(id);
      if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          setContextMenu({
              x: e.clientX - rect.left, 
              y: e.clientY - rect.top,
              nodeId: id
          });
      }
  }, [onSelectNode]);

  const handlePortClick = useCallback((e: React.MouseEvent, nodeId: string, portIdx: number) => {
    e.stopPropagation();
    if (connecting) {
      if (connecting.id !== nodeId) {
        onConnect(connecting.id, nodeId, connecting.portIdx, portIdx);
      }
      setConnecting(null);
    } else {
      setConnecting({ id: nodeId, portIdx });
    }
  }, [connecting, onConnect]);

  const setContainerRefs = (element: HTMLDivElement | null) => {
    containerRef.current = element;
    onCanvasMount?.(element);
  };

  const getBackgroundStyle = () => {
    const size = 20 * viewport.zoom;
    const offsetX = viewport.x % size;
    const offsetY = viewport.y % size;

    if (gridMode === 'none') return { backgroundColor: isDarkMode ? '#020617' : '#f8fafc' };
    
    if (gridMode === 'lines') {
       const color = isDarkMode ? '#334155' : '#cbd5e1'; 
       return { 
           backgroundColor: isDarkMode ? '#020617' : '#f8fafc',
           backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`, 
           backgroundSize: `${size}px ${size}px`,
           backgroundPosition: `${offsetX}px ${offsetY}px`
        };
    }
    const dotColor = isDarkMode ? '#334155' : '#cbd5e1'; 
    return { 
        backgroundColor: isDarkMode ? '#020617' : '#f8fafc',
        backgroundImage: `radial-gradient(${dotColor} 1px, transparent 1px)`, 
        backgroundSize: `${size}px ${size}px`,
        backgroundPosition: `${offsetX}px ${offsetY}px`
    };
  };

  const handleEdgeSelect = useCallback((id: string) => {
      onSelectEdge(id); 
      onSelectNode(null); 
      onOpenInspector();
  }, [onSelectEdge, onSelectNode, onOpenInspector]);

  const edgeGroups = useMemo(() => {
      const groups: Record<string, string[]> = {};
      edges.forEach(e => {
          const key = [e.sourceId, e.targetId].sort().join('-');
          if(!groups[key]) groups[key] = [];
          groups[key].push(e.id);
      });
      return groups;
  }, [edges]);

  const edgeLabelPositions = useMemo(() => {
      const nodeById = new Map(nodes.map((node) => [node.id, node]));
      const nodeRects = nodes.map((node) => {
        const width =
          node.width ||
          (node.type === EntityType.GATE
            ? 132
            : node.shape === NodeShape.CIRCLE
              ? 80
              : node.shape === NodeShape.DIAMOND
                ? 100
                : NODE_WIDTH);
        const height =
          node.height ||
          (node.type === EntityType.GATE
            ? 36
            : node.shape === NodeShape.CIRCLE
              ? 80
              : node.shape === NodeShape.DIAMOND
                ? 100
                : NODE_HEIGHT);
        return {
          x: node.position.x,
          y: node.position.y,
          width,
          height
        };
      });
      const placed: Array<{ x: number; y: number; width: number; height: number }> = [];
      const result: Record<string, Position> = {};
      const candidateOffsets: Array<{ x: number; y: number }> = [
          { x: 0, y: 0 },
          { x: 0, y: -40 },
          { x: 0, y: 40 },
          { x: 40, y: 0 },
          { x: -40, y: 0 },
          { x: 40, y: -40 },
          { x: -40, y: -40 },
          { x: 40, y: 40 },
          { x: -40, y: 40 },
          { x: 0, y: -80 },
          { x: 0, y: 80 }
      ];

      const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
        !(
          a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y
        );

      edges.forEach((edge) => {
          const railLabel = edge.rail === PaymentRail.OTHER
            ? (edge.customRailLabel || 'Other')
            : (edge.rail === PaymentRail.CARD_NETWORK && edge.cardNetwork ? edge.cardNetwork : edge.rail);
          const primaryLabel = railLabel || edge.label || '';
          if (!primaryLabel) return;

          const source = nodeById.get(edge.sourceId);
          const target = nodeById.get(edge.targetId);
          if (!source || !target) return;

          const groupKey = [edge.sourceId, edge.targetId].sort().join('-');
          const group = edgeGroups[groupKey] || [];
          const offsetIndex = group.indexOf(edge.id);
          const anchor = getEdgeLabelAnchor(edge, source, target, Math.max(offsetIndex, 0), group.length || 1);

          let chosen = { x: anchor.x, y: anchor.y };
          let didPlace = false;
          for (const offset of candidateOffsets) {
              const candidate = {
                  x: anchor.x + offset.x - EDGE_LABEL_WIDTH / 2,
                  y: anchor.y + offset.y - EDGE_LABEL_HEIGHT / 2,
                  width: EDGE_LABEL_WIDTH,
                  height: EDGE_LABEL_HEIGHT
              };
              const overlapsPlacedLabel = placed.some((rect) => overlaps(rect, candidate));
              const overlapsNode = nodeRects.some((rect) => overlaps(rect, candidate));
              if (!overlapsPlacedLabel && !overlapsNode) {
                  chosen = { x: candidate.x + EDGE_LABEL_WIDTH / 2, y: candidate.y + EDGE_LABEL_HEIGHT / 2 };
                  placed.push(candidate);
                  didPlace = true;
                  break;
              }
          }
          if (!didPlace) {
              placed.push({
                x: chosen.x - EDGE_LABEL_WIDTH / 2,
                y: chosen.y - EDGE_LABEL_HEIGHT / 2,
                width: EDGE_LABEL_WIDTH,
                height: EDGE_LABEL_HEIGHT
              });
          }
          result[edge.id] = chosen;
      });

      return result;
  }, [edgeGroups, edges, nodes]);

  const transformStyle = {
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      transformOrigin: '0 0'
  };

  const renderConnectionPreview = () => {
      if (!connecting || isExportMode) return null;
      const startNode = nodes.find((n) => n.id === connecting.id);
      if (!startNode) return null;
      const start = getPortPosition(startNode, connecting.portIdx);
      const end = mousePos;
      
      let pathD = '';
      if (activePathType === 'straight') {
          pathD = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      } else if (activePathType === 'orthogonal') {
          // Simple ortho preview logic: midpoint turn
          const midX = (start.x + end.x) / 2;
          pathD = `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
      } else {
          // Bezier preview
          const midX = (start.x + end.x) / 2;
          const cpOffset = Math.abs(start.x - end.x) > Math.abs(start.y - end.y) ? { x: 0, y: 50 } : { x: 50, y: 0 };
          const p1 = { x: midX + cpOffset.x, y: start.y + cpOffset.y };
          const p2 = { x: midX + cpOffset.x, y: end.y + cpOffset.y };
          pathD = `M ${start.x} ${start.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${end.x} ${end.y}`;
      }

      // Calculate arrow angles for preview
      const angleEnd = Math.atan2(end.y - start.y, end.x - start.x) * (180/Math.PI);
      const angleStart = angleEnd + 180;
      const arrowPath = "M -10 -5 L 0 0 L -10 5 Z";

      return (
          <g className="opacity-60">
              <path 
                 d={pathD} 
                 stroke={activeColor || '#6366f1'} 
                 strokeWidth="2" 
                 strokeDasharray={activeLineStyle === 'dashed' ? "6,4" : activeLineStyle === 'dotted' ? "2,4" : ""}
                 fill="none"
              />
              {(activeArrowMode === 'forward' || activeArrowMode === 'both') && (
                  <g transform={`translate(${end.x}, ${end.y}) rotate(${angleEnd})`}>
                      <path d={arrowPath} fill={activeColor || '#6366f1'} />
                  </g>
              )}
              {(activeArrowMode === 'reverse' || activeArrowMode === 'both') && (
                  <g transform={`translate(${start.x}, ${start.y}) rotate(${angleStart})`}>
                      <path d={arrowPath} fill={activeColor || '#6366f1'} />
                  </g>
              )}
          </g>
      );
  };

  return (
    <div 
      ref={setContainerRefs}
      className={`w-full h-full relative overflow-hidden ${isPanning ? 'cursor-grabbing' : (isSpacePressed ? 'cursor-grab' : 'cursor-default')}`}
      style={getBackgroundStyle()}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => { 
          onSelectNode(null); 
          onSelectEdge(null); 
          setConnecting(null); 
          setEditingNodeId(null);
      }}
    >
      <div className="absolute inset-0 w-full h-full pointer-events-none" style={transformStyle}>
          
          {showSwimlanes && (
            <div className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none opacity-50 -z-10" style={{ transform: 'translate(-1000px, -1000px)' }}> 
               <div className="flex flex-col w-full h-full">
               {Array.from({ length: swimlaneCount }).map((_, i) => (
                 <div key={i} className={`flex-1 border-b border-dashed flex items-start pt-2 px-4 relative ${isDarkMode ? 'border-slate-800' : 'border-slate-300'}`} style={{ height: '300px' }}>
                    <div className={`absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center border-r border-dashed ${isDarkMode ? 'border-slate-800 bg-slate-900/50' : 'border-slate-300 bg-slate-200/50'}`}>
                       <span className="text-xs font-bold text-slate-500 -rotate-90 whitespace-nowrap">LANE {i + 1}</span>
                    </div>
                 </div>
               ))}
               </div>
            </div>
          )}

          <svg className="absolute top-0 left-0 w-full h-full overflow-visible pointer-events-none z-10">
            <defs>
            </defs>
            {drawings.map(d => (
              <path key={d.id} d={`M ${d.points.map(p => `${p.x} ${p.y}`).join(' L ')}`} stroke={d.color} strokeWidth={d.width} fill="none" strokeLinecap="round" />
            ))}
            {currentPath && (
              <path d={`M ${currentPath.map(p => `${p.x} ${p.y}`).join(' L ')}`} stroke={isDarkMode ? '#818cf8' : '#6366f1'} strokeWidth="2" fill="none" strokeLinecap="round" />
            )}
            
            {edges.map(edge => {
                const source = nodes.find(n => n.id === edge.sourceId);
                const target = nodes.find(n => n.id === edge.targetId);
                if(!source || !target) return null;
                
                const groupKey = [edge.sourceId, edge.targetId].sort().join('-');
                const group = edgeGroups[groupKey] || [];
                const index = group.indexOf(edge.id);

                return (
                    <DiagramEdge 
                        key={edge.id}
                        edge={edge}
                        source={source}
                        target={target}
                        isSelected={selectedEdgeId === edge.id}
                        isDarkMode={isDarkMode}
                        onSelect={handleEdgeSelect}
                        offsetIndex={index}
                        totalEdges={group.length}
                        labelPosition={edgeLabelPositions[edge.id]}
                    />
                )
            })}

            {/* ALIGNMENT GUIDES */}
            {alignmentGuides.x !== undefined && (
                <line x1={alignmentGuides.x} y1={-5000} x2={alignmentGuides.x} y2={5000} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,4" />
            )}
            {alignmentGuides.y !== undefined && (
                <line x1={-5000} y1={alignmentGuides.y} x2={5000} y2={alignmentGuides.y} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4,4" />
            )}

            {renderConnectionPreview()}
          </svg>

          {/* Render Nodes inside the Transform Layer but with pointer-events-auto */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {nodes.map(node => (
                <div key={node.id} className="pointer-events-auto">
                    <DiagramNode
                        node={node}
                        isSelected={selectedNodeIds.includes(node.id) || selectedNodeId === node.id}
                        isDarkMode={isDarkMode}
                        blurData={blurData}
                        showPorts={showPorts}
                        connecting={connecting}
                        isExportMode={isExportMode}
                        activeTool={activeTool}
                        onMouseDown={handleNodeMouseDown}
                        onClick={handleNodeClick}
                        onContextMenu={handleNodeContextMenu}
                        onPortClick={handlePortClick}
                        // Edit Props
                        isEditing={editingNodeId === node.id}
                        onEditStart={handleNodeEditStart}
                        onLabelChange={handleNodeLabelChange}
                        onEditComplete={handleNodeEditComplete}
                    />
                </div>
            ))}
          </div>
      </div>

      {/* CONTEXT MENU */}
      {contextMenu && (
          <div 
             className={`absolute z-[100] w-48 rounded-xl border shadow-xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}
             style={{ left: contextMenu.x, top: contextMenu.y }}
             onClick={(e) => e.stopPropagation()}
          >
             <button
               className={`flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-50 text-slate-700'}`}
               onClick={() => {
                   onDuplicateNode(contextMenu.nodeId);
                   setContextMenu(null);
               }}
             >
                 <Copy className="w-4 h-4 text-slate-400" />
                 Duplicate
             </button>
             <button
               className={`flex items-center gap-3 px-3 py-2 text-sm text-left transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-slate-50 text-slate-700'}`}
               onClick={() => {
                   setConnecting({ id: contextMenu.nodeId, portIdx: 1 });
                   setContextMenu(null);
               }}
             >
                 <LinkIcon className="w-4 h-4 text-slate-400" />
                 Start Connection
             </button>
             <button
               className={`flex items-center gap-3 px-3 py-2 text-sm text-left text-rose-500 transition-colors ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
               onClick={() => {
                   onDeleteNode(contextMenu.nodeId);
                   setContextMenu(null);
               }}
             >
                 <Trash2 className="w-4 h-4" />
                 Delete
             </button>
          </div>
      )}
    </div>
  );
};

export default FlowCanvas;
