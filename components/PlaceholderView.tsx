import React from 'react';

interface PlaceholderViewProps {
  title: string;
}

const PlaceholderView: React.FC<PlaceholderViewProps> = ({ title }) => {
  return (
    <main className="flex flex-col items-center justify-center text-center p-4 h-full">
      <div className="p-8 rounded-lg bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-blue-400 mb-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Bientôt disponible</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-2">
          La fonctionnalité "{title}" est en cours de développement.
          </p>
      </div>
    </main>
  );
};

export default PlaceholderView;