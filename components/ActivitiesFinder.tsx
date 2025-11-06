import React, { useState } from 'react';
import * as geminiService from '../services/geminiService';
import { Activity } from '../types';
import SkeletonCard from './common/SkeletonCard';
import ActivityCard from './common/ActivityCard';
import MapView from './common/MapView';
import { Search, AlertTriangle, PartyPopper, List, MapPin } from 'lucide-react';

interface ActivitiesFinderProps {
    location: { lat: number; lon: number } | null;
    locationError: string | null;
    favorites?: Activity[];
    onToggleFavorite?: (activity: Activity) => void;
}

const ActivitiesFinder: React.FC<ActivitiesFinderProps> = ({ location, locationError, favorites = [], onToggleFavorite = () => {} }) => {
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<Activity[] | null>(null);
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
    
    const quickSearches = [
        "حدائق ومنتزهات",
        "متاحف ومعارض",
        "مراكز تسوق",
        "أنشطة للأطفال",
        "فعاليات محلية"
    ];

    const handleSearch = async (searchQuery: string) => {
        if (!location) {
            setError(locationError || 'لا يمكن البحث بدون تحديد الموقع.');
            return;
        }
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setResults(null);
        setError(null);
        setQuery(searchQuery);
        setViewMode('list');

        try {
            const response = await geminiService.findActivitiesNearby(searchQuery, location);
            if (response && Array.isArray(response)) {
                 setResults(response);
                 if (response.length === 0) {
                     setError("لم نتمكن من العثور على أنشطة مطابقة. جرب بحثًا مختلفًا.");
                 }
            } else {
                setError("لم نتمكن من العثور على أنشطة. حاول البحث بكلمات مختلفة.");
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
            <div className="text-center p-6 bg-pink-500 dark:bg-pink-800/50 rounded-xl shadow-lg">
                <PartyPopper className="mx-auto w-12 h-12 text-white mb-2" />
                <h2 className="text-2xl font-bold text-white">ابحث عن أنشطة</h2>
                <p className="text-white/80">اكتشف أنشطة وفعاليات مناسبة للعائلة بالقرب منك</p>
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
                 {quickSearches.map(term => (
                     <button 
                        key={term} 
                        onClick={() => handleSearch(term)} 
                        disabled={isSearching || !location} 
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-full font-semibold shadow-sm hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-sm"
                    >
                        {term}
                    </button>
                 ))}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2 sticky top-2 z-10">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="مثال: боулинг, سينما..."
                    className="flex-grow p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white shadow-sm"
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
                <div className="space-y-4 animate-fade-in">
                     {results.length > 0 && (
                        <div className="flex justify-center items-center bg-gray-200 dark:bg-gray-700 rounded-lg p-1 max-w-xs mx-auto">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-800 shadow text-primary' : 'text-gray-600 dark:text-gray-300'}`}
                            >
                                <List size={16} />
                                <span>قائمة</span>
                            </button>
                            <button
                                onClick={() => setViewMode('map')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition-colors ${viewMode === 'map' ? 'bg-white dark:bg-gray-800 shadow text-primary' : 'text-gray-600 dark:text-gray-300'}`}
                            >
                                <MapPin size={16} />
                                <span>خريطة</span>
                            </button>
                        </div>
                    )}
                    {viewMode === 'list' ? (
                         <div className="space-y-4">
                            {results.map((activity, index) => {
                                const isFavorite = favorites.some(fav => fav.name === activity.name && fav.mapsLink === activity.mapsLink);
                                return <ActivityCard key={index} activity={activity} isFavorite={isFavorite} onToggleFavorite={onToggleFavorite} />
                            })}
                        </div>
                    ) : (
                       location && <MapView query={query} location={location} />
                    )}
                </div>
            )}
        </div>
    );
};

export default ActivitiesFinder;