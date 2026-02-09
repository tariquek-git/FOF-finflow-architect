import React from 'react';
import { 
  Building2, User, Briefcase, CreditCard, Globe, Database, 
  Zap, Server, ArrowRightLeft, Landmark, 
  Type as TypeIcon, ShieldAlert,
  Wallet, Building, CircleDot, BookOpen, ClipboardCheck, PiggyBank
} from 'lucide-react';
import { BankAccountType, CardNetwork, ConnectorPresetKey, Edge, EntityType, EndPointType, FlowDirection, GateCategory, GateControl, PaymentRail, SettlementType, TimingType, TransactionLifecycle } from './types';

export const ENTITY_ICONS: Record<EntityType, React.ReactNode> = {
  // Institutions
  [EntityType.CENTRAL_BANK]: <Landmark className="w-5 h-5 text-slate-900" />,
  [EntityType.SPONSOR_BANK]: <Building2 className="w-5 h-5 text-emerald-600" />,
  [EntityType.ISSUING_BANK]: <Building2 className="w-5 h-5 text-blue-600" />,
  [EntityType.ACQUIRING_BANK]: <Building2 className="w-5 h-5 text-indigo-600" />,
  [EntityType.CORRESPONDENT_BANK]: <Globe className="w-5 h-5 text-cyan-600" />,
  [EntityType.CREDIT_UNION]: <Building className="w-5 h-5 text-teal-600" />,

  // Intermediaries
  [EntityType.PROGRAM_MANAGER]: <Zap className="w-5 h-5 text-amber-500" />,
  [EntityType.PROCESSOR]: <Server className="w-5 h-5 text-slate-500" />,
  [EntityType.GATEWAY]: <ArrowRightLeft className="w-5 h-5 text-violet-500" />,
  [EntityType.NETWORK]: <CreditCard className="w-5 h-5 text-blue-500" />,
  [EntityType.SWITCH]: <ArrowRightLeft className="w-5 h-5 text-orange-500" />,
  [EntityType.WALLET_PROVIDER]: <Wallet className="w-5 h-5 text-purple-600" />,
  [EntityType.LEDGER]: <BookOpen className="w-5 h-5 text-cyan-600" />,
  [EntityType.RECONCILIATION]: <ClipboardCheck className="w-5 h-5 text-emerald-600" />,
  [EntityType.FUNDING_SOURCE]: <PiggyBank className="w-5 h-5 text-amber-600" />,
  
  // Treasury
  [EntityType.GATE]: <ShieldAlert className="w-5 h-5 text-rose-500" />,
  [EntityType.LIQUIDITY_PROVIDER]: <Database className="w-5 h-5 text-blue-800" />,

  // End Points (Default icon, overridden by sub-type in UI)
  [EntityType.END_POINT]: <User className="w-5 h-5 text-slate-700" />,
  
  // Util
  [EntityType.TEXT_BOX]: <TypeIcon className="w-5 h-5 text-slate-400" />,
  [EntityType.ANCHOR]: <CircleDot className="w-4 h-4 text-slate-400" />
};

export const ENDPOINT_ICONS: Record<EndPointType, React.ReactNode> = {
  [EndPointType.CONSUMER]: <User className="w-5 h-5 text-violet-600" />,
  [EndPointType.MERCHANT]: <Briefcase className="w-5 h-5 text-rose-600" />,
  [EndPointType.CORPORATE]: <Building2 className="w-5 h-5 text-slate-700" />,
  [EndPointType.OTHER]: <User className="w-5 h-5 text-slate-500" />,
};

export const BANK_ENTITY_TYPES: EntityType[] = [
  EntityType.SPONSOR_BANK,
  EntityType.ISSUING_BANK,
  EntityType.ACQUIRING_BANK,
  EntityType.CENTRAL_BANK,
  EntityType.CORRESPONDENT_BANK,
  EntityType.CREDIT_UNION
];

export const BANK_ACCOUNT_TYPE_ORDER: BankAccountType[] = [
  BankAccountType.FBO,
  BankAccountType.SETTLEMENT,
  BankAccountType.TREASURY,
  BankAccountType.OPERATING,
  BankAccountType.PREFUND,
  BankAccountType.CUSTODIAL,
  BankAccountType.TRUST
];

export const GATE_CONTROLS_BY_CATEGORY: Record<GateCategory, GateControl[]> = {
  [GateCategory.IDENTITY_ELIGIBILITY]: [
    GateControl.KYC,
    GateControl.KYB,
    GateControl.SANCTIONS,
    GateControl.BENEFICIAL_OWNERSHIP
  ],
  [GateCategory.FINANCIAL_RISK]: [
    GateControl.FRAUD,
    GateControl.VELOCITY_CONTROLS,
    GateControl.SPEND_LIMITS,
    GateControl.MCC_RESTRICTIONS
  ],
  [GateCategory.CREDIT_UNDERWRITING]: [GateControl.CREDIT_DECISIONING],
  [GateCategory.COMPLIANCE]: [
    GateControl.TRANSACTION_MONITORING,
    GateControl.AML_RULES,
    GateControl.REPORTING,
    GateControl.SUSPICIOUS_ACTIVITY
  ]
};

