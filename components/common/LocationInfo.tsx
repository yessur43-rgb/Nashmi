import React from 'react';
import { MapPin, AlertTriangle, Loader2 } from 'lucide-react';

interface LocationInfoProps {
    location: { lat: number; lon: number } | null;
    error: string | null;
    isLoading: boolean;
}

const LocationInfo: React.FC<LocationInfoProps> = ({ location, error, isLoading }) => {
    if (isLoading) {
        return (
            <div className="p-2 text-sm text-center bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 flex items-center justify-center gap-2 sticky top-[65px] z-10">
                <Loader2 className="animate-spin" size={16} />
                <span>جاري تحديد موقعك...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-2 text-sm text-center bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 flex items-center justify-center gap-2 sticky top-[65px] z-10">
                <AlertTriangle size={16} />
                <span>{error}</span>
            </div>
        );
    }

    if (location) {
        return (
            <div className="p-2 text-sm text-center bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 flex items-center justify-center gap-2 sticky top-[65px] z-10">
                <MapPin size={16} />
                <span className="font-mono">
                    {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                </span>
            </div>
        );
    }

    return null;
};

export default LocationInfo;
