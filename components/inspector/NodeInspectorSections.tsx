import React, { useMemo, useState } from 'react';
import { UseFormRegister, UseFormSetValue } from 'react-hook-form';
import {
  Layers,
  Landmark,
  Palette,
  ShieldCheck,
  Sparkles,
  Tags,
  Wrench
} from 'lucide-react';
import {
  EntityType,
  NodeAccountType,
  NodeBorderStyle,
  NodeDisplayStyle,
  NodePinnedAttribute,
  NodeShape,
  NODE_ACCOUNT_TYPE_OPTIONS
} from '../../types';
import type { NodeMetaFields } from '../../lib/nodeMeta';
import {
  DEFAULT_NODE_BORDER_STYLE,
  DEFAULT_NODE_BORDER_WIDTH,
  DEFAULT_NODE_OPACITY,
  DEFAULT_NODE_SCALE,
  defaultAccountDetailsPlaceholder
} from '../../lib/nodeDisplay';
import { getNodeInspectorProfile } from '../../lib/inspectorProfiles';
import ColorPicker from './primitives/ColorPicker';
import PropertyRow from './primitives/PropertyRow';
import SectionAccordion from './primitives/SectionAccordion';
import ShapePicker from './primitives/ShapePicker';
import ToggleRow from './primitives/ToggleRow';

type NodeFormValues = {
  label: string;
  type: EntityType | '';
  accountType?: NodeAccountType | '';
  accountDetails?: string;
  description?: string;
  notes?: string;
  showLabel: boolean;
  showType: boolean;
  showAccount: boolean;
  showAccountDetails: boolean;
  displayStyle: NodeDisplayStyle | '';
  shape: NodeShape;
  fillColor?: string;
  borderColor?: string;
  borderWidth: number;
  borderStyle: NodeBorderStyle | '';
  opacity: number;
  isPhantom: boolean;
  isLocked: boolean;
  scale: number;
};

type DisplayPreset = 'minimal' | 'standard' | 'detailed' | 'custom';

type NodeInspectorSectionsProps = {
  register: UseFormRegister<NodeFormValues>;
  setValue: UseFormSetValue<NodeFormValues>;
  values: NodeFormValues;
  isNameAuto: boolean;
  nodeDetailsOpen: boolean;
  onToggleNodeDetails: () => void;
  nodeMeta: NodeMetaFields;
  onNodeMetaChange: (key: keyof NodeMetaFields, value: string) => void;
  pinnedNodeAttributes: NodePinnedAttribute[];
  onTogglePinnedNodeAttribute: (attribute: NodePinnedAttribute) => void;
  onResetNodeSection?: () => void;
  onApplyNodeSection?: () => void;
  onNotesBlur?: () => void;
};

const NODE_FIELD_IDS = {
  label: 'node-field-label',
  type: 'node-field-type',
  description: 'node-field-description',
  accountType: 'node-field-account-type',
  accountDetails: 'node-field-account-details',
  displayStyle: 'node-field-display-style',
  displayPreset: 'node-field-display-preset',
  borderStyle: 'node-field-border-style',
  borderWidth: 'node-field-border-width',
  opacity: 'node-field-opacity',
  scale: 'node-field-scale',
  notes: 'node-field-notes',
  custodyHolder: 'node-field-custody-holder',
  ledgerType: 'node-field-ledger-type',
  balanceModel: 'node-field-balance-model',
  postingTiming: 'node-field-posting-timing',
  kycOwner: 'node-field-kyc-owner',
  amlMonitoring: 'node-field-aml-monitoring',
  fraudControls: 'node-field-fraud-controls',
  tags: 'node-field-tags',
  externalRefs: 'node-field-external-refs'
} as const;

const PINNED_FIELD_OPTIONS: Array<{ id: NodePinnedAttribute; label: string }> = [
  { id: 'role', label: 'Type' },
  { id: 'account', label: 'Account' },
  { id: 'lane', label: 'Lane' },
  { id: 'endpoint', label: 'Endpoint' }
];