export const RAIL_COLORS: Record<string, string> = {
  // Default/Blank
  [PaymentRail.BLANK]: '#94a3b8',

  // US
  [PaymentRail.ACH]: '#059669', // Emerald
  [PaymentRail.RTP]: '#0891b2', // Cyan
  [PaymentRail.FEDNOW]: '#4f46e5', // Indigo
  [PaymentRail.WIRE]: '#b91c1c', // Red

  // Global
  [PaymentRail.SWIFT]: '#0284c7', // Sky
  [PaymentRail.BANK_TRANSFER]: '#64748b', // Slate

  // Canada
  [PaymentRail.EFT_CANADA]: '#d97706', // Amber
  [PaymentRail.INTERAC]: '#ca8a04', // Yellow

  // Card
  [PaymentRail.CARD_NETWORK]: '#1e293b', // Dark Slate

  // Physical/Other
  [PaymentRail.CASH]: '#854d0e', // Brown
  [PaymentRail.CHEQUE]: '#78716c', // Stone
  [PaymentRail.INTERNAL_LEDGER]: '#6366f1', // Indigo
  [PaymentRail.ON_US]: '#8b5cf6', // Violet
  [PaymentRail.STABLECOIN]: '#10b981', // Emerald
  [PaymentRail.CARRIER_PIGEON]: '#ec4899', // Pink (Why not?)
  [PaymentRail.OTHER]: '#94a3b8'  // Gray
};

export type ConnectorPresetDefinition = {
  key: ConnectorPresetKey;
  label: string;
  description: string;
  defaults: Partial<Edge>;
};

export const CONNECTOR_PRESET_ORDER: ConnectorPresetKey[] = [
  'ach_credit',
  'ach_debit',
  'rtp_instant',
  'fednow_instant',
  'card_auth',
  'card_clearing',
  'wire_settlement',
  'internal_ledger',
  'swift_cross_border'
];

export const CONNECTOR_PRESETS: Record<ConnectorPresetKey, ConnectorPresetDefinition> = {
  custom: {
    key: 'custom',
    label: 'Custom',
    description: 'Manual connector settings',
    defaults: {}
  },
  ach_credit: {
    key: 'ach_credit',
    label: 'ACH Credit',
    description: 'Batch payout/disbursement',
    defaults: {
      rail: PaymentRail.ACH,
      direction: FlowDirection.PUSH,
      timing: TimingType.NEXT_DAY,
      settlementType: SettlementType.NET,
      lifecycle: TransactionLifecycle.SETTLEMENT,
      style: 'dashed',
      showArrowHead: true,
      showMidArrow: false
    }
  },
  ach_debit: {
    key: 'ach_debit',
    label: 'ACH Debit',
    description: 'Pull collections',
    defaults: {
      rail: PaymentRail.ACH,
      direction: FlowDirection.PULL,
      timing: TimingType.NEXT_DAY,
      settlementType: SettlementType.NET,
      lifecycle: TransactionLifecycle.CLEARING,
      style: 'dashed',
      showArrowHead: true,
      showMidArrow: false
    }
  },
  rtp_instant: {
    key: 'rtp_instant',
    label: 'RTP Instant',
    description: 'Real-time credit push',
    defaults: {
      rail: PaymentRail.RTP,
      direction: FlowDirection.PUSH,
      timing: TimingType.INSTANT,
      settlementType: SettlementType.GROSS,
      lifecycle: TransactionLifecycle.SETTLEMENT,
      style: 'solid',
      showArrowHead: true,
      showMidArrow: false
    }
  },
  fednow_instant: {
    key: 'fednow_instant',
    label: 'FedNow Instant',
    description: 'FedNow real-time transfer',
    defaults: {
      rail: PaymentRail.FEDNOW,
      direction: FlowDirection.PUSH,
      timing: TimingType.INSTANT,
      settlementType: SettlementType.GROSS,
      lifecycle: TransactionLifecycle.SETTLEMENT,
      style: 'solid',
      showArrowHead: true,
      showMidArrow: false
    }
  },
  card_auth: {
    key: 'card_auth',
    label: 'Card Auth',
    description: 'Authorization request',
    defaults: {
      rail: PaymentRail.CARD_NETWORK,
      cardNetwork: CardNetwork.VISA,
      direction: FlowDirection.AUTH,
      timing: TimingType.INSTANT,
      lifecycle: TransactionLifecycle.AUTHORIZATION,
      style: 'dotted',
      showArrowHead: true,
      showMidArrow: false
    }
  },
  card_clearing: {
    key: 'card_clearing',
    label: 'Card Clearing',
    description: 'Clearing and settlement',
    defaults: {
      rail: PaymentRail.CARD_NETWORK,
      cardNetwork: CardNetwork.VISA,
      direction: FlowDirection.SETTLEMENT,
      timing: TimingType.NEXT_DAY,
      settlementType: SettlementType.NET,
      lifecycle: TransactionLifecycle.CLEARING,
      style: 'dashed',
      showArrowHead: true,
      showMidArrow: false
    }
  },
  wire_settlement: {
    key: 'wire_settlement',
    label: 'Wire Settlement',
    description: 'High-value final settlement',
    defaults: {
      rail: PaymentRail.WIRE,
      direction: FlowDirection.SETTLEMENT,
      timing: TimingType.SAME_DAY,
      settlementType: SettlementType.GROSS,
      lifecycle: TransactionLifecycle.SETTLEMENT,
      style: 'solid',
      showArrowHead: true,
      showMidArrow: false
    }
  },
  internal_ledger: {
    key: 'internal_ledger',
    label: 'Internal Ledger',
    description: 'On-us ledger movement',
    defaults: {
      rail: PaymentRail.INTERNAL_LEDGER,
      direction: FlowDirection.INTERNAL,
      timing: TimingType.INSTANT,
      lifecycle: TransactionLifecycle.CAPTURE,
      style: 'solid',
      showArrowHead: true,
      showMidArrow: true
    }
  },
  swift_cross_border: {
    key: 'swift_cross_border',
    label: 'SWIFT Cross-Border',
    description: 'Cross-border correspondent flow',
    defaults: {
      rail: PaymentRail.SWIFT,
      direction: FlowDirection.PUSH,
      timing: TimingType.T_PLUS_2,
      settlementType: SettlementType.BI_LATERAL,
      lifecycle: TransactionLifecycle.SETTLEMENT,
      style: 'dashed',
      showArrowHead: true,
      showMidArrow: false,
      isFX: true,
      sourceCurrency: 'USD',
      targetCurrency: 'EUR'
    }
  }
};

