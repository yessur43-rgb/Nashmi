import React from 'react';
import { Activity } from '../../types';
import { MapPin, FerrisWheel, TreePine, Landmark, ShoppingCart, Sparkles, HandCoins, MoveRight, Heart } from 'lucide-react';

const CategoryIcon: React.FC<{ category: string }> = ({ category }) => {
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('park') || lowerCategory.includes('حديقة')) return <TreePine size={24} />;
    if (lowerCategory.includes('museum') || lowerCategory.includes('متحف')) return <Landmark size={24} />;
    if (lowerCategory.includes('mall') || lowerCategory.includes('تسوق')) return <ShoppingCart size={24} />;
    if (lowerCategory.includes('event') || lowerCategory.includes('فعالية')) return <Sparkles size={24} />;
    return <FerrisWheel size={24} />;
};

const ActivityCard: React.FC<{ activity: Activity; isFavorite: boolean; onToggleFavorite: (activity: Activity) => void; }> = ({ activity, isFavorite, onToggleFavorite }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-col items-start gap-3 transition-transform transform hover:scale-[1.02] animate-fade-in">
        <div className="w-full flex justify-between items-start">
            <div className="flex items-start gap-4">
                <div className="p-3 bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-300 rounded-full">
                    <CategoryIcon category={activity.category} />
                </div>
                <div>
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{activity.name}</h3>
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{activity.category}</p>
                </div>
            </div>
            <div className="flex items-center">
                 {activity.mapsLink && (
                    <a href={activity.mapsLink} target="_blank" rel="noopener noreferrer" className="p-3 text-primary dark:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors" aria-label="عرض على الخريطة">
                        <MapPin size={24} />
                    </a>
                )}
                 <button 
                    onClick={() => onToggleFavorite(activity)}
                    disabled={!activity.mapsLink}
                    className="p-3 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors disabled:text-gray-400 dark:disabled:text-gray-600 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent disabled:cursor-not-allowed"
                    aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                >
                    <Heart size={24} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
            </div>
        </div>
        <p className="text-gray-600 dark:text-gray-300">{activity.description}</p>
        <div className="w-full flex flex-wrap items-center justify-start gap-3 mt-2 text-xs">
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 rounded-full font-semibold">
                <Sparkles size={14} /> {activity.suitability}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200 rounded-full font-semibold">
               <HandCoins size={14} /> {activity.estimatedCost}
            </span>
            {activity.distance && (
                 <span className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-full font-semibold">
                    <MoveRight size={14} /> {activity.distance}
                </span>
            )}
        </div>
    </div>
);

export default ActivityCard;