
import React from 'react';

interface LoadingSpinnerProps {
    message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = "جاري التحليل..." }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent border-solid rounded-full animate-spin"></div>
      <p className="mt-4 text-lg font-semibold text-gray-700 dark:text-gray-200">{message}</p>
    </div>
  );
};

export default LoadingSpinner;
