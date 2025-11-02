import React from 'react';
import { Sun, Moon, ArrowRight, Key } from 'lucide-react';

interface HeaderProps {
  title: string;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onBack?: () => void;
  onOpenApiKeyModal?: () => void;
}

const Header: React.FC<HeaderProps> = ({ title, isDarkMode, toggleDarkMode, onBack, onOpenApiKeyModal }) => {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between p-4 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="w-10 h-10">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="الرجوع"
          >
            <ArrowRight className="text-gray-700 dark:text-gray-200" />
          </button>
        )}
      </div>
      <h1 className="text-xl font-bold text-primary-dark dark:text-primary-light">{title}</h1>
      <div className="flex items-center gap-2">
        {onOpenApiKeyModal && (
            <button
            onClick={onOpenApiKeyModal}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="تغيير مفتاح API"
            >
                <Key className="text-gray-700 dark:text-gray-200" />
            </button>
        )}
        <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            aria-label="تبديل الوضع"
        >
            {isDarkMode ? (
            <Sun className="text-yellow-400" />
            ) : (
            <Moon className="text-gray-700" />
            )}
        </button>
      </div>
    </header>
  );
};

export default Header;