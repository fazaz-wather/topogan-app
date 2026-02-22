import React from 'react';

interface CalculationPanelProps {
  title: string;
  children: React.ReactNode;
}

const CalculationPanel: React.FC<CalculationPanelProps> = ({ title, children }) => {
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 h-full">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};

export default CalculationPanel;