import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

type ShortcutsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode: boolean;
};

type ShortcutItem = {
  action: string;
  combo: string;
};

const SHORTCUTS: ShortcutItem[] = [
  { action: 'Command palette', combo: 'Cmd/Ctrl+K' },
  { action: 'Undo', combo: 'Cmd/Ctrl+Z' },
  { action: 'Redo', combo: 'Shift+Cmd/Ctrl+Z' },
  { action: 'Duplicate selected nodes', combo: 'Cmd/Ctrl+D' },
  { action: 'Delete selection', combo: 'Delete / Backspace' },
  { action: 'Pan canvas', combo: 'Hold Space + Drag' },
  { action: 'Multi-select', combo: 'Shift+Click' },
  { action: 'Nudge selection', combo: 'Arrow Keys' },
  { action: 'Large nudge', combo: 'Shift+Arrow Keys' },
  { action: 'Connect tool', combo: 'C' },
  { action: 'Select tool', combo: 'V' },
  { action: 'Hand tool', combo: 'H' },
  { action: 'Text tool', combo: 'T' },
  { action: 'Toggle grid', combo: 'G' },
  { action: 'Toggle snap', combo: 'S' },
  { action: 'Toggle lanes', combo: 'L' },
  { action: 'Toggle handles', combo: 'P' },
  { action: 'Toggle minimap', combo: 'M' },
  { action: 'Clear selection', combo: 'Escape' },
  { action: 'Open shortcut help', combo: '?' }
];

const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ isOpen, onClose, isDarkMode }) => {
  const [query, setQuery] = useState('');

  const items = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return SHORTCUTS;
    return SHORTCUTS.filter(
      (item) => item.action.toLowerCase().includes(normalized) || item.combo.toLowerCase().includes(normalized)
    );
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center px-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Close shortcuts modal"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className={`relative z-10 w-full max-w-xl rounded-xl border p-4 shadow-2xl ${
          isDarkMode
            ? 'border-slate-700 bg-slate-900 text-slate-100'
            : 'border-slate-300 bg-white text-slate-800'
        }`}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Quick commands to speed up editing.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 p-1.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            aria-label="Close shortcuts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search shortcuts..."
            className="ui-input h-9 w-full pl-8 pr-2 text-xs"
          />
        </label>

        <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
          {items.length === 0 ? (
            <div className="px-3 py-5 text-center text-xs text-slate-500">No matching shortcuts.</div>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-700">
              {items.map((item) => (
                <li key={item.action} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span>{item.action}</span>
                  <kbd className="ui-kbd-hint">{item.combo}</kbd>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShortcutsModal;
