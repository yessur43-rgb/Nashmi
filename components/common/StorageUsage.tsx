import React, { useState, useEffect } from 'react';
import { HardDrive } from 'lucide-react';
import { getStorageEstimate } from '../../utils/helpers';

const StorageUsage: React.FC = () => {
    const [usage, setUsage] = useState({ usedMB: 0, quotaMB: 10 });

    useEffect(() => {
        const calculateUsage = async () => {
            const { usedBytes, quotaBytes } = await getStorageEstimate();
            setUsage({
                usedMB: parseFloat((usedBytes / (1024 * 1024)).toFixed(2)),
                quotaMB: parseFloat((quotaBytes / (1024 * 1024)).toFixed(0)),
            });
        };
        calculateUsage();
        
        // Custom event for in-app updates
        const handleStorageChange = () => calculateUsage();
        window.addEventListener('custom-storage-update', handleStorageChange);

        return () => {
            window.removeEventListener('custom-storage-update', handleStorageChange);
        };
    }, []);

    const percentage = usage.quotaMB > 0 ? (usage.usedMB / usage.quotaMB) * 100 : 0;
    let barColor = 'bg-green-500';
    let textColor = 'text-gray-600 dark:text-gray-400';
    if (percentage > 90) {
        barColor = 'bg-red-500';
        textColor = 'text-red-500 dark:text-red-400 font-bold';
    } else if (percentage > 75) {
        barColor = 'bg-yellow-500';
        textColor = 'text-yellow-600 dark:text-yellow-400 font-semibold';
    }

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
            <h3 className="flex items-center gap-3 text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
                <HardDrive className="text-gray-500" />
                <span>مساحة التخزين المحلية</span>
            </h3>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                    className={`${barColor} h-4 rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min(percentage, 100)}%` }}
                ></div>
            </div>
            <p className={`text-center text-sm mt-2 font-mono ${textColor}`}>
                {usage.usedMB} MB / {usage.quotaMB} MB المستخدمة
            </p>
        </div>
    );
};

export default StorageUsage;