// --- BANKING LOGIC: NEXT STEP RECOMMENDATIONS ---
// This acts as the "Domain Brain" to suggest likely next hops.
export const NEXT_STEP_RECOMMENDATIONS: Record<EntityType, EntityType[]> = {
    [EntityType.SPONSOR_BANK]: [EntityType.PROGRAM_MANAGER, EntityType.PROCESSOR, EntityType.CENTRAL_BANK, EntityType.NETWORK],
    [EntityType.ISSUING_BANK]: [EntityType.PROCESSOR, EntityType.NETWORK, EntityType.WALLET_PROVIDER],
    [EntityType.ACQUIRING_BANK]: [EntityType.NETWORK, EntityType.PROCESSOR, EntityType.GATEWAY],
    [EntityType.CENTRAL_BANK]: [EntityType.SPONSOR_BANK, EntityType.CORRESPONDENT_BANK],
    [EntityType.CORRESPONDENT_BANK]: [EntityType.SPONSOR_BANK, EntityType.NETWORK],
    [EntityType.CREDIT_UNION]: [EntityType.CENTRAL_BANK, EntityType.NETWORK],

    [EntityType.PROGRAM_MANAGER]: [EntityType.SPONSOR_BANK, EntityType.PROCESSOR, EntityType.END_POINT],
    [EntityType.PROCESSOR]: [EntityType.NETWORK, EntityType.ISSUING_BANK, EntityType.ACQUIRING_BANK, EntityType.GATEWAY],
    [EntityType.GATEWAY]: [EntityType.PROCESSOR, EntityType.ACQUIRING_BANK, EntityType.END_POINT],
    [EntityType.NETWORK]: [EntityType.ISSUING_BANK, EntityType.ACQUIRING_BANK, EntityType.PROCESSOR],
    [EntityType.SWITCH]: [EntityType.SPONSOR_BANK, EntityType.CENTRAL_BANK],
    [EntityType.WALLET_PROVIDER]: [EntityType.ISSUING_BANK, EntityType.END_POINT],
    [EntityType.LEDGER]: [EntityType.RECONCILIATION, EntityType.SPONSOR_BANK, EntityType.FUNDING_SOURCE],
    [EntityType.RECONCILIATION]: [EntityType.LEDGER, EntityType.SPONSOR_BANK, EntityType.PROGRAM_MANAGER],
    [EntityType.FUNDING_SOURCE]: [EntityType.SPONSOR_BANK, EntityType.ISSUING_BANK, EntityType.LEDGER],

    [EntityType.GATE]: [EntityType.SPONSOR_BANK, EntityType.PROGRAM_MANAGER],
    [EntityType.LIQUIDITY_PROVIDER]: [EntityType.SPONSOR_BANK, EntityType.CORRESPONDENT_BANK],

    [EntityType.END_POINT]: [EntityType.WALLET_PROVIDER, EntityType.GATEWAY, EntityType.SPONSOR_BANK],
    [EntityType.TEXT_BOX]: [],
    [EntityType.ANCHOR]: []
};
