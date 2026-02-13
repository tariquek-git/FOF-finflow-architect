import React from 'react';
import { ArrowDownToLine, ArrowUpFromLine, FileImage, FileText } from 'lucide-react';

type ExportInspectorSectionsProps = {
  hasRecoverySnapshot: boolean;
  onRestoreRecovery: () => void;
  onResetCanvas: () => void;
  onImportDiagram: () => void;
  onExportDiagram: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
};

const PanelSection: React.FC<{ title: string; icon: React.ReactNode; children?: React.ReactNode }> = ({
  title,
  icon,
  children
}) => (
  <section className="mb-3 rounded-xl border border-slate-200 bg-white p-2.5 dark:border-slate-700 dark:bg-slate-900">
    <div className="mb-2 flex items-center gap-2 border-b border-slate-200 px-1 pb-1 dark:border-slate-700">
      <div className="text-blue-600 dark:text-blue-300">{icon}</div>
      <h3 className="ui-section-title">{title}</h3>
    </div>
    <div className="space-y-2.5 px-1">{children}</div>
  </section>
);

const ExportInspectorSections: React.FC<ExportInspectorSectionsProps> = ({
  hasRecoverySnapshot,
  onRestoreRecovery,
  onResetCanvas,
  onImportDiagram,
  onExportDiagram,
  onExportPng,
  onExportPdf
}) => {
  return (
    <PanelSection title="File & Export" icon={<ArrowDownToLine className="h-3.5 w-3.5" />}>
      <button
        type="button"
        data-testid="toolbar-export-json"
        onClick={onExportDiagram}
        className="ui-button-primary inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold"
      >
        <ArrowDownToLine className="h-4 w-4" /> Export JSON
      </button>
      <button
        type="button"
        data-testid="toolbar-export-png"
        onClick={onExportPng}
        className="ui-button-secondary inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold"
      >
        <FileImage className="h-4 w-4" /> Export PNG
      </button>
      <button
        type="button"
        data-testid="toolbar-export-pdf"
        onClick={onExportPdf}
        className="ui-button-secondary inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold"
      >
        <FileText className="h-4 w-4" /> Export PDF
      </button>
      <button
        type="button"
        data-testid="toolbar-import-json"
        onClick={onImportDiagram}
        className="ui-button-secondary inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold"
      >
        <ArrowUpFromLine className="h-4 w-4" /> Import JSON
      </button>
      <button
        type="button"
        data-testid="toolbar-restore"
        onClick={onRestoreRecovery}
        className={`ui-button-secondary inline-flex w-full items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold ${
          hasRecoverySnapshot ? '' : 'opacity-90'
        }`}
      >
        Restore Backup
      </button>
      <button
        type="button"
        data-testid="toolbar-reset-canvas"
        onClick={onResetCanvas}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700"
      >
        New / Reset Canvas
      </button>
    </PanelSection>
  );
};

export default ExportInspectorSections;
