import React, { useMemo } from 'react';
import { ENDPOINT_ICONS, ENTITY_ICONS } from '../../constants';
import { AccountType, EndPointType, EntityType, Node } from '../../types';
import { ANCHOR_SIZE, getNodeDimensions } from './canvasGeometry';

type ConnectState = 'idle' | 'source' | 'candidate';

type DiagramNodeCardProps = {
  node: Node;
  zoom: number;
  isSelected: boolean;
  isDarkMode: boolean;
  showPorts: boolean;
  connectState: ConnectState;
  onMouseDown: (event: React.MouseEvent, id: string) => void;
  onClick: (event: React.MouseEvent, id: string) => void;
  onPortClick: (event: React.MouseEvent, id: string, portIdx: number) => void;
};

const PORT_HIT_SIZE = 22;
const PORT_HALF = PORT_HIT_SIZE / 2;
const PORT_DOT_SIZE = 9;

const getBadge = (node: Node): string | null => {
  if (node.accountType === AccountType.FBO) return 'FBO';

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
    node.accountType === AccountType.SETTLEMENT ||
    node.accountType === AccountType.RESERVE ||
    node.type === EntityType.CENTRAL_BANK
  ) {
    statuses.push('Settlement');
  }

  return statuses;
};

const getFamilyClasses = (family: ReturnType<typeof getNodeFamily>, isDarkMode: boolean) => {
  if (family === 'bank') {
    return isDarkMode
      ? 'border-slate-600 bg-slate-900/95'
      : 'border-slate-300 bg-white';
  }
  if (family === 'ops') {
    return isDarkMode
      ? 'border-cyan-500/35 bg-slate-900/95'
      : 'border-cyan-200 bg-white';
  }
  if (family === 'control') {
    return isDarkMode
      ? 'border-rose-500/35 bg-slate-900/95'
      : 'border-rose-200 bg-white';
  }
  if (family === 'endpoint') {
    return isDarkMode
      ? 'border-violet-500/35 bg-slate-900/95'
      : 'border-violet-200 bg-white';
  }
  return isDarkMode
    ? 'border-slate-700 bg-slate-900/95'
    : 'border-slate-200 bg-white';
};

const getHeaderStripClass = (family: ReturnType<typeof getNodeFamily>) => {
  if (family === 'bank') return 'from-emerald-500/40 to-emerald-400/10';
  if (family === 'ops') return 'from-cyan-500/40 to-cyan-400/10';
  if (family === 'control') return 'from-rose-500/40 to-rose-400/10';
  if (family === 'endpoint') return 'from-violet-500/40 to-violet-400/10';
  return 'from-slate-500/35 to-slate-400/10';
};

const DiagramNodeCardComponent: React.FC<DiagramNodeCardProps> = ({
  node,
  zoom,
  isSelected,
  isDarkMode,
  showPorts,
  connectState,
  onMouseDown,
  onClick,
  onPortClick
}) => {
  const family = getNodeFamily(node.type);
  const semanticBadge = getBadge(node);
  const statuses = useMemo(() => inferStatusChips(node), [node]);
  const compactMode = zoom < 0.35;
  const showBodyMeta = zoom >= 0.6;
  const showFooter = zoom >= 0.45;

  if (node.type === EntityType.ANCHOR) {
    return (
      <div
        className={`absolute cursor-grab rounded-full border shadow-sm transition-transform duration-150 hover:scale-125 active:cursor-grabbing ${
          connectState === 'source'
            ? 'border-emerald-300 bg-emerald-500 ring-2 ring-emerald-300/80'
            : isSelected
              ? 'bg-blue-500 ring-2 ring-blue-300'
              : connectState === 'candidate'
                ? 'border-sky-400 bg-sky-100 ring-2 ring-sky-300/80 dark:bg-sky-500/20'
                : node.isConnectorHandle
                  ? 'border-blue-400 bg-blue-100 dark:bg-blue-500/20'
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
      className={`group absolute flex flex-col rounded-2xl border shadow-[0_8px_20px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color,opacity] duration-150 ${getFamilyClasses(
        family,
        isDarkMode
      )} ${
        connectState === 'source'
          ? 'scale-[1.02] border-emerald-500 ring-2 ring-emerald-300/85 shadow-xl'
          : isSelected
            ? 'scale-[1.02] border-blue-500 ring-2 ring-blue-500/85 shadow-xl'
            : connectState === 'candidate'
              ? 'border-sky-400 ring-2 ring-sky-300/80'
              : 'hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(15,23,42,0.12)]'
      }`}
      style={{
        left: node.position.x,
        top: node.position.y,
        width,
        minHeight: height,
        zIndex: isSelected ? 99 : 10
      }}
      data-node-id={node.id}
      data-node-label={node.label}
      onMouseDown={(event) => onMouseDown(event, node.id)}
      onClick={(event) => onClick(event, node.id)}
    >
      <div className={`h-1.5 w-full rounded-t-2xl bg-gradient-to-r ${getHeaderStripClass(family)}`} />

      {compactMode ? (
        <div className="flex min-h-[42px] items-center gap-1.5 px-2 py-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
            <span className="scale-90">{iconNode}</span>
          </div>
          <span className="truncate text-[10px] font-semibold text-slate-700 dark:text-slate-200">{node.label}</span>
        </div>
      ) : (
        <>
          <div className="flex items-start gap-2 px-2.5 pb-1.5 pt-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              {iconNode}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">{node.label}</div>
              {semanticBadge ? (
                <div className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  {semanticBadge}
                </div>
              ) : null}
            </div>
          </div>

          {showBodyMeta ? (
            <div
              data-testid={`node-meta-${node.id}`}
              className="border-t border-slate-200/90 px-2.5 py-1 text-[9px] text-slate-500 dark:border-slate-700/90 dark:text-slate-400"
            >
              <div className="truncate">Type: {node.type}</div>
              {node.accountType ? <div className="truncate">Ledger: {node.accountType}</div> : null}
            </div>
          ) : null}

          {showFooter && statuses.length > 0 ? (
            <div
              data-testid={`node-status-${node.id}`}
              className="flex flex-wrap items-center gap-1 border-t border-slate-200/90 px-2.5 py-1 dark:border-slate-700/90"
            >
              {statuses.slice(0, 3).map((status) => (
                <span
                  key={`${node.id}-${status}`}
                  className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.06em] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  {status}
                </span>
              ))}
            </div>
          ) : null}
        </>
      )}

      {showPorts
        ? [0, 1, 2, 3].map((portIdx) => (
            <button
              key={portIdx}
              type="button"
              className={`absolute z-50 rounded-full border shadow-sm transition-all ${
                connectState === 'source'
                  ? 'border-emerald-200 bg-emerald-500/25'
                  : connectState === 'candidate'
                    ? 'border-sky-200 bg-sky-500/25'
                    : 'border-white/80 bg-blue-500/20'
              } hover:scale-110 dark:border-slate-800`}
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
              onMouseDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
                onPortClick(event, node.id, portIdx);
              }}
            >
              <span
                className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                  connectState === 'source' ? 'bg-emerald-500' : 'bg-sky-500'
                }`}
                style={{ width: PORT_DOT_SIZE, height: PORT_DOT_SIZE }}
              />
            </button>
          ))
        : null}
    </div>
  );
};

const DiagramNodeCard = React.memo(DiagramNodeCardComponent);
export default DiagramNodeCard;
