import React, { useMemo, useState } from 'react';
import { ENDPOINT_ICONS, ENTITY_ICONS } from '../../constants';
import { EndPointType, EntityType, Node, NodePinnedAttribute, NodeShape } from '../../types';
import { ANCHOR_SIZE, getNodeDimensions, getNodePortRole } from './canvasGeometry';
import {
  getNodeDisplayItems,
  normalizeNodeAccountType,
  resolveNodeBorderColor,
  resolveNodeBorderStyle,
  resolveNodeBorderWidth,
  resolveNodeDisplayStyle,
  resolveNodeFillColor,
  resolveNodeOpacity,
  resolveNodeShape
} from '../../lib/nodeDisplay';

type ConnectState = 'idle' | 'source' | 'candidate';

type DiagramNodeCardProps = {
  node: Node;
  compactMode: boolean;
  showBodyMeta: boolean;
  showFooter: boolean;
  isSelected: boolean;
  isDarkMode: boolean;
  pinnedAttributes: NodePinnedAttribute[];
  showPorts: boolean;
  isConnectToolActive: boolean;
  connectState: ConnectState;
  isConnecting: boolean;
  onMouseDown: (event: React.MouseEvent, id: string) => void;
  onClick: (event: React.MouseEvent, id: string) => void;
  onContextMenu?: (event: React.MouseEvent, id: string) => void;
  onPortClick: (
    event: React.MouseEvent,
    id: string,
    portIdx: number,
    role: 'source' | 'target' | 'both'
  ) => void;
  onPortMouseDown: (
    event: React.MouseEvent,
    id: string,
    portIdx: number,
    role: 'source' | 'target' | 'both'
  ) => void;
};

const PORT_HIT_SIZE = 28;
const PORT_HALF = PORT_HIT_SIZE / 2;
const PORT_DOT_SIZE = 12;

const getNodeAccountType = (node: Node) =>
  normalizeNodeAccountType(node.data?.accountType, node.accountType);

const getBadge = (node: Node): string | null => {
  const accountType = getNodeAccountType(node);
  if (accountType === 'FBO') return 'FBO';

  switch (node.type) {
    case EntityType.ISSUING_BANK:
      return 'Issuer';
    case EntityType.SPONSOR_BANK:
      return 'Sponsor';
    case EntityType.NETWORK:
      return 'Network';
    case EntityType.LIQUIDITY_PROVIDER:
      return 'Ledger';
    case EntityType.GATE:
      return 'Control';
    default:
      return null;
  }
};

const getNodeFamily = (type: EntityType): 'bank' | 'ops' | 'control' | 'endpoint' | 'other' => {
  if (
    type === EntityType.SPONSOR_BANK ||
    type === EntityType.ISSUING_BANK ||
    type === EntityType.ACQUIRING_BANK ||
    type === EntityType.CENTRAL_BANK ||
    type === EntityType.CREDIT_UNION ||
    type === EntityType.CORRESPONDENT_BANK
  ) {
    return 'bank';
  }
  if (
    type === EntityType.PROCESSOR ||
    type === EntityType.NETWORK ||
    type === EntityType.GATEWAY ||
    type === EntityType.SWITCH ||
    type === EntityType.WALLET_PROVIDER ||
    type === EntityType.PROGRAM_MANAGER ||
    type === EntityType.LIQUIDITY_PROVIDER
  ) {
    return 'ops';
  }
  if (type === EntityType.GATE) {
    return 'control';
  }
  if (type === EntityType.END_POINT) {
    return 'endpoint';
  }
  return 'other';
};

const inferStatusChips = (node: Node): string[] => {
  const statuses: string[] = [];
  const accountType = getNodeAccountType(node);

  if (
    node.type === EntityType.END_POINT ||
    node.type === EntityType.ISSUING_BANK ||
    node.type === EntityType.PROGRAM_MANAGER
  ) {
    statuses.push('KYC');
  }

  if (
    node.type === EntityType.GATE ||
    node.type === EntityType.PROCESSOR ||
    node.type === EntityType.SPONSOR_BANK ||
    node.type === EntityType.NETWORK
  ) {
    statuses.push('AML');
  }

  if (
    node.type === EntityType.LIQUIDITY_PROVIDER ||
    accountType === 'Settlement' ||
    accountType === 'Reserve' ||
    node.type === EntityType.CENTRAL_BANK
  ) {
    statuses.push('Settlement');
  }

  return statuses;
};

const normalizeChipToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b(bank|provider|gateway|network)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();

const getPinnedAttributeChips = (node: Node, pins: NodePinnedAttribute[]) => {
  const chips: string[] = [];
  const seen = new Set<string>();
  const uniquePins = Array.from(new Set(pins));
  const accountType = getNodeAccountType(node);
  const pushUnique = (value: string | undefined) => {
    if (!value) return;
    const normalized = value.trim();
    if (!normalized) return;
    const token = normalizeChipToken(normalized);
    if (seen.has(token)) return;
    seen.add(token);
    chips.push(normalized);
  };

  for (const pin of uniquePins) {
    if (pin === 'role') {
      pushUnique(node.type);
    }
    if (pin === 'account' && accountType) {
      pushUnique(accountType);
    }
    if (pin === 'lane' && typeof node.swimlaneId === 'number') {
      pushUnique(`Lane ${node.swimlaneId}`);
    }
    if (pin === 'endpoint' && node.endPointType) {
      pushUnique(node.endPointType);
    }
  }

  return chips.slice(0, 3);
};

const statusDotClass = (status: string, isDarkMode: boolean) => {
  if (status === 'AML') {
    return isDarkMode ? 'bg-emerald-400' : 'bg-emerald-500';
  }
  if (status === 'KYC') {
    return isDarkMode ? 'bg-amber-300' : 'bg-amber-500';
  }
  if (status === 'Settlement') {
    return isDarkMode ? 'bg-sky-300' : 'bg-sky-500';
  }
  return isDarkMode ? 'bg-slate-300' : 'bg-slate-500';
};

const getFamilyClasses = (family: ReturnType<typeof getNodeFamily>, isDarkMode: boolean) => {
  if (family === 'bank') {
    return isDarkMode
      ? 'border-slate-600/75 bg-slate-900/92'
      : 'border-slate-300/80 bg-white/96';
  }
  if (family === 'ops') {
    return isDarkMode
      ? 'border-slate-600/75 bg-slate-900/92'
      : 'border-slate-300/80 bg-white/96';
  }
  if (family === 'control') {
    return isDarkMode
      ? 'border-slate-600/75 bg-slate-900/92'
      : 'border-slate-300/80 bg-white/96';
  }
  if (family === 'endpoint') {
    return isDarkMode
      ? 'border-slate-600/75 bg-slate-900/92'
      : 'border-slate-300/80 bg-white/96';
  }
  return isDarkMode
    ? 'border-slate-600/75 bg-slate-900/92'
    : 'border-slate-300/80 bg-white/96';
};

const getShapeClass = (shape: NodeShape) => {
  if (shape === NodeShape.CIRCLE) return 'rounded-full';
  if (shape === NodeShape.PILL) return 'rounded-[999px]';
  if (shape === NodeShape.ROUNDED_RECTANGLE) return 'rounded-[18px]';
  if (shape === NodeShape.RECTANGLE) return 'rounded-[12px]';
  if (shape === NodeShape.SQUARE) return 'rounded-[10px]';
  if (shape === NodeShape.DIAMOND) return 'rounded-none';
  return 'rounded-[14px]';
};

const DiagramNodeCardComponent: React.FC<DiagramNodeCardProps> = ({
  node,
  compactMode,
  showBodyMeta,
  showFooter,
  isSelected,
  isDarkMode,
  pinnedAttributes,
  showPorts,
  isConnectToolActive,
  connectState,
  isConnecting,
  onMouseDown,
  onClick,
  onContextMenu,
  onPortClick,
  onPortMouseDown
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const family = getNodeFamily(node.type);
  const shape = resolveNodeShape(node);
  const displayStyle = resolveNodeDisplayStyle(node);
  const fillColor = resolveNodeFillColor(node);
  const borderColor = resolveNodeBorderColor(node);
  const borderWidth = resolveNodeBorderWidth(node);
  const borderStyle = resolveNodeBorderStyle(node);
  const opacity = resolveNodeOpacity(node);
  const isLocked = !!node.data?.isLocked;
  const semanticBadge = getBadge(node);
  const statuses = useMemo(() => inferStatusChips(node), [node]);
  const displayItems = useMemo(() => getNodeDisplayItems(node), [node]);
  const attributeChips = useMemo(
    () => getPinnedAttributeChips(node, pinnedAttributes),
    [node, pinnedAttributes]
  );
  const chipCandidates = useMemo(() => {
    const combined = [...attributeChips, ...displayItems];
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const item of combined) {
      const normalized = item.trim();
      if (!normalized) continue;
      const token = normalizeChipToken(normalized);
      if (seen.has(token)) continue;
      seen.add(token);
      unique.push(normalized);
    }

    return unique;
  }, [attributeChips, displayItems]);
  const visibleItems = chipCandidates.slice(0, 3);
  const overflowItems = chipCandidates.slice(3);
  const hiddenCount = overflowItems.length;
  const compactTitle = node.label || node.type;
  const headerTitle = node.label || node.type;
  const showTypeBadge = node.data?.showType ?? true;
  const shouldRenderHandles =
    !isLocked &&
    (isConnectToolActive || connectState !== 'idle' || isSelected || (showPorts && isHovered) || isConnecting);
  const isPortInteractive = isConnectToolActive || connectState !== 'idle';

  if (node.type === EntityType.ANCHOR) {
    return (
      <div
        className={`absolute cursor-grab rounded-full border shadow-sm transition-transform duration-150 hover:scale-125 active:cursor-grabbing ${
          connectState === 'source'
            ? 'border-emerald-300 bg-emerald-500 ring-2 ring-emerald-300/80'
            : isSelected
              ? 'bg-cyan-500 ring-2 ring-cyan-300'
              : connectState === 'candidate'
                ? 'border-sky-400 bg-sky-100 ring-2 ring-sky-300/80 dark:bg-sky-500/20'
                : node.isConnectorHandle
                  ? 'border-cyan-400 bg-cyan-100 dark:bg-cyan-500/20'
                  : isDarkMode
                    ? 'border-slate-500 bg-slate-500'
                    : 'border-slate-400 bg-slate-400'
        }`}
        style={{ left: node.position.x, top: node.position.y, width: ANCHOR_SIZE, height: ANCHOR_SIZE, zIndex: 100 }}
        onMouseDown={(event) => onMouseDown(event, node.id)}
      />
    );
  }

  const { width, height } = getNodeDimensions(node);
  const iconNode =
    node.type === EntityType.END_POINT && node.endPointType
      ? ENDPOINT_ICONS[node.endPointType as EndPointType]
      : ENTITY_ICONS[node.type];

  return (
    <div
      className={`group absolute flex flex-col border shadow-[0_5px_14px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color,opacity] duration-150 will-change-transform ${
        isLocked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
      } ${getShapeClass(
        shape
      )} ${getFamilyClasses(family, isDarkMode)} ${
        connectState === 'source'
          ? 'scale-[1.01] border-emerald-500 ring-2 ring-emerald-300/80 shadow-[0_10px_24px_rgba(16,185,129,0.2)]'
          : isSelected
            ? 'scale-[1.01] border-[var(--ff-accent-primary)] ring-2 ring-[color-mix(in_srgb,var(--ff-accent-primary)_30%,transparent)] shadow-[0_10px_24px_rgba(79,70,229,0.2)]'
            : connectState === 'candidate'
              ? 'border-sky-400 ring-2 ring-sky-300/80'
              : `${isLocked ? '' : 'hover:-translate-y-[1px]'} hover:shadow-[0_10px_22px_rgba(15,23,42,0.12)]`
      }`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width,
        minHeight: height,
        zIndex: isSelected ? 99 : 10,
        backgroundColor: fillColor || undefined,
        borderColor: borderColor || undefined,
        borderWidth: `${borderWidth}px`,
        borderStyle,
        opacity: opacity / 100,
        clipPath:
          shape === NodeShape.DIAMOND ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' : undefined
      }}
      data-node-id={node.id}
      data-node-label={node.label}
      data-invalid-state={node.label.trim().length === 0 ? 'true' : 'false'}
      data-locked={isLocked ? 'true' : 'false'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={(event) => onMouseDown(event, node.id)}
      onClick={(event) => onClick(event, node.id)}
      onContextMenu={(event) => onContextMenu?.(event, node.id)}
    >
      {compactMode ? (
        <div className="flex min-h-[40px] items-center gap-1.5 px-2 py-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-200/75 bg-slate-50/85 dark:border-slate-700/80 dark:bg-slate-800/85">
            <span className="scale-90">{iconNode}</span>
          </div>
          <span className="truncate text-[11px] font-medium text-slate-700 dark:text-slate-200">{compactTitle}</span>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2 px-3 pb-1.5 pt-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200/75 bg-slate-50/90 dark:border-slate-700/80 dark:bg-slate-800/90">
              {iconNode}
            </div>
            <div className="min-w-0 flex flex-1 items-start justify-between gap-2">
              <div className="truncate pt-0.5 text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                {headerTitle}
              </div>
              {semanticBadge && showTypeBadge ? (
                <div className="inline-flex rounded-full border border-slate-200/70 bg-slate-50/85 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:border-slate-700/80 dark:bg-slate-800/85 dark:text-slate-300">
                  {semanticBadge}
                </div>
              ) : null}
            </div>
          </div>

          {showBodyMeta && displayStyle !== 'hidden' ? (
            <div
              data-testid={`node-meta-${node.id}`}
              className="px-2.5 pb-1.5 pt-0.5"
            >
              {displayStyle === 'compact' ? (
                <div className="space-y-0.5">
                  {(visibleItems.length > 0 ? visibleItems : attributeChips.slice(0, 3)).map((item, idx) => (
                    <div
                      key={`${node.id}-compact-${idx}-${item}`}
                      className="truncate text-[9px] text-slate-600 dark:text-slate-300"
                    >
                      {item}
                    </div>
                  ))}
                  {hiddenCount > 0 ? (
                    <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">
                      +{hiddenCount} more
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {(visibleItems.length > 0 ? visibleItems : attributeChips.slice(0, 3)).map((chip) => (
                    <span
                      key={`${node.id}-${chip}`}
                      className="rounded-full border border-slate-200/70 bg-slate-50/85 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.05em] text-slate-600 dark:border-slate-700/80 dark:bg-slate-800/85 dark:text-slate-300"
                    >
                      {chip}
                    </span>
                  ))}
                  {hiddenCount > 0 ? (
                    <span className="group/overflow relative inline-flex">
                      <span className="rounded-full border border-slate-200/70 bg-slate-50/85 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.05em] text-slate-600 dark:border-slate-700/80 dark:bg-slate-800/85 dark:text-slate-300">
                        +{hiddenCount}
                      </span>
                      <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden min-w-[7rem] rounded-md border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-600 shadow-lg group-hover/overflow:block dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        {overflowItems.join(' • ')}
                      </span>
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          ) : null}

          {showFooter && statuses.length > 0 ? (
            <div
              data-testid={`node-status-${node.id}`}
              className="flex items-center gap-1.5 px-3 pb-1.5 pt-0.5"
            >
              {statuses.slice(0, 3).map((status) => (
                <div
                  key={`${node.id}-${status}`}
                  title={status}
                  aria-hidden="true"
                  className="inline-flex items-center gap-1"
                >
                  <span className={`h-2 w-2 rounded-full ${statusDotClass(status, isDarkMode)}`} />
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}

      {shouldRenderHandles
        ? [0, 1, 2, 3].map((portIdx) => (
            (() => {
              const role = getNodePortRole(node, portIdx);
              if (!role) return null;

              const isSourceRole = role === 'source' || role === 'both';
              const isTargetRole = role === 'target' || role === 'both';
              const isSourceLocked = connectState === 'source' && isSourceRole;
              const isValidCandidate = connectState === 'candidate' && isTargetRole;
              const sideLabel =
                portIdx === 0 ? 'top' : portIdx === 1 ? 'right' : portIdx === 2 ? 'bottom' : 'left';
              const nodeLabel = node.label || node.type;
              const handleLabel = `${
                isSourceRole && isTargetRole ? 'Source and target' : isSourceRole ? 'Source' : 'Target'
              } handle (${sideLabel}) on ${nodeLabel}`;

              return (
                <button
                  key={portIdx}
                  type="button"
                  className={`absolute z-50 rounded-full border shadow-sm transition-all duration-150 ${
                    isSourceLocked
                      ? 'border-emerald-300 bg-emerald-500/25 ring-2 ring-emerald-300/55'
                      : isValidCandidate
                        ? 'border-sky-300 bg-sky-500/25 ring-2 ring-sky-300/60'
                        : isDarkMode
                          ? 'border-slate-600/80 bg-slate-900/78'
                          : 'border-slate-300/85 bg-white/88'
                  } ${isPortInteractive ? 'pointer-events-auto hover:scale-110 hover:ring-2 hover:ring-cyan-400/55 dark:hover:ring-cyan-300/45' : 'pointer-events-none'}`}
                  style={
                    portIdx === 0
                      ? {
                          left: '50%',
                          top: -PORT_HALF,
                          transform: 'translateX(-50%)',
                          width: PORT_HIT_SIZE,
                          height: PORT_HIT_SIZE
                        }
                      : portIdx === 1
                        ? {
                            right: -PORT_HALF,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: PORT_HIT_SIZE,
                            height: PORT_HIT_SIZE
                          }
                        : portIdx === 2
                          ? {
                              left: '50%',
                              bottom: -PORT_HALF,
                              transform: 'translateX(-50%)',
                              width: PORT_HIT_SIZE,
                              height: PORT_HIT_SIZE
                            }
                          : {
                              left: -PORT_HALF,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: PORT_HIT_SIZE,
                              height: PORT_HIT_SIZE
                            }
                  }
                  data-testid={`node-port-${node.id}-${portIdx}`}
                  data-port-role={role}
                  aria-label={handleLabel}
                  title={handleLabel}
                  onMouseDown={(event) => {
                    if (!isPortInteractive) return;
                    event.stopPropagation();
                    onPortMouseDown(event, node.id, portIdx, role);
                  }}
                  onClick={(event) => {
                    if (!isPortInteractive) return;
                    event.stopPropagation();
                    onPortClick(event, node.id, portIdx, role);
                  }}
                >
                  <span className="sr-only">{handleLabel}</span>
                  <span
                    className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                      isSourceLocked
                        ? 'bg-emerald-500'
                        : isValidCandidate
                          ? 'bg-sky-500'
                          : isSourceRole
                            ? 'bg-cyan-500'
                            : 'bg-indigo-500'
                    }`}
                    style={{ width: PORT_DOT_SIZE, height: PORT_DOT_SIZE }}
                  />
                </button>
              );
            })()
          ))
        : null}
    </div>
  );
};

const DiagramNodeCard = React.memo(DiagramNodeCardComponent);
export default DiagramNodeCard;
