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
  isConnectMode: boolean;
  canConnectFromPorts: boolean;
  connectState: ConnectState;
  candidatePortIdx?: number;
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
    event: React.PointerEvent,
    id: string,
    portIdx: number,
    role: 'source' | 'target' | 'both'
  ) => void;
  zoom: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

const normalizeDisplayToken = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
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
      ? 'border-slate-700/55 bg-slate-950/70'
      : 'border-slate-300/70 bg-white/92';
  }
  if (family === 'ops') {
    return isDarkMode
      ? 'border-slate-700/55 bg-slate-950/70'
      : 'border-slate-300/70 bg-white/92';
  }
  if (family === 'control') {
    return isDarkMode
      ? 'border-slate-700/55 bg-slate-950/70'
      : 'border-slate-300/70 bg-white/92';
  }
  if (family === 'endpoint') {
    return isDarkMode
      ? 'border-slate-700/55 bg-slate-950/70'
      : 'border-slate-300/70 bg-white/92';
  }
  return isDarkMode
    ? 'border-slate-700/55 bg-slate-950/70'
    : 'border-slate-300/70 bg-white/92';
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
  isConnectMode,
  canConnectFromPorts,
  connectState,
  candidatePortIdx,
  isConnecting,
  onMouseDown,
  onClick,
  onContextMenu,
  onPortClick,
  onPortMouseDown,
  zoom
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
    const titleToken = normalizeChipToken(node.label || node.type);
    const combined = [...attributeChips, ...displayItems];
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const item of combined) {
      const normalized = item.trim();
      if (!normalized) continue;
      const token = normalizeChipToken(normalized);
      if (token === titleToken) continue;
      if (seen.has(token)) continue;
      seen.add(token);
      unique.push(normalized);
    }

    return unique;
  }, [attributeChips, displayItems, node.label, node.type]);
  const visibleItems = chipCandidates.slice(0, 3);
  const overflowItems = chipCandidates.slice(3);
  const hiddenCount = overflowItems.length;
  const compactTitle = node.label || node.type;
  const headerTitle = node.label || node.type;
  const showTypeBadge = node.data?.showType ?? true;
  const shouldShowTypeBadge =
    !!semanticBadge &&
    showTypeBadge &&
    normalizeDisplayToken(semanticBadge) !== normalizeDisplayToken(headerTitle);
  const shouldRenderHandles =
    !isLocked &&
    (isConnectMode || connectState !== 'idle' || isSelected || (showPorts && isHovered) || isConnecting);
  const isPortInteractive = canConnectFromPorts || connectState !== 'idle';
  // Keep port hit areas from stealing unrelated UI clicks (e.g. lane header controls)
  // unless the node is actively in a connect-focused state.
  const allowPortPointerEvents =
    isPortInteractive && (isSelected || isConnectMode || connectState !== 'idle' || isConnecting);
  const portHitSize = clamp(26 / Math.max(zoom, 0.01), 8, 60);
  const portHalf = portHitSize / 2;
  const portDotSize = clamp(10 / Math.max(zoom, 0.01), 4, 24);
  const showStatusFooter = showFooter && statuses.length > 0 && (isSelected || isHovered || connectState !== 'idle');

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
  const minDimension = Math.min(width, height);
  const textScale = clamp(Math.min(width / 180, height / 64), 0.76, 1.18);
  const titleFontSize = clamp(12 * textScale, 9.5, 14);
  const compactTitleFontSize = clamp(11 * textScale, 9, 13);
  const chipFontSize = clamp(8 * textScale, 7, 9.5);
  const iconSlotSize = clamp(28 * textScale, 20, 34);
  const iconScale = clamp(textScale, 0.82, 1.15);
  const isTightShape =
    shape === NodeShape.DIAMOND || shape === NodeShape.CIRCLE || shape === NodeShape.SQUARE;
  const isDiamondShape = shape === NodeShape.DIAMOND;
  const isCompactRoundShape = shape === NodeShape.CIRCLE || shape === NodeShape.SQUARE;
  const useCenteredLayout = !compactMode && isTightShape;
  const maxVisibleMetaItems = isTightShape ? (minDimension >= 150 ? 2 : 1) : 3;
  const canShowMetaForShape = isDiamondShape ? false : !isTightShape || minDimension >= 118;
  const canShowStatusForShape = isDiamondShape ? false : !isTightShape || minDimension >= 130;
  const centeredTitleFontSize = isDiamondShape
    ? clamp(titleFontSize * 0.92, 8.8, 12.5)
    : isCompactRoundShape
      ? clamp(titleFontSize * 0.88, 8.4, 11.8)
      : titleFontSize;
  const centeredTitleMaxLines = isDiamondShape || isCompactRoundShape || minDimension < 122 ? 2 : 3;
  const centeredTitleClampClass = centeredTitleMaxLines === 2 ? 'line-clamp-2' : 'line-clamp-3';
  const centeredTitleMaxWidthClass = isDiamondShape
    ? 'max-w-[62%]'
    : isCompactRoundShape
      ? 'max-w-[86%]'
      : 'max-w-[78%]';
  const iconNode =
    node.type === EntityType.END_POINT && node.endPointType
      ? ENDPOINT_ICONS[node.endPointType as EndPointType]
      : ENTITY_ICONS[node.type];

  return (
    <div
      className={`group absolute flex flex-col border shadow-[0_2px_10px_rgba(15,23,42,0.06)] transition-[transform,box-shadow,border-color,opacity] duration-150 will-change-transform ${
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
              : `${isLocked ? '' : 'hover:-translate-y-[1px]'} hover:shadow-[0_10px_22px_rgba(15,23,42,0.10)]`
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
          <div
            className="flex items-center justify-center rounded-md border border-slate-200/65 bg-white/70 dark:border-slate-700/70 dark:bg-slate-900/45"
            style={{ width: `${clamp(iconSlotSize * 0.74, 16, 24)}px`, height: `${clamp(iconSlotSize * 0.74, 16, 24)}px` }}
          >
            <span style={{ transform: `scale(${clamp(iconScale * 0.92, 0.8, 1.08)})` }}>{iconNode}</span>
          </div>
          <span
            data-testid={`node-title-${node.id}`}
            className="truncate font-medium text-slate-700 dark:text-slate-200"
            style={{ fontSize: `${compactTitleFontSize}px`, lineHeight: 1.25 }}
          >
            {compactTitle}
          </span>
        </div>
      ) : useCenteredLayout ? (
        <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3 py-3 text-center">
          {!isDiamondShape && minDimension >= 126 ? (
            <div
              className="flex shrink-0 items-center justify-center rounded-lg border border-slate-200/60 bg-white/70 dark:border-slate-700/65 dark:bg-slate-900/45"
              style={{ width: `${iconSlotSize}px`, height: `${iconSlotSize}px` }}
            >
              <span style={{ transform: `scale(${iconScale})` }}>{iconNode}</span>
            </div>
          ) : null}

          <div
            className={`break-words font-semibold tracking-[0.02em] text-slate-800 dark:text-slate-100 ${centeredTitleClampClass} ${centeredTitleMaxWidthClass}`}
            style={{ fontSize: `${centeredTitleFontSize}px`, lineHeight: 1.18 }}
            data-testid={`node-title-${node.id}`}
          >
            {headerTitle}
          </div>

          {shouldShowTypeBadge && !isDiamondShape && minDimension >= 142 ? (
            <div
              className="inline-flex max-w-[74%] truncate rounded-full border border-slate-200/55 bg-white/65 px-1.5 py-0.5 font-semibold uppercase tracking-[0.06em] text-slate-500 dark:border-slate-700/60 dark:bg-slate-950/45 dark:text-slate-300"
              style={{ fontSize: `${chipFontSize}px` }}
            >
              {semanticBadge}
            </div>
          ) : null}

          {showBodyMeta && displayStyle !== 'hidden' && canShowMetaForShape ? (
            <div data-testid={`node-meta-${node.id}`} className="mt-0.5 flex max-w-[82%] flex-wrap justify-center gap-1">
              {(chipCandidates.slice(0, maxVisibleMetaItems).length > 0
                ? chipCandidates.slice(0, maxVisibleMetaItems)
                : attributeChips.slice(0, maxVisibleMetaItems)
              ).map((chip) => (
                <span
                  key={`${node.id}-${chip}`}
                  className="rounded-full border border-slate-200/55 bg-white/65 px-1.5 py-0.5 font-medium uppercase tracking-[0.05em] text-slate-600 dark:border-slate-700/60 dark:bg-slate-950/45 dark:text-slate-300"
                  style={{ fontSize: `${chipFontSize}px` }}
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2 px-3 pb-1.5 pt-2.5">
            <div
              className="flex shrink-0 items-center justify-center rounded-lg border border-slate-200/60 bg-white/70 dark:border-slate-700/65 dark:bg-slate-900/45"
              style={{ width: `${iconSlotSize}px`, height: `${iconSlotSize}px` }}
            >
              <span style={{ transform: `scale(${iconScale})` }}>{iconNode}</span>
            </div>
            <div className="min-w-0 flex flex-1 items-start justify-between gap-2">
              <div
                className="truncate pt-0.5 font-semibold text-slate-800 dark:text-slate-100"
                style={{ fontSize: `${titleFontSize}px`, lineHeight: 1.2 }}
                data-testid={`node-title-${node.id}`}
              >
                {headerTitle}
              </div>
              {shouldShowTypeBadge ? (
                <div
                  className="inline-flex rounded-full border border-slate-200/55 bg-white/65 px-1.5 py-0.5 font-semibold uppercase tracking-[0.06em] text-slate-500 dark:border-slate-700/60 dark:bg-slate-950/45 dark:text-slate-300"
                  style={{ fontSize: `${chipFontSize}px` }}
                >
                  {semanticBadge}
                </div>
              ) : null}
            </div>
          </div>

          {showBodyMeta && displayStyle !== 'hidden' && canShowMetaForShape ? (
            <div
              data-testid={`node-meta-${node.id}`}
              className="px-2.5 pb-1.5 pt-0.5"
            >
              {displayStyle === 'compact' ? (
                <div className="space-y-0.5">
                  {(visibleItems.length > 0
                    ? visibleItems.slice(0, maxVisibleMetaItems)
                    : attributeChips.slice(0, maxVisibleMetaItems)
                  ).map((item, idx) => (
                    <div
                      key={`${node.id}-compact-${idx}-${item}`}
                      className="truncate text-slate-600 dark:text-slate-300"
                      style={{ fontSize: `${clamp(chipFontSize + 0.8, 8, 10)}px`, lineHeight: 1.2 }}
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
                  {(visibleItems.length > 0
                    ? visibleItems.slice(0, maxVisibleMetaItems)
                    : attributeChips.slice(0, maxVisibleMetaItems)
                  ).map((chip) => (
                    <span
                      key={`${node.id}-${chip}`}
                      className="rounded-full border border-slate-200/55 bg-white/65 px-1.5 py-0.5 font-medium uppercase tracking-[0.05em] text-slate-600 dark:border-slate-700/60 dark:bg-slate-950/45 dark:text-slate-300"
                      style={{ fontSize: `${chipFontSize}px` }}
                    >
                      {chip}
                    </span>
                  ))}
                  {hiddenCount > 0 ? (
                    <span className="group/overflow relative inline-flex">
                      <span className="rounded-full border border-slate-200/55 bg-white/65 px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.05em] text-slate-600 dark:border-slate-700/60 dark:bg-slate-950/45 dark:text-slate-300">
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

          {showStatusFooter && canShowStatusForShape ? (
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
              const isValidCandidate =
                connectState === 'candidate' &&
                isTargetRole &&
                (candidatePortIdx === undefined || candidatePortIdx === portIdx);
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
                  } ${allowPortPointerEvents ? 'pointer-events-auto hover:scale-110 hover:ring-2 hover:ring-cyan-400/55 dark:hover:ring-cyan-300/45' : 'pointer-events-none'}`}
                  style={
                    portIdx === 0
                      ? {
                          left: '50%',
                          top: -portHalf,
                          transform: 'translateX(-50%)',
                          width: portHitSize,
                          height: portHitSize
                        }
                      : portIdx === 1
                        ? {
                            right: -portHalf,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: portHitSize,
                            height: portHitSize
                          }
                        : portIdx === 2
                          ? {
                              left: '50%',
                              bottom: -portHalf,
                              transform: 'translateX(-50%)',
                              width: portHitSize,
                              height: portHitSize
                            }
                          : {
                              left: -portHalf,
                              top: '50%',
                              transform: 'translateY(-50%)',
                              width: portHitSize,
                              height: portHitSize
                            }
                  }
                  data-testid={`node-port-${node.id}-${portIdx}`}
                  data-port-role={role}
                  aria-label={handleLabel}
                  title={handleLabel}
                  onPointerDown={(event) => {
                    if (!isPortInteractive) return;
                    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                      event.currentTarget.releasePointerCapture(event.pointerId);
                    }
                    event.currentTarget.setPointerCapture(event.pointerId);
                    event.stopPropagation();
                    onPortMouseDown(event, node.id, portIdx, role);
                  }}
                  onMouseDown={(event) => {
                    event.stopPropagation();
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
                    style={{ width: portDotSize, height: portDotSize }}
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
