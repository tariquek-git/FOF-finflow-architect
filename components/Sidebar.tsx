import React, { useState, useMemo } from 'react';
import { EntityType } from '../types';
import { ENTITY_ICONS } from '../constants';
import { ChevronDown, ChevronRight, Search, X } from 'lucide-react';

interface SidebarProps {
  onAddNode: (type: EntityType) => void;
}

const Sidebar = React.memo<SidebarProps>(({ onAddNode }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    institutions: true,
    intermediaries: true,
    treasury: true,
    endpoints: true
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const onDragStartShape = (event: React.DragEvent, type: EntityType) => {
    event.dataTransfer.setData('application/finflow/type', type);
    event.dataTransfer.effectAllowed = 'copy';
  };

  const renderShapeButton = (type: EntityType) => (
    <button
      key={type}
      draggable
      onDragStart={(e) => onDragStartShape(e, type)}
      onClick={() => onAddNode(type)}
      className="flex flex-col items-center justify-center aspect-[1.2] p-2 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-800 transition-all group text-center cursor-grab active:cursor-grabbing"
      title={`Click to add or Drag ${type} to canvas`}
    >
      <div className="w-9 h-9 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center mb-2 group-hover:scale-110 group-hover:shadow-md group-hover:border-indigo-200 transition-all duration-200">
        {ENTITY_ICONS[type]}
      </div>
      <span className="text-[10px] leading-tight font-medium text-slate-600 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 line-clamp-2 px-1">
        {type.replace(' Bank', '').replace(' Provider', '')}
      </span>
    </button>
  );

  // Filter Logic
  const filteredGroups = useMemo(() => {
    const term = searchTerm.toLowerCase();
    
    const groups = {
      institutions: [EntityType.SPONSOR_BANK, EntityType.ISSUING_BANK, EntityType.ACQUIRING_BANK, EntityType.CENTRAL_BANK, EntityType.CREDIT_UNION, EntityType.CORRESPONDENT_BANK],
      intermediaries: [EntityType.PROGRAM_MANAGER, EntityType.PROCESSOR, EntityType.GATEWAY, EntityType.NETWORK, EntityType.SWITCH, EntityType.WALLET_PROVIDER],
      treasury: [
        EntityType.GATE,
        EntityType.LIQUIDITY_PROVIDER,
        EntityType.FUNDING_SOURCE,
        EntityType.LEDGER,
        EntityType.RECONCILIATION
      ],
      endpoints: [EntityType.END_POINT, EntityType.TEXT_BOX, EntityType.ANCHOR]
    };

    if (!term) return groups;

    const filterList = (list: EntityType[]) => list.filter(type => type.toLowerCase().includes(term));

    return {
      institutions: filterList(groups.institutions),
      intermediaries: filterList(groups.intermediaries),
      treasury: filterList(groups.treasury),
      endpoints: filterList(groups.endpoints)
    };
  }, [searchTerm]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800">
      
      <div className="p-4 border-b border-slate-100 dark:border-slate-900">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Component Library</h2>
          <div className="relative group">
             <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
             <input 
                placeholder="Search..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg py-1.5 pl-8 pr-8 text-xs font-medium focus:ring-1 focus:ring-indigo-500 text-slate-700 dark:text-slate-300 placeholder:text-slate-400"
             />
             {searchTerm && (
               <button 
                 onClick={() => setSearchTerm('')}
                 className="absolute right-2 top-1.5 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400"
               >
                 <X className="w-3 h-3" />
               </button>
             )}
          </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
        
        {/* INSTITUTIONS */}
        {filteredGroups.institutions.length > 0 && (
          <div>
            <button 
              onClick={() => toggleSection('institutions')}
              className="flex items-center w-full px-2 py-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              {openSections.institutions || searchTerm ? <ChevronDown className="w-3 h-3 mr-1.5" /> : <ChevronRight className="w-3 h-3 mr-1.5" />}
              Institutions
            </button>
            {(openSections.institutions || searchTerm) && (
              <div className="grid grid-cols-3 gap-1 animate-in slide-in-from-top-2 duration-200">
                {filteredGroups.institutions.map(renderShapeButton)}
              </div>
            )}
          </div>
        )}

        {filteredGroups.institutions.length > 0 && <div className="h-px bg-slate-100 dark:bg-slate-900" />}

        {/* INTERMEDIARIES */}
        {filteredGroups.intermediaries.length > 0 && (
          <div>
            <button 
              onClick={() => toggleSection('intermediaries')}
              className="flex items-center w-full px-2 py-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              {openSections.intermediaries || searchTerm ? <ChevronDown className="w-3 h-3 mr-1.5" /> : <ChevronRight className="w-3 h-3 mr-1.5" />}
              Intermediaries
            </button>
            {(openSections.intermediaries || searchTerm) && (
              <div className="grid grid-cols-3 gap-1 animate-in slide-in-from-top-2 duration-200">
                {filteredGroups.intermediaries.map(renderShapeButton)}
              </div>
            )}
          </div>
        )}

        {filteredGroups.intermediaries.length > 0 && <div className="h-px bg-slate-100 dark:bg-slate-900" />}

        {/* TREASURY */}
        {filteredGroups.treasury.length > 0 && (
          <div>
            <button 
              onClick={() => toggleSection('treasury')}
              className="flex items-center w-full px-2 py-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              {openSections.treasury || searchTerm ? <ChevronDown className="w-3 h-3 mr-1.5" /> : <ChevronRight className="w-3 h-3 mr-1.5" />}
              Treasury
            </button>
            {(openSections.treasury || searchTerm) && (
              <div className="grid grid-cols-3 gap-1 animate-in slide-in-from-top-2 duration-200">
                {filteredGroups.treasury.map(renderShapeButton)}
              </div>
            )}
          </div>
        )}

        {filteredGroups.treasury.length > 0 && <div className="h-px bg-slate-100 dark:bg-slate-900" />}

        {/* END POINTS */}
        {filteredGroups.endpoints.length > 0 && (
          <div>
            <button 
              onClick={() => toggleSection('endpoints')}
              className="flex items-center w-full px-2 py-1.5 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              {openSections.endpoints || searchTerm ? <ChevronDown className="w-3 h-3 mr-1.5" /> : <ChevronRight className="w-3 h-3 mr-1.5" />}
              End Points
            </button>
            {(openSections.endpoints || searchTerm) && (
              <div className="grid grid-cols-3 gap-1 animate-in slide-in-from-top-2 duration-200">
                {filteredGroups.endpoints.map(renderShapeButton)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

export default Sidebar;
