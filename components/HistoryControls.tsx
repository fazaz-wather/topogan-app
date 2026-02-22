import React from 'react';

interface HistoryControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const HistoryControls: React.FC<HistoryControlsProps> = ({ onUndo, onRedo, canUndo, canRedo }) => {
  const buttonClass = "p-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const enabledClass = "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600";
  const disabledClass = "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600";

  return (
    <div className="flex items-center space-x-2">
      <button 
        onClick={onUndo} 
        disabled={!canUndo}
        title="Annuler (Ctrl+Z)"
        className={`${buttonClass} ${canUndo ? enabledClass : disabledClass}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
        </svg>
      </button>
      <button 
        onClick={onRedo}
        disabled={!canRedo}
        title="Rétablir (Ctrl+Y)"
        className={`${buttonClass} ${canRedo ? enabledClass : disabledClass}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 9l6 6m0 0l-6 6m6-6H3a6 6 0 010-12h3" />
        </svg>
      </button>
    </div>
  );
};

export default HistoryControls;
