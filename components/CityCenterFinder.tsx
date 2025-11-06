import React, { useState } from 'react';
import * as geminiService from '../services/geminiService';
import { CityCenterInfo } from '../types';
import SkeletonCard from './common/SkeletonCard';
import { Building2, Search, AlertTriangle, MapPin, Utensils, Coffee, Sparkles } from 'lucide-react';

interface CityCenterFinderProps {
    location: { lat: number; lon: number } | null;
    locationError: string | null;
}

const CityCenterFinder: React.FC<CityCenterFinderProps> = ({ location, locationError }) => {
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<CityCenterInfo[] | null>(null);

    const handleSearch = async () => {
        if (!location) {
            setError(locationError || 'لا يمكن البحث بدون تحديد الموقع.');
            return;
        }

        setIsSearching(true);
        setResults(null);
        setError(null);

        try {
            const response = await geminiService.findCityCenters(location);
            if(response && response.length > 0) {
                 setResults(response);
            } else {
                setError("لم نتمكن من تحديد مراكز مدن قريبة. قد تكون في منطقة نائية.");
            }
        } catch (err) {
            setError('حدث خطأ أثناء البحث.');
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="text-center p-6 bg-indigo-500 dark:bg-indigo-800/50 rounded-xl shadow-lg">
                <Building2 className="mx-auto w-12 h-12 text-white mb-2" />
                <h2 className="text-2xl font-bold text-white">أين قلب المدينة؟</h2>
                <p className="text-white/80">اكتشف وسط المدن الحيوية القريبة منك</p>
            </div>
            
            {!results && !isSearching && (
                 <button
                    onClick={handleSearch}
                    className="w-full flex items-center justify-center gap-2 p-4 bg-primary text-white rounded-lg font-bold shadow-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                    disabled={isSearching || !location}
                >
                    <Search />
                    <span>ابحث عن مراكز المدن القريبة</span>
                </button>
            )}

            {isSearching && (
                <div className="space-y-4">
                    <SkeletonCard />
                    <SkeletonCard />
                </div>
            )}
            
            {error && !isSearching &&
                <div className="p-4 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200 rounded-lg text-center flex items-center justify-center gap-2">
                    <AlertTriangle /> {error}
                </div>
            }
            
            {results && !isSearching && (
                <div className="space-y-6 animate-fade-in">
                    {results.map((center, index) => (
                        <div key={index} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg transition-transform transform hover:scale-[1.02]">
                            <div className="flex justify-between items-start gap-4">
                                <h2 className="text-2xl font-bold text-primary dark:text-primary-light">{center.name}</h2>
                                <span className="text-md font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">{center.distance}</span>
                            </div>
                            <p className="mt-2 text-gray-600 dark:text-gray-300">{center.description}</p>
                            
                            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                                <h3 className="flex items-center gap-2 text-xl font-semibold mb-3 text-gray-800 dark:text-gray-100">
                                   <Sparkles className="text-amber-500"/>
                                    أماكن رائجة للزوار
                                </h3>
                                <ul className="space-y-3">
                                    {center.popularSpots.map((spot, spotIndex) => (
                                        <li key={spotIndex} className="flex items-start gap-3">
                                            <div className="flex-shrink-0 mt-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-full">
                                                {spot.type === 'مطعم' ? <Utensils className="text-orange-500" size={20} /> : <Coffee className="text-amber-700" size={20} />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 dark:text-gray-100">{spot.name}</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{spot.description}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            
                            <a 
                                href={center.mapsLink} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-500 text-white rounded-lg font-semibold shadow-md hover:bg-indigo-600 transition-colors"
                            >
                                <MapPin size={20} />
                                <span>عرض المنطقة على الخريطة</span>
                            </a>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CityCenterFinder;