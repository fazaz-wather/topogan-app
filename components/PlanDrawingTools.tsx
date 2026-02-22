
import React from 'react';
import { DrawingTool } from '../types';

interface PlanDrawingToolsProps {
  activeTool: DrawingTool;
  onToolSelect: (tool: DrawingTool) => void;
}

const tools: { id: DrawingTool, label: string, icon: React.ReactNode }[] = [
    { id: 'point', label: 'Point', icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg> },
    { id: 'line', label: 'Ligne', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25" /></svg> },
    { id: 'rectangle', label: 'Rectangle', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.563C9.252 14.437 9 14.185 9 13.874V9.563z" /></svg> },
    { id: 'circle', label: 'Cercle', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { id: 'polygon', label: 'Polygone', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836l-8.5 4.75a1.25 1.25 0 000 2.168l8.5 4.75a1.25 1.25 0 001.3 0l8.5-4.75a1.25 1.25 0 000-2.168l-8.5-4.75a1.25 1.25 0 00-1.3 0z" /></svg> },
    { id: 'angle', label: 'Angle', icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0-2.25l2.25 1.313M4.5 15.75l7.5 4.33 7.5-4.33" /></svg> },
    { id: 'text', label: 'Texte', icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path d="M5.25 3A2.25 2.25 0 003 5.25v9.5A2.25 2.25 0 005.25 17h9.5A2.25 2.25 0 0017 14.75v-9.5A2.25 2.25 0 0014.75 3h-9.5zM6.5 6a.75.75 0 01.75.75h3.5a.75.75 0 010 1.5h-3.5a.75.75 0 01-.75-.75V6zm0 3.25a.75.75 0 01.75-.75h6.5a.75.75 0 010 1.5h-6.5a.75.75 0 01-.75-.75zm.75 2.5a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5z" /></svg> },
    { id: 'hand', label: 'Main levée', icon: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" /></svg> }
];

const PlanDrawingTools: React.FC<PlanDrawingToolsProps> = ({ activeTool, onToolSelect }) => {
  return (
    <div className="flex flex-wrap items-center gap-1 bg-gray-100 dark:bg-gray-900 p-1.5 rounded-lg">
      {tools.map(tool => (
        <button
          key={tool.id}
          onClick={() => onToolSelect(tool.id)}
          title={tool.label}
          className={`p-2 rounded-md transition-colors ${activeTool === tool.id ? 'bg-blue-600 text-white' : 'hover:bg-gray-200 dark:hover:bg-gray-700'}`}
        >
          <div className="w-5 h-5">{tool.icon}</div>
        </button>
      ))}
    </div>
  );
};

export default PlanDrawingTools;
