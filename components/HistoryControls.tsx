import React from 'react';

interface HistoryControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const HistoryControls: React.FC<HistoryControlsProps> = ({ onUndo, onRedo, canUndo, canRedo }) => {
  const buttonClass = "p-2 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed";
  const enabledClass = "bg-[#F1F5F9] dark:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#334155] hover:text-[#0F172A] dark:hover:text-white";
  const disabledClass = "bg-transparent text-[#CBD5E1] dark:text-[#475569]";

  return (
    <div className="flex items-center space-x-1 border border-[#E2E8F0] dark:border-[#334155] rounded-xl p-1 bg-white dark:bg-[#0F172A]">
      <button 
        onClick={onUndo} 
        disabled={!canUndo}
        title="Annuler (Ctrl+Z)"
        className={`${buttonClass} ${canUndo ? enabledClass : disabledClass}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
      </button>
      <button 
        onClick={onRedo}
        disabled={!canRedo}
        title="Rétablir (Ctrl+Y)"
        className={`${buttonClass} ${canRedo ? enabledClass : disabledClass}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 9l6 6m0 0l-6 6m6-6H3a6 6 0 010-12h3" />
        </svg>
      </button>
    </div>
  );
};

export default HistoryControls;
