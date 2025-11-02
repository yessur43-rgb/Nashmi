import React, { useState } from 'react';
import * as geminiService from '../services/geminiService';
import { Place } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import PlaceCard from './common/PlaceCard';
import { Search, Utensils, AlertTriangle } from 'lucide-react';
import { parseDistance } from '../utils/helpers';

interface FindPlacesProps {
    location: { lat: number; lon: number } | null;
    favoritePlaces?: Place[];
    onToggleFavoritePlace?: (place: Place) => void;
}

const FindPlaces: React.FC<FindPlacesProps> = ({ location, favoritePlaces = [], onToggleFavoritePlace = () => {} }) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<Place[] | null>(null);

    const handleSearch = async (searchQuery: string) => {
        if (!location) {
            setError('لا يمكن البحث بدون تحديد الموقع.');
            return;
        }
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setResults(null);
        setError(null);

        try {
            const response = await geminiService.findPlacesNearby(searchQuery, location);
            if(response && Array.isArray(response)) {
                 const sortedResults = response.sort((a, b) => parseDistance(a.distance) - parseDistance(b.distance));
                 setResults(sortedResults);
            } else {
                setError("لم نتمكن من العثور على أماكن. حاول البحث بكلمات مختلفة.");
            }
        } catch (err) {
            setError('حدث خطأ أثناء البحث.');
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSearch(query);
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="text-center p-6 bg-blue-500 dark:bg-blue-800/50 rounded-xl shadow-lg">
                <Utensils className="mx-auto w-12 h-12 text-white mb-2" />
                <h2 className="text-2xl font-bold text-white">ابحث عن أماكن</h2>
                <p className="text-white/80">مطاعم حلال، مساجد، والمزيد بالقرب منك</p>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="مثال: شاورما، مقهى عائلي..."
                    className="flex-grow p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                    disabled={isSearching || !location}
                />
                <button
                    type="submit"
                    className="p-3 bg-primary text-white rounded-lg font-semibold shadow-md hover:bg-primary-dark transition-colors disabled:opacity-50"
                    disabled={isSearching || !location || !query.trim()}
                >
                    <Search />
                </button>
            </form>

            {isSearching && <LoadingSpinner message="جاري البحث عن أماكن قريبة..." />}
            
            {error && 
                <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center flex items-center justify-center gap-2">
                    <AlertTriangle /> {error}
                </div>
            }
            
            {results && (
                <div className="space-y-4 animate-fade-in">
                    {results.length > 0 ? (
                        results.map((place, index) => {
                            const isFavorite = favoritePlaces.some(fav => fav.mapsLink === place.mapsLink);
                            return <PlaceCard key={index} place={place} isFavorite={isFavorite} onToggleFavorite={onToggleFavoritePlace} />
                        })
                    ) : (
                         <div className="p-4 bg-yellow-100 text-yellow-700 rounded-lg text-center">
                           لم يتم العثور على نتائج.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FindPlaces;