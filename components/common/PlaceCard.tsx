import React from 'react';
import { Place } from '../../types';
import { Star, Utensils, Landmark, MapPin, Heart } from 'lucide-react';

const StarRating: React.FC<{ rating: number }> = ({ rating }) => {
    const fullStars = Math.floor(rating);
    const emptyStars = 5 - fullStars;
    return (
        <div className="flex text-yellow-400">
            {[...Array(fullStars)].map((_, i) => <Star key={`full-${i}`} fill="currentColor" size={16} />)}
            {[...Array(emptyStars)].map((_, i) => <Star key={`empty-${i}`} size={16} />)}
        </div>
    );
};

const PlaceCard: React.FC<{ place: Place; isFavorite: boolean; onToggleFavorite: (place: Place) => void; }> = ({ place, isFavorite, onToggleFavorite }) => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex items-start gap-4 transition-transform transform hover:scale-105">
        <div className="p-3 bg-primary-light dark:bg-primary-dark text-white rounded-full">
            {place.category.includes('مطعم') ? <Utensils size={24} /> : <Landmark size={24} />}
        </div>
        <div className="flex-grow">
            <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{place.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{place.category}</p>
            <div className="flex items-center justify-between mt-2">
                {place.rating ? <StarRating rating={place.rating} /> : <div/>}
                <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{place.distance}</span>
            </div>
        </div>
         <div className="self-center flex items-center">
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
);

export default PlaceCard;