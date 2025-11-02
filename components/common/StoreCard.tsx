import React from 'react';
import { StoreResult } from '../../types';
import { Store, MapPin, Heart } from 'lucide-react';

const StoreCard: React.FC<{ item: StoreResult; isFavorite: boolean; onToggleFavorite: (item: StoreResult) => void; }> = ({ item, isFavorite, onToggleFavorite }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex items-start gap-4 transition-transform transform hover:scale-105">
        <div className="p-3 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-full">
            <Store size={24} />
        </div>
        <div className="flex-grow">
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{item.name}</h3>
            {item.address && <p className="text-sm text-gray-500 dark:text-gray-400">{item.address}</p>}
            <p className="mt-2 text-gray-600 dark:text-gray-300">{item.details}</p>
            {item.distance && <div className="mt-2 text-sm font-semibold text-gray-600 dark:text-gray-300">{item.distance}</div>}
        </div>
        <div className="self-center flex items-center">
            {item.mapsLink && (
                <a href={item.mapsLink} target="_blank" rel="noopener noreferrer" className="p-3 text-primary dark:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors" aria-label="عرض على الخريطة">
                    <MapPin size={24} />
                </a>
            )}
             <button 
                onClick={() => onToggleFavorite(item)}
                disabled={!item.mapsLink}
                className="p-3 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors disabled:text-gray-400 dark:disabled:text-gray-600 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent disabled:cursor-not-allowed"
                aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
            >
                <Heart size={24} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
        </div>
    </div>
);

export default StoreCard;