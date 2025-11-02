import React from 'react';
import { RoutePlace } from '../../types';
import { MapPin, Heart, Utensils, Landmark, CornerUpRight, Milestone } from 'lucide-react';

const RoutePlaceCard: React.FC<{ place: RoutePlace; isFavorite: boolean; onToggleFavorite: (place: RoutePlace) => void; }> = ({ place, isFavorite, onToggleFavorite }) => {
    const lowerCategory = place.category.toLowerCase();
    const Icon = lowerCategory.includes('مسجد') ? Landmark : Utensils;

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-col items-start gap-3 transition-transform transform hover:scale-[1.02] animate-fade-in">
            <div className="w-full flex justify-between items-start">
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-300 rounded-full">
                        <Icon size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{place.name}</h3>
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{place.category}</p>
                    </div>
                </div>
                <div className="flex items-center">
                    <a href={place.mapsLink} target="_blank" rel="noopener noreferrer" className="p-3 text-primary dark:text-primary-light hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors" aria-label="عرض على الخريطة">
                        <MapPin size={24} />
                    </a>
                    <button 
                        onClick={() => onToggleFavorite(place)}
                        disabled={!place.mapsLink}
                        className="p-3 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors disabled:text-gray-400 dark:disabled:text-gray-600 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent disabled:cursor-not-allowed"
                        aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                    >
                        <Heart size={24} fill={isFavorite ? 'currentColor' : 'none'} />
                    </button>
                </div>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{place.details}</p>
            <div className="w-full flex flex-wrap items-center justify-start gap-x-4 gap-y-2 mt-2 text-sm font-semibold">
                {place.distanceFromStart && (
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <Milestone size={16} />
                        <span>{place.distanceFromStart}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <CornerUpRight size={16} />
                    <span>{place.detour}</span>
                </div>
            </div>
        </div>
    );
};

export default RoutePlaceCard;