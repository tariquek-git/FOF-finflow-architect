
// 1. ENTITY TYPES (The Nodes)
export enum EntityType {
  // Group A: Institutions
  SPONSOR_BANK = 'Sponsor Bank',
  ISSUING_BANK = 'Issuing Bank',
  ACQUIRING_BANK = 'Acquiring Bank',
  CENTRAL_BANK = 'Central Bank',
  CORRESPONDENT_BANK = 'Correspondent Bank',
  CREDIT_UNION = 'Credit Union',

  // Group B: Intermediaries
  PROGRAM_MANAGER = 'Program Manager',
  PROCESSOR = 'Processor',
  GATEWAY = 'Payment Gateway',
  NETWORK = 'Card Network',
  SWITCH = 'Switch / Clearing',
  WALLET_PROVIDER = 'Wallet Provider',
  LEDGER = 'Ledger',
  RECONCILIATION = 'Reconciliation',
  FUNDING_SOURCE = 'Funding Source',
  
  // Group C: Treasury & Tools
  GATE = 'Compliance Gate',
  LIQUIDITY_PROVIDER = 'Liquidity Provider',
  
  // Group D: End Points
  END_POINT = 'End-Point',
  
  // Utilities
  TEXT_BOX = 'Text Box',
  ANCHOR = 'Anchor Point'
}

// Sub-types for the "End-Point" Entity
export enum EndPointType {
  CONSUMER = 'Consumer',
  MERCHANT = 'Merchant',
  CORPORATE = 'Corporate',
  OTHER = 'Other'
}

export enum BankAccountType {
  FBO = 'FBO',
  SETTLEMENT = 'Settlement',
  TREASURY = 'Treasury',
  OPERATING = 'Operating',
  PREFUND = 'Prefund',
  CUSTODIAL = 'Custodial',
  TRUST = 'Trust'
}

export enum GateCategory {
  IDENTITY_ELIGIBILITY = 'Identity and Eligibility',
  FINANCIAL_RISK = 'Financial Risk',
  CREDIT_UNDERWRITING = 'Credit Decisioning and Underwriting',
  COMPLIANCE = 'Compliance'
}

export enum GateControl {
  KYC = 'KYC',
  KYB = 'KYB',
  SANCTIONS = 'Sanctions',
  BENEFICIAL_OWNERSHIP = 'Beneficial Ownership',
  FRAUD = 'Fraud',
  VELOCITY_CONTROLS = 'Velocity Controls',
  SPEND_LIMITS = 'Spend Limits',
  MCC_RESTRICTIONS = 'MCC Restrictions',
  CREDIT_DECISIONING = 'Credit Decisioning and Underwriting',
  TRANSACTION_MONITORING = 'Transaction Monitoring',
  AML_RULES = 'AML Rules',
  REPORTING = 'Reporting',
  SUSPICIOUS_ACTIVITY = 'Suspicious Activity'
}

// 3. RAIL TYPES (The Edges)
export enum PaymentRail {
  BLANK = '', 
  ACH = 'ACH',
  RTP = 'RTP',
  FEDNOW = 'FedNow',
  WIRE = 'Wire',
  SWIFT = 'SWIFT',
  BANK_TRANSFER = 'Bank Transfer',
  EFT_CANADA = 'EFT (Canada)',
  INTERAC = 'Interac e-Transfer',
  CARD_NETWORK = 'Card Network',
  CASH = 'Cash',
  CHEQUE = 'Cheque',
  INTERNAL_LEDGER = 'Internal Ledger Transfer',
  ON_US = 'On-Us Transfer',
  STABLECOIN = 'Stablecoin',
  CARRIER_PIGEON = 'Carrier Pigeon',
  OTHER = 'Other'
}

export enum CardNetwork {
  VISA = 'Visa',
  MASTERCARD = 'Mastercard',
  AMEX = 'Amex',
  DISCOVER = 'Discover'
}

export enum SettlementType {
  NET = 'Net',
  GROSS = 'Gross',
  BI_LATERAL = 'Bi-Lateral'
}

export enum TransactionLifecycle {
  AUTHORIZATION = 'Authorization',
  CAPTURE = 'Capture',
  CLEARING = 'Clearing',
  SETTLEMENT = 'Settlement',
  REFUND = 'Refund',
  CHARGEBACK = 'Chargeback',
  REVERSAL = 'Reversal'
}

export enum CurrencyPair {
  USD_CAD = 'USD/CAD',
  CAD_USD = 'CAD/USD',
  EUR_USD = 'EUR/USD',
  GBP_USD = 'GBP/USD',
  USD_MXN = 'USD/MXN',
  USD_USDC = 'USD/USDC (Stablecoin)',
  NOT_APPLICABLE = 'N/A'
}

export enum FlowDirection {
  PUSH = 'Push (Credit)',
  PULL = 'Pull (Debit)',
  AUTH = 'Authorization',
  SETTLEMENT = 'Settlement',
  INTERNAL = 'Internal',
  RETURN = 'Return / Refund'
}

export enum NodeShape {
  RECTANGLE = 'rectangle',
  CIRCLE = 'circle',
  CYLINDER = 'cylinder',
  DIAMOND = 'diamond',
}

export enum ArrowType {
  CLASSIC = 'Classic',
  SHARP = 'Sharp',
  OPEN = 'Open',
  CIRCLE = 'Circle',
  DIAMOND = 'Diamond'
}

export enum TimingType {
  INSTANT = 'Instant',
  SAME_DAY = 'Same Day',
  NEXT_DAY = 'Next Day (T+1)',
  T_PLUS_2 = 'T+2',
  T_PLUS_3 = 'T+3'
}

export type ConnectorPresetKey =
  | 'custom'
  | 'ach_credit'
  | 'ach_debit'
  | 'rtp_instant'
  | 'fednow_instant'
  | 'card_auth'
  | 'card_clearing'
  | 'wire_settlement'
  | 'internal_ledger'
  | 'swift_cross_border';

export interface Position {
  x: number;
  y: number;
}

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface Node {
  id: string;
  type: EntityType;
  label: string;
  shape: NodeShape;
  
  // Special Properties
  endPointType?: EndPointType; 
  isPhantom?: boolean; // Ghost mode
  accountTypes?: BankAccountType[];
  ownerOfRecord?: string;
  beneficialOwner?: string;
  onBalanceSheet?: boolean;
  accessRights?: string;
  reconciliationOwner?: string;
  gateCategory?: GateCategory;
  gateChecks?: GateControl[];
  
  position: Position;
  zIndex?: number; // Visual layering
  swimlaneId?: number; // Logical grouping
  
  color?: string;
  borderColor?: string;
  description?: string;
  fontSize?: number;
  width?: number;
  height?: number;
}

export interface Edge {
  id: string;
  sourceId: string;
  targetId: string;
  sourcePortIdx: number;
  targetPortIdx: number;

  // Core Data
  rail: PaymentRail;
  cardNetwork?: CardNetwork; 
  settlementType?: SettlementType;
  lifecycle?: TransactionLifecycle; // New field
  customRailLabel?: string; 
  direction: FlowDirection;

  // FX Data
  isFX: boolean;
  fxPair?: CurrencyPair;
  sourceCurrency?: string;
  targetCurrency?: string;

  // Technical Metadata (New)
  dataSchema?: string; // e.g. ISO20022
  velocityLimit?: string; // e.g. "10k/day"
  volumeLimit?: string; // e.g. "$1M/mo"

  // Visuals
  pathType: 'bezier' | 'orthogonal' | 'straight'; 
  style: 'solid' | 'dashed' | 'dotted';
  color?: string;
  showStartArrow?: boolean; // New
  showArrowHead: boolean; // Acts as End Arrow
  showMidArrow?: boolean;
  thickness?: number;
  arrowType?: ArrowType; // New
  arrowSize?: number; // New: Scale factor (default 1)
  
  // Metadata
  label: string;
  amount?: string;
  timing?: TimingType | string;
  settlementTiming?: TimingType | string;
  netting?: string;
  currency?: string;
  finality?: string;
  cutoffDependency?: string;
  riskOwner?: string;
  fraudLiabilityOwner?: string;
  chargebackExposure?: string;
  disputeWindow?: string;
  dataExchanged?: string;
  dataLatency?: string;
  systemOfRecord?: string;
  showDetailsOnCanvas?: boolean;
  description?: string;
  connectorPreset?: ConnectorPresetKey;
}

export interface DrawingPath {
  id: string;
  points: Position[];
  color: string;
  width: number;
}
