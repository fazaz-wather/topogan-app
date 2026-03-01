
import React from 'react';
import { View } from '../types';

interface BottomNavProps {
    currentView: View;
    onNavigate: (view: View) => void;
}

const tabs: { label: string; view: View; icon: React.ReactNode }[] = [
    { label: 'Accueil', view: 'WELCOME', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
    { label: 'Surface', view: 'SURFACE', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9h6v6H9V9z" /></svg> },
    { label: 'Croquis', view: 'BORNAGE_SKETCH', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg> },
    { label: 'Carte', view: 'MAP', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg> },
];

const BottomNav: React.FC<BottomNavProps> = ({ currentView, onNavigate }) => {
    return (
        <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 shadow-2xl shadow-black/10 rounded-2xl px-6 py-3 flex items-center gap-6 z-[40] transition-all duration-300 hover:scale-[1.02] hover:bg-white/90 dark:hover:bg-gray-900/90">
            {tabs.map((tab) => (
                <button
                    key={tab.view}
                    onClick={() => onNavigate(tab.view)}
                    className={`flex flex-col items-center justify-center gap-1 transition-all duration-300 relative group ${
                        currentView === tab.view ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                    }`}
                >
                    <div className={`transition-transform duration-300 p-2 rounded-xl ${
                        currentView === tab.view 
                            ? 'bg-blue-50 dark:bg-blue-900/20 scale-110 -translate-y-1' 
                            : 'group-hover:-translate-y-0.5'
                    }`}>
                        {tab.icon}
                    </div>
                    {currentView === tab.view && (
                        <div className="absolute -bottom-2 w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" />
                    )}
                </button>
            ))}
        </nav>
    );
};

export default BottomNav;