const inferDisplayPreset = (values: NodeFormValues): DisplayPreset => {
  const style = values.displayStyle || 'chips';
  if (
    !values.showLabel &&
    values.showType &&
    !values.showAccount &&
    !values.showAccountDetails &&
    style === 'chips'
  ) {
    return 'minimal';
  }
  if (
    !values.showLabel &&
    values.showType &&
    values.showAccount &&
    !values.showAccountDetails &&
    style === 'chips'
  ) {
    return 'standard';
  }
  if (
    values.showLabel &&
    values.showType &&
    values.showAccount &&
    values.showAccountDetails &&
    style === 'compact'
  ) {
    return 'detailed';
  }
  return 'custom';
};

const mergeClasses = (...classNames: Array<string | undefined>) => classNames.filter(Boolean).join(' ');

const normalizeTypeToken = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

const ENTITY_TYPE_LOOKUP = new Map(
  Object.values(EntityType).map((type) => [normalizeTypeToken(type), type] as const)
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input {...props} className={mergeClasses('ui-input inspector-input', className)} />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className, ...props }) => (
  <select {...props} className={mergeClasses('ui-input inspector-input inspector-select', className)}>
    {props.children}
  </select>
);

const NodeInspectorSections: React.FC<NodeInspectorSectionsProps> = ({
  register,
  setValue,
  values,
  isNameAuto,
  nodeDetailsOpen,
  onToggleNodeDetails,
  nodeMeta,
  onNodeMetaChange,
  pinnedNodeAttributes,
  onTogglePinnedNodeAttribute,
  onResetNodeSection,
  onApplyNodeSection,
  onNotesBlur
}) => {
  const [identityOpen, setIdentityOpen] = useState(true);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [displayAdvancedOpen, setDisplayAdvancedOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [behaviorOpen, setBehaviorOpen] = useState(true);
  const [complianceOpen, setComplianceOpen] = useState(false);
  const [metadataOpen, setMetadataOpen] = useState(false);

  const isLocked = !!values.isLocked;

  const accountDetailsPlaceholder = useMemo(
    () => defaultAccountDetailsPlaceholder(values.accountType),
    [values.accountType]
  );
  const nodeProfile = useMemo(() => getNodeInspectorProfile(values.type), [values.type]);
  const activeDisplayPreset = useMemo(() => inferDisplayPreset(values), [values]);
  const notesField = register('notes');
  const labelField = register('label');
  const typeField = register('type');

  const applyDisplayPreset = (preset: Exclude<DisplayPreset, 'custom'>) => {
    if (preset === 'minimal') {
      setValue('showLabel', false, { shouldDirty: true, shouldValidate: true });
      setValue('showType', true, { shouldDirty: true, shouldValidate: true });
      setValue('showAccount', false, { shouldDirty: true, shouldValidate: true });
      setValue('showAccountDetails', false, { shouldDirty: true, shouldValidate: true });
      setValue('displayStyle', 'chips', { shouldDirty: true, shouldValidate: true });
      return;
    }

    if (preset === 'standard') {
      setValue('showLabel', false, { shouldDirty: true, shouldValidate: true });
      setValue('showType', true, { shouldDirty: true, shouldValidate: true });
      setValue('showAccount', true, { shouldDirty: true, shouldValidate: true });
      setValue('showAccountDetails', false, { shouldDirty: true, shouldValidate: true });
      setValue('displayStyle', 'chips', { shouldDirty: true, shouldValidate: true });
      return;
    }

    setValue('showLabel', true, { shouldDirty: true, shouldValidate: true });
    setValue('showType', true, { shouldDirty: true, shouldValidate: true });
    setValue('showAccount', true, { shouldDirty: true, shouldValidate: true });
    setValue('showAccountDetails', true, { shouldDirty: true, shouldValidate: true });
    setValue('displayStyle', 'compact', { shouldDirty: true, shouldValidate: true });
  };

  const setBorderWidth = (next: number) => {
    setValue('borderWidth', Math.min(8, Math.max(1, next)), {
      shouldDirty: true,
      shouldValidate: true
    });
  };

  const setOpacity = (next: number) => {
    setValue('opacity', Math.min(100, Math.max(0, next)), {
      shouldDirty: true,
      shouldValidate: true
    });
  };

  const setScale = (nextPercent: number) => {
    const normalized = Math.min(2, Math.max(0.6, nextPercent / 100));
    setValue('scale', normalized, {
      shouldDirty: true,
      shouldValidate: true
    });
  };

  const resetStyling = () => {
    setValue('shape', NodeShape.RECTANGLE, { shouldDirty: true, shouldValidate: true });
    setValue('fillColor', '#ffffff', { shouldDirty: true, shouldValidate: true });
    setValue('borderColor', '#d7e1ee', { shouldDirty: true, shouldValidate: true });
    setValue('borderWidth', DEFAULT_NODE_BORDER_WIDTH, { shouldDirty: true, shouldValidate: true });
    setValue('borderStyle', DEFAULT_NODE_BORDER_STYLE, { shouldDirty: true, shouldValidate: true });
    setValue('opacity', DEFAULT_NODE_OPACITY, { shouldDirty: true, shouldValidate: true });
    setValue('scale', DEFAULT_NODE_SCALE, { shouldDirty: true, shouldValidate: true });
  };

  return (
    <>
      <SectionAccordion
        title="Node Properties"
        icon={<Sparkles className="h-3.5 w-3.5" />}
        isOpen={identityOpen}
        onToggle={() => setIdentityOpen((prev) => !prev)}
      >
        <PropertyRow label="Node Name" htmlFor={NODE_FIELD_IDS.label}>
          <Input
            id={NODE_FIELD_IDS.label}
            disabled={isLocked}
            {...labelField}
            onChange={(event) => {
              labelField.onChange(event);
              const nextRaw = event.target.value || '';
              const nextTrimmed = nextRaw.trim();
              if (!nextTrimmed) {
                setValue('label', values.type || 'Node', { shouldDirty: true, shouldValidate: true });
                return;
              }
              const matchedType = ENTITY_TYPE_LOOKUP.get(normalizeTypeToken(nextTrimmed));
              if (matchedType) {
                setValue('type', matchedType, { shouldDirty: true, shouldValidate: true });
                if (nextTrimmed !== matchedType) {
                  setValue('label', matchedType, { shouldDirty: true, shouldValidate: true });
                }
              }
            }}
            onBlur={(event) => {
              labelField.onBlur(event);
              const nextTrimmed = event.target.value.trim();
              if (!nextTrimmed) {
                setValue('label', values.type || 'Node', { shouldDirty: true, shouldValidate: true });
              }
            }}
          />
        </PropertyRow>

        <PropertyRow label="Node Type" htmlFor={NODE_FIELD_IDS.type}>
          <Select
            id={NODE_FIELD_IDS.type}
            disabled={isLocked}
            {...typeField}
            onChange={(event) => {
              typeField.onChange(event);
              const nextType = (event.target.value as EntityType | '') || '';
              const shouldSyncName =
                isNameAuto ||
                !values.label.trim() ||
                normalizeTypeToken(values.label) === normalizeTypeToken(values.type || '');
              if (shouldSyncName) {
                setValue('label', nextType, { shouldDirty: true, shouldValidate: true });
              }
            }}
          >
            <option value="">Blank</option>
            {Object.values(EntityType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </PropertyRow>

        <PropertyRow
          label="Notes"
          htmlFor={NODE_FIELD_IDS.notes}
          helper="Optional context. Duplicate Name/Type text is auto-cleaned."
        >
          <textarea
            id={NODE_FIELD_IDS.notes}
            disabled={isLocked}
            {...notesField}
            onBlur={(event) => {
              notesField.onBlur(event);
              onNotesBlur?.();
            }}
            className="ui-input inspector-textarea"
            placeholder="Add context, assumptions, IDs, links…"
          />
        </PropertyRow>

        <PropertyRow label="Description" htmlFor={NODE_FIELD_IDS.description}>
          <textarea
            id={NODE_FIELD_IDS.description}
            disabled={isLocked}
            {...register('description')}
            className="ui-input inspector-textarea"
            placeholder="Operational context and workflow notes..."
          />
        </PropertyRow>

        <div className="mt-1 space-y-2 rounded-md bg-slate-50/65 px-2.5 py-2 dark:bg-slate-900/45">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-700 dark:text-cyan-300">
              {nodeProfile.title} profile
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-slate-600 dark:text-slate-300">{nodeProfile.summary}</p>
          </div>
          <div className="h-px bg-slate-200/70 dark:bg-slate-700/70" />
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            Account
          </div>
          <PropertyRow
            label={nodeProfile.fieldLabels.accountType}
            htmlFor={NODE_FIELD_IDS.accountType}
            helper={nodeProfile.fieldHelpers.accountType}
          >
            <Select id={NODE_FIELD_IDS.accountType} disabled={isLocked} {...register('accountType')}>
              <option value="">None</option>
              {NODE_ACCOUNT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </PropertyRow>

          <PropertyRow label="Account Details" htmlFor={NODE_FIELD_IDS.accountDetails}>
            <Input
              id={NODE_FIELD_IDS.accountDetails}
              disabled={isLocked}
              placeholder={accountDetailsPlaceholder}
              {...register('accountDetails')}
            />
          </PropertyRow>
        </div>
      </SectionAccordion>

      <SectionAccordion
        title="Node Display"
        icon={<Layers className="h-3.5 w-3.5" />}
        isOpen={displayOpen}
        onToggle={() => setDisplayOpen((prev) => !prev)}
      >
        <PropertyRow
          label="Display Preset"
          htmlFor={NODE_FIELD_IDS.displayPreset}
          helper="Minimal shows type only. Standard shows type + account. Detailed includes all fields."
        >
          <Select
            id={NODE_FIELD_IDS.displayPreset}
            value={activeDisplayPreset === 'custom' ? '' : activeDisplayPreset}
            disabled={isLocked}
            onChange={(event) => {
              const next = event.target.value as Exclude<DisplayPreset, 'custom'> | '';
              if (!next) return;
              applyDisplayPreset(next);
            }}
          >
            <option value="">Custom</option>
            <option value="minimal">Minimal</option>
            <option value="standard">Standard</option>
            <option value="detailed">Detailed</option>
          </Select>
        </PropertyRow>

        <PropertyRow label="Pinned Fields" helper="Choose up to 3 fields shown as node chips.">
          <div className="flex flex-wrap gap-1.5">
            {PINNED_FIELD_OPTIONS.map((option) => {
              const selected = pinnedNodeAttributes.includes(option.id);
              const disableSelectMore = !selected && pinnedNodeAttributes.length >= 3;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onTogglePinnedNodeAttribute(option.id)}
                  disabled={isLocked || disableSelectMore}
                  aria-pressed={selected}
                  className={`status-chip !h-7 !px-2.5 ${selected ? 'is-active' : ''} ${
                    isLocked || disableSelectMore ? 'cursor-not-allowed opacity-50' : ''
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </PropertyRow>

        <ToggleRow
          label="Advanced"
          helper="Show individual field visibility toggles."
          enabled={displayAdvancedOpen}
          onToggle={(next) => setDisplayAdvancedOpen(next)}
          disabled={isLocked}
        />

        {displayAdvancedOpen ? (
          <>
            <ToggleRow
              label="Show Label"
              enabled={!!values.showLabel}
              onToggle={(next) =>
                setValue('showLabel', next, {
                  shouldDirty: true,
                  shouldValidate: true
                })
              }
              disabled={isLocked}
            />
            <ToggleRow
              label="Show Type"
              enabled={!!values.showType}
              onToggle={(next) =>
                setValue('showType', next, {
                  shouldDirty: true,
                  shouldValidate: true
                })
              }
              disabled={isLocked}
            />
            <ToggleRow
              label="Show Account"
              enabled={!!values.showAccount}
              onToggle={(next) =>
                setValue('showAccount', next, {
                  shouldDirty: true,
                  shouldValidate: true
                })
              }
              disabled={isLocked}
            />
            <ToggleRow
              label="Show Account Details"
              enabled={!!values.showAccountDetails}
              onToggle={(next) =>
                setValue('showAccountDetails', next, {
                  shouldDirty: true,
                  shouldValidate: true
                })
              }
              disabled={isLocked}
            />

            <PropertyRow label="Display Style" htmlFor={NODE_FIELD_IDS.displayStyle}>
              <Select id={NODE_FIELD_IDS.displayStyle} disabled={isLocked} {...register('displayStyle')}>
                <option value="">Select display style</option>
                <option value="chips">Chips</option>
                <option value="compact">Compact rows</option>
                <option value="hidden">Hidden</option>
              </Select>
            </PropertyRow>
          </>
        ) : null}
      </SectionAccordion>

      <SectionAccordion
        title="Appearance"
        icon={<Palette className="h-3.5 w-3.5" />}
        isOpen={appearanceOpen}
        onToggle={() => setAppearanceOpen((prev) => !prev)}
        actions={
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              resetStyling();
            }}
            className="status-chip !h-6 !px-2 !text-[10px]"
          >
            Reset styling
          </button>
        }
      >
        <PropertyRow label="Shape preset">
          <ShapePicker
            value={values.shape}
            onChange={(next) =>
              setValue('shape', next, {
                shouldDirty: true,
                shouldValidate: true
              })
            }
            disabled={isLocked}
          />
        </PropertyRow>

        <PropertyRow label="Colors" helper="Use the tabs to switch fill vs border colors.">
          <ColorPicker
            fillColor={values.fillColor || '#ffffff'}
            borderColor={values.borderColor || '#d7e1ee'}
            onChangeFill={(hex) =>
              setValue('fillColor', hex, {
                shouldDirty: true,
                shouldValidate: true
              })
            }
            onChangeBorder={(hex) =>
              setValue('borderColor', hex, {
                shouldDirty: true,
                shouldValidate: true
              })
            }
            disabled={isLocked}
          />
        </PropertyRow>

        <PropertyRow label="Border thickness" htmlFor={NODE_FIELD_IDS.borderWidth}>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setBorderWidth(size)}
                  aria-pressed={values.borderWidth === size}
                  disabled={isLocked}
                  className={`status-chip !h-7 !px-2.5 ${values.borderWidth === size ? 'is-active' : ''}`}
                >
                  {size}
                </button>
              ))}
            </div>
            <input
              id={NODE_FIELD_IDS.borderWidth}
              type="range"
              min={1}
              max={8}
              value={values.borderWidth}
              disabled={isLocked}
              onChange={(event) => setBorderWidth(Number(event.target.value))}
              className="w-full"
            />
          </div>
        </PropertyRow>

        <PropertyRow label="Border style" htmlFor={NODE_FIELD_IDS.borderStyle}>
          <Select id={NODE_FIELD_IDS.borderStyle} disabled={isLocked} {...register('borderStyle')}>
            <option value="">Select border style</option>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </Select>
        </PropertyRow>

        <PropertyRow label="Opacity" htmlFor={NODE_FIELD_IDS.opacity}>
          <div className="space-y-1.5">
            <input
              id={NODE_FIELD_IDS.opacity}
              type="range"
              min={0}
              max={100}
              value={values.opacity}
              disabled={isLocked}
              onChange={(event) => setOpacity(Number(event.target.value))}
              className="w-full"
            />
            <div className="inspector-helper">{values.opacity}%</div>
          </div>
        </PropertyRow>
      </SectionAccordion>

      <SectionAccordion
        title="Layer / Behavior"
        icon={<Wrench className="h-3.5 w-3.5" />}
        isOpen={behaviorOpen}
        onToggle={() => setBehaviorOpen((prev) => !prev)}
      >
        <ToggleRow
          label="Phantom"
          helper="Conceptual entities render with reduced visual prominence."
          enabled={!!values.isPhantom}
          onToggle={(next) => {
            setValue('isPhantom', next, {
              shouldDirty: true,
              shouldValidate: true
            });
            if (next && values.borderStyle === 'solid') {
              setValue('borderStyle', 'dashed', {
                shouldDirty: true,
                shouldValidate: true
              });
            }
            if (next && values.opacity >= DEFAULT_NODE_OPACITY) {
              setValue('opacity', 58, {
                shouldDirty: true,
                shouldValidate: true
              });
            }
          }}
          disabled={isLocked}
        />

        <ToggleRow
          label="Lock"
          helper="Prevents dragging and inspector editing for this node."
          enabled={!!values.isLocked}
          onToggle={(next) =>
            setValue('isLocked', next, {
              shouldDirty: true,
              shouldValidate: true
            })
          }
        />

        <PropertyRow label="Size" htmlFor={NODE_FIELD_IDS.scale} helper={`${Math.round(values.scale * 100)}%`}>
          <input
            id={NODE_FIELD_IDS.scale}
            type="range"
            min={60}
            max={200}
            value={Math.round(values.scale * 100)}
            disabled={isLocked}
            onChange={(event) => setScale(Number(event.target.value))}
            className="w-full"
          />
        </PropertyRow>
      </SectionAccordion>

      <SectionAccordion
        title="Financial Attributes"
        icon={<Landmark className="h-3.5 w-3.5" />}
        isOpen={nodeDetailsOpen}
        onToggle={onToggleNodeDetails}
        testId="inspector-toggle-node-details"
        actions={
          <>
            {onResetNodeSection ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onResetNodeSection();
                }}
                className="status-chip !h-6 !px-2 !text-[10px]"
              >
                Reset
              </button>
            ) : null}
            {onApplyNodeSection ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onApplyNodeSection();
                }}
                className="status-chip !h-6 !px-2 !text-[10px]"
              >
                Apply
              </button>
            ) : null}
          </>
        }
      >
        <div className="grid grid-cols-2 gap-2">
          <PropertyRow
            label={nodeProfile.fieldLabels.custodyHolder}
            htmlFor={NODE_FIELD_IDS.custodyHolder}
            helper={nodeProfile.fieldHelpers.custodyHolder}
          >
            <Input
              id={NODE_FIELD_IDS.custodyHolder}
              disabled={isLocked}
              value={nodeMeta.custodyHolder}
              onChange={(event) => onNodeMetaChange('custodyHolder', event.target.value)}
              placeholder={nodeProfile.fieldPlaceholders.custodyHolder}
            />
          </PropertyRow>
          <PropertyRow
            label={nodeProfile.fieldLabels.ledgerType}
            htmlFor={NODE_FIELD_IDS.ledgerType}
            helper={nodeProfile.fieldHelpers.ledgerType}
          >
            <Select
              id={NODE_FIELD_IDS.ledgerType}
              disabled={isLocked}
              value={nodeMeta.ledgerType}
              onChange={(event) => onNodeMetaChange('ledgerType', event.target.value)}
            >
              <option value="">Not set</option>
              {nodeProfile.ledgerTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </PropertyRow>
          <PropertyRow
            label={nodeProfile.fieldLabels.balanceModel}
            htmlFor={NODE_FIELD_IDS.balanceModel}
            helper={nodeProfile.fieldHelpers.balanceModel}
          >
            <Select
              id={NODE_FIELD_IDS.balanceModel}
              disabled={isLocked}
              value={nodeMeta.balanceModel}
              onChange={(event) => onNodeMetaChange('balanceModel', event.target.value)}
            >
              <option value="">Not set</option>
              {nodeProfile.balanceModelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </PropertyRow>
          <PropertyRow
            label={nodeProfile.fieldLabels.postingTiming}
            htmlFor={NODE_FIELD_IDS.postingTiming}
            helper={nodeProfile.fieldHelpers.postingTiming}
          >
            <Input
              id={NODE_FIELD_IDS.postingTiming}
              disabled={isLocked}
              value={nodeMeta.postingTiming}
              onChange={(event) => onNodeMetaChange('postingTiming', event.target.value)}
              placeholder={nodeProfile.fieldPlaceholders.postingTiming}
            />
          </PropertyRow>
        </div>
      </SectionAccordion>

      {nodeProfile.showCompliance ? (
        <SectionAccordion
          title="Compliance"
          icon={<ShieldCheck className="h-3.5 w-3.5" />}
          isOpen={complianceOpen}
          onToggle={() => setComplianceOpen((prev) => !prev)}
        >
          <div className="grid grid-cols-2 gap-2">
            <PropertyRow
              label={nodeProfile.fieldLabels.kycOwner}
              htmlFor={NODE_FIELD_IDS.kycOwner}
              helper={nodeProfile.fieldHelpers.kycOwner}
            >
              <Input
                id={NODE_FIELD_IDS.kycOwner}
                disabled={isLocked}
                value={nodeMeta.kycOwner}
                onChange={(event) => onNodeMetaChange('kycOwner', event.target.value)}
                placeholder={nodeProfile.fieldPlaceholders.kycOwner}
              />
            </PropertyRow>
            <PropertyRow
              label={nodeProfile.fieldLabels.amlMonitoring}
              htmlFor={NODE_FIELD_IDS.amlMonitoring}
              helper={nodeProfile.fieldHelpers.amlMonitoring}
            >
              <Input
                id={NODE_FIELD_IDS.amlMonitoring}
                disabled={isLocked}
                value={nodeMeta.amlMonitoring}
                onChange={(event) => onNodeMetaChange('amlMonitoring', event.target.value)}
                placeholder={nodeProfile.fieldPlaceholders.amlMonitoring}
              />
            </PropertyRow>
            <PropertyRow
              label={nodeProfile.fieldLabels.fraudControls}
              htmlFor={NODE_FIELD_IDS.fraudControls}
              helper={nodeProfile.fieldHelpers.fraudControls}
            >
              <Input
                id={NODE_FIELD_IDS.fraudControls}
                disabled={isLocked}
                value={nodeMeta.fraudControls}
                onChange={(event) => onNodeMetaChange('fraudControls', event.target.value)}
                placeholder={nodeProfile.fieldPlaceholders.fraudControls}
              />
            </PropertyRow>
          </div>
        </SectionAccordion>
      ) : null}

      <SectionAccordion
        title="Metadata"
        icon={<Tags className="h-3.5 w-3.5" />}
        isOpen={metadataOpen}
        onToggle={() => setMetadataOpen((prev) => !prev)}
      >
        <PropertyRow
          label={nodeProfile.fieldLabels.tags}
          htmlFor={NODE_FIELD_IDS.tags}
          helper={nodeProfile.fieldHelpers.tags}
        >
          <Input
            id={NODE_FIELD_IDS.tags}
            disabled={isLocked}
            value={nodeMeta.tags}
            onChange={(event) => onNodeMetaChange('tags', event.target.value)}
            placeholder={nodeProfile.fieldPlaceholders.tags}
          />
        </PropertyRow>

        <PropertyRow
          label={nodeProfile.fieldLabels.externalRefs}
          htmlFor={NODE_FIELD_IDS.externalRefs}
          helper={nodeProfile.fieldHelpers.externalRefs}
        >
          <Input
            id={NODE_FIELD_IDS.externalRefs}
            disabled={isLocked}
            value={nodeMeta.externalRefs}
            onChange={(event) => onNodeMetaChange('externalRefs', event.target.value)}
            placeholder={nodeProfile.fieldPlaceholders.externalRefs}
          />
        </PropertyRow>
      </SectionAccordion>

    </>
  );
};

export default NodeInspectorSections;
