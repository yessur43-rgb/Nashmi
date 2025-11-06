import React, { useState, useEffect } from 'react';
import * as geminiService from '../services/geminiService';
import { RoutePlace } from '../types';
import SkeletonCard from './common/SkeletonCard';
import RoutePlaceCard from './common/RoutePlaceCard';
import { Search, MapPin, AlertTriangle, Route, LocateFixed, Flag } from 'lucide-react';

interface OnMyWayProps {
    location: { lat: number; lon: number } | null;
    locationError: string | null;
    favoriteRoutePlaces?: RoutePlace[];
    onToggleFavoriteRoutePlace?: (place: RoutePlace) => void;
}

const OnMyWay: React.FC<OnMyWayProps> = ({ location, locationError, favoriteRoutePlaces = [], onToggleFavoriteRoutePlace = () => {} }) => {
    const [startPoint, setStartPoint] = useState('');
    const [destination, setDestination] = useState('');
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<RoutePlace[] | null>(null);

    useEffect(() => {
        if (location && !startPoint) {
            setStartPoint('موقعي الحالي');
        }
    }, [location, startPoint]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!startPoint.trim() || !destination.trim() || !query.trim()) {
            setError('الرجاء تعبئة جميع الحقول.');
            return;
        }

        setIsSearching(true);
        setResults(null);
        setError(null);

        try {
            const currentLoc = startPoint === 'موقعي الحالي' ? location : null;
            if (startPoint === 'موقعي الحالي' && !location) {
                setError(locationError || 'لا يمكن استخدام الموقع الحالي. الرجاء تمكين الوصول للموقع.');
                setIsSearching(false);
                return;
            }
            const response = await geminiService.findPlacesOnRoute(startPoint, destination, query, currentLoc);
            if (response && Array.isArray(response)) {
                const sortedResults = response.sort((a, b) => (a.detourInKm ?? Infinity) - (b.detourInKm ?? Infinity));
                setResults(sortedResults);
                if (sortedResults.length === 0) {
                    setError("لم يتم العثور على أماكن مطابقة على طول الطريق.");
                }
            } else {
                setError("لم نتمكن من العثور على أماكن. حاول تعديل بحثك.");
            }
        } catch (err) {
            setError('حدث خطأ أثناء البحث.');
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };
    
    const quickQueries = ["مطعم حلال", "مسجد", "محطة استراحة"];

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="text-center p-6 bg-orange-500 dark:bg-orange-800/50 rounded-xl shadow-lg">
                <Route className="mx-auto w-12 h-12 text-white mb-2" />
                <h2 className="text-2xl font-bold text-white">على طريقي</h2>
                <p className="text-white/80">ابحث عن محطات توقف مناسبة خلال رحلتك</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md">
                <div className="relative">
                    <input
                        type="text"
                        value={startPoint}
                        onChange={(e) => setStartPoint(e.target.value)}
                        placeholder="نقطة البداية"
                        className="w-full p-3 pr-12 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                        disabled={isSearching}
                    />
                     <button
                        type="button"
                        onClick={() => setStartPoint('موقعي الحالي')}
                        disabled={isSearching || !location}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-primary dark:text-gray-400 dark:hover:text-primary-light rounded-full disabled:opacity-50"
                        aria-label="استخدام الموقع الحالي كنقطة بداية"
                    >
                        <LocateFixed size={20} />
                    </button>
                </div>
                
                <div className="relative">
                    <input
                        type="text"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="الوجهة"
                        className="w-full p-3 pl-10 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                        disabled={isSearching}
                    />
                     <Flag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-3">
                     <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="ما الذي تبحث عنه؟"
                        className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                        disabled={isSearching}
                    />
                    <div className="flex flex-wrap gap-2 justify-center">
                        {quickQueries.map(term => (
                            <button 
                                key={term} 
                                type="button"
                                onClick={() => setQuery(term)} 
                                disabled={isSearching} 
                                className={`px-4 py-2 rounded-full font-semibold shadow-sm text-sm transition-colors ${query === term ? 'bg-primary text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                            >
                                {term}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 p-4 bg-primary text-white rounded-lg font-bold shadow-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                    disabled={isSearching || !startPoint.trim() || !destination.trim() || !query.trim()}
                >
                    <Search />
                    <span>ابحث على الطريق</span>
                </button>
            </form>

            {isSearching && (
                <div className="space-y-4">
                    <SkeletonCard />
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            )}
            
            {error && !isSearching &&
                <div className="p-4 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 rounded-lg text-center flex items-center justify-center gap-2">
                    <AlertTriangle /> {error}
                </div>
            }
            
            {results && !isSearching && (
                <div className="space-y-4">
                    {results.map((place, index) => {
                         const isFavorite = favoriteRoutePlaces.some(fav => fav.mapsLink === place.mapsLink);
                         return <RoutePlaceCard key={index} place={place} isFavorite={isFavorite} onToggleFavorite={onToggleFavoriteRoutePlace} />
                    })}
                </div>
            )}
        </div>
    );
};

export default OnMyWay;