import React, { useState, useEffect } from 'react';
import * as geminiService from '../services/geminiService';
import { RainingPlace } from '../types';
import LoadingSpinner from './common/LoadingSpinner';
import { CloudRain, AlertTriangle, RefreshCw, Droplets, Wind, Zap } from 'lucide-react';
import { parseDistance } from '../utils/helpers';

interface RainFinderProps {
    location: { lat: number; lon: number } | null;
    locationError: string | null;
}

const RainCard: React.FC<{ place: RainingPlace }> = ({ place }) => {
    const getIntensityColor = () => {
        switch (place.intensity) {
            case 'خفيف': return 'border-l-sky-400';
            case 'متوسط': return 'border-l-blue-500';
            case 'غزير': return 'border-l-indigo-600';
            default: return 'border-l-gray-400';
        }
    };

    const getIntensityIcon = () => {
        switch (place.intensity) {
            case 'خفيف': return <Droplets className="text-sky-400" size={20} />;
            case 'متوسط': return <Wind className="text-blue-500" size={20} />;
            case 'غزير': return <Zap className="text-indigo-600" size={20} />;
            default: return <CloudRain className="text-gray-400" size={20} />;
        }
    };

    return (
        <div className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex items-start gap-4 border-l-8 ${getIntensityColor()}`}>
            <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
                {getIntensityIcon()}
            </div>
            <div className="flex-grow">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{place.name}</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{place.description}</p>
                    </div>
                    <span className="text-sm font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">{place.distance}</span>
                </div>
                 <a 
                    href={place.mapsLink} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="mt-3 inline-block text-sm text-primary dark:text-primary-light font-semibold hover:underline"
                >
                    عرض على الخريطة &rarr;
                </a>
            </div>
        </div>
    );
};


const RainFinder: React.FC<RainFinderProps> = ({ location, locationError }) => {
    const [isSearching, setIsSearching] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<RainingPlace[] | null>(null);

    const handleSearch = async () => {
        if (!location) {
            setError(locationError || 'لا يمكن البحث بدون تحديد الموقع.');
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        setError(null);
        setResults(null);

        try {
            const response = await geminiService.findRainingPlaces(location);
            if(response && Array.isArray(response)) {
                 if (response.length === 0) {
                     setResults([]);
                 } else {
                    const sortedResults = response.sort((a, b) => parseDistance(a.distance) - parseDistance(b.distance));
                    setResults(sortedResults);
                 }
            } else {
                setError("لم نتمكن من جلب بيانات الطقس. حاول مرة أخرى.");
            }
        } catch (err) {
            setError('حدث خطأ أثناء البحث.');
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        handleSearch();
    }, [location]);

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="text-center p-6 bg-sky-500 dark:bg-sky-800/50 rounded-xl shadow-lg">
                <CloudRain className="mx-auto w-12 h-12 text-white mb-2" />
                <h2 className="text-2xl font-bold text-white">باحث الأمطار</h2>
                <p className="text-white/80">اعثر على الأماكن التي تمطر فيها بالقرب منك الآن</p>
            </div>

             <div className="text-center">
                 <button
                    onClick={handleSearch}
                    disabled={isSearching || !location}
                    className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-primary text-white rounded-lg font-semibold shadow-md hover:bg-primary-dark transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={isSearching ? 'animate-spin' : ''} size={20} />
                    <span>تحديث البيانات</span>
                </button>
            </div>

            {isSearching && <LoadingSpinner message="جاري البحث عن الأمطار..." />}
            
            {error && !isSearching &&
                <div className="p-4 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200 rounded-lg text-center flex items-center justify-center gap-2">
                    <AlertTriangle /> {error}
                </div>
            }
            
            {results && !isSearching && (
                <div className="space-y-4 animate-fade-in">
                    {results.length > 0 ? (
                        results.map((place, index) => <RainCard key={index} place={place} />)
                    ) : (
                        <div className="p-8 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-center">
                            <h3 className="text-xl font-bold">لا توجد أمطار قريبة حاليًا.</h3>
                            <p>استمتع بالطقس الجيد!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default RainFinder;
