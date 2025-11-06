import React from 'react';

const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md w-full animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex-shrink-0"></div>
        <div className="flex-grow space-y-3 pt-2">
          <div className="w-3/4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="w-1/2 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="w-5/6 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    </div>
  );
};

export default SkeletonCard;
