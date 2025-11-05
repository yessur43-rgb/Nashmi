import React, { useState, useEffect, useRef } from 'react';
import { Car, MapPin, Trash2, Camera, Sparkles, AlertTriangle, Search, Clock, Ticket, Gift, ParkingCircle } from 'lucide-react';
import LoadingSpinner from './common/LoadingSpinner';
import * as geminiService from '../services/geminiService';
import { compressImageAndConvertToBase64 } from '../utils/helpers';
import { ParkingLot, ParkingInfo } from '../types';
import * as db from '../services/dbService';

interface ParkMyCarProps {
    location: { lat: number; lon: number } | null;
    locationError: string | null;
}

const ParkingLotCard: React.FC<{ lot: ParkingLot }> = ({ lot }) => {
    const getTypeIcon = () => {
        switch (lot.parkingType) {
            case 'بالساعة': return <Clock className="text-blue-500" />;
            case 'تدفع عند الخروج': return <Ticket className="text-green-500" />;
            case 'مجاني': return <Gift className="text-yellow-500" />;
            default: return <ParkingCircle className="text-gray-500" />;
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-col items-start gap-3 transition-transform transform hover:scale-[1.02]">
            <div className="w-full flex justify-between items-start">
                <div className="flex items-start gap-4">
                     <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full">
                        {getTypeIcon()}
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{lot.name}</h3>
                        <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{lot.parkingType}</p>
                    </div>
                </div>
                <span className="text-sm font-bold text-gray-600 dark:text-gray-300 whitespace-nowrap bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full">{lot.distance}</span>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{lot.details}</p>
            <a 
                href={lot.mapsLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="mt-2 flex items-center justify-center gap-2 w-full px-4 py-2 bg-primary text-white rounded-lg font-semibold shadow-sm hover:bg-primary-dark transition-colors"
            >
                <MapPin size={18} />
                <span>عرض على الخريطة</span>
            </a>
        </div>
    );
};


const ParkMyCar: React.FC<ParkMyCarProps> = ({ location, locationError }) => {
    const [parkingInfo, setParkingInfo] = useState<ParkingInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDbLoading, setIsDbLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    const [isSearchingParking, setIsSearchingParking] = useState(false);
    const [parkingResults, setParkingResults] = useState<ParkingLot[] | null>(null);
    const [parkingSearchError, setParkingSearchError] = useState<string | null>(null);

    useEffect(() => {
        async function loadParkingInfo() {
            const info = await db.getParkingInfo();
            if (info) {
                setParkingInfo(info);
            }
            setIsDbLoading(false);
        }
        loadParkingInfo();
    }, []);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            await handleParkCar(file);
        }
        event.target.value = ''; // Reset for re-selection
    };

    const handleParkCar = async (file: File) => {
        if (!location) {
            setError(locationError || 'لا يمكن حفظ الموقع. يرجى تمكين الوصول للموقع.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const base64Image = await compressImageAndConvertToBase64(file);
            const description = await geminiService.describeParkingLocation(base64Image, location);

            const newParkingInfo: ParkingInfo = {
                photoBase64: base64Image,
                description: description || 'تم حفظ الموقع بنجاح.',
                location: location,
                timestamp: Date.now(),
            };

            await db.putParkingInfo(newParkingInfo);
            setParkingInfo(newParkingInfo);

        } catch (err) {
            setError('حدث خطأ أثناء حفظ الموقع. حاول مرة أخرى.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteParking = async () => {
        await db.deleteParkingInfo();
        setParkingInfo(null);
    };

    const handleFindParking = async () => {
        if (!location) {
            setParkingSearchError(locationError || 'لا يمكن البحث بدون تحديد الموقع.');
            return;
        }
        setIsSearchingParking(true);
        setParkingResults(null);
        setParkingSearchError(null);

        try {
            const results = await geminiService.findNearbyParking(location);
            if (results && results.length > 0) {
                setParkingResults(results);
            } else {
                setParkingSearchError('لم يتم العثور على مواقف قريبة.');
            }
        } catch (error) {
            console.error("Error finding parking:", error);
            setParkingSearchError('حدث خطأ أثناء البحث عن المواقف.');
        } finally {
            setIsSearchingParking(false);
        }
    };

    const renderNotParked = () => (
        <div className="flex flex-col items-center justify-center text-center p-8 space-y-6">
            <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                ref={cameraInputRef}
                onChange={handleFileChange}
                className="hidden"
            />
            <Car size={80} className="text-primary dark:text-primary-light" />
            <h2 className="text-2xl font-bold">لم تسجل موقع سيارتك بعد</h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-sm">
                عندما توقف سيارتك، التقط صورة للمكان. أو ابحث عن مواقف عامة قريبة منك.
            </p>
            <div className="w-full max-w-xs space-y-3">
                <button
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isLoading || !location}
                    className="w-full flex items-center justify-center gap-3 p-4 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-transform transform hover:scale-105 disabled:opacity-50"
                >
                    <Camera size={24} />
                    <span>أوقفت سيارتي هنا</span>
                </button>
                 <button
                    onClick={handleFindParking}
                    disabled={isSearchingParking || !location}
                    className="w-full flex items-center justify-center gap-3 p-4 bg-secondary text-gray-900 rounded-xl font-bold shadow-lg hover:bg-yellow-500 transition-transform transform hover:scale-105 disabled:opacity-50"
                >
                    <Search size={24} />
                    <span>ابحث عن مواقف قريبة</span>
                </button>
            </div>
            {!location && <p className="text-sm text-red-500 mt-2">{locationError}</p>}
        </div>
    );

    const renderParked = (info: ParkingInfo) => {
        const mapLink = `https://www.google.com/maps?q=${info.location.lat},${info.location.lon}`;
        const parkedTime = new Date(info.timestamp).toLocaleString('ar-EG', {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true,
            numberingSystem: 'latn'
        });

        return (
            <div className="space-y-6 animate-fade-in">
                <img src={`data:image/jpeg;base64,${info.photoBase64}`} alt="مكان وقوف السيارة" className="w-full rounded-xl shadow-lg aspect-video object-cover" />
                
                <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <Sparkles className="text-secondary" size={24}/>
                        <h3 className="text-xl font-bold">وصف المكان</h3>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 text-lg">{info.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">تم الحفظ في: {parkedTime}</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <a
                        href={mapLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-3 p-4 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-transform transform hover:scale-105"
                    >
                        <MapPin size={24} />
                        <span>العودة إلى سيارتي</span>
                    </a>
                    <button
                        onClick={handleDeleteParking}
                        className="w-full flex items-center justify-center gap-3 p-4 bg-red-600 text-white rounded-xl font-bold shadow-lg hover:bg-red-700 transition-transform transform hover:scale-105"
                    >
                        <Trash2 size={24} />
                        <span>لقد وجدت سيارتي</span>
                    </button>
                </div>
            </div>
        );
    };

    if (isDbLoading) {
        return <LoadingSpinner message="جاري تحميل البيانات..." />;
    }

    return (
        <div className="p-4 md:p-6">
            {error &&
                <div className="p-4 mb-4 bg-red-100 text-red-700 rounded-lg text-center flex items-center justify-center gap-2">
                    <AlertTriangle /> {error}
                </div>
            }
            {isLoading ? <LoadingSpinner message="جارٍ حفظ موقع سيارتك..." /> : (
                parkingInfo ? renderParked(parkingInfo) : renderNotParked()
            )}

            {isSearchingParking && <LoadingSpinner message="جاري البحث عن مواقف..." />}

            {parkingSearchError && (
                <div className="p-4 mt-6 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 rounded-lg text-center flex items-center justify-center gap-2">
                    <AlertTriangle /> {parkingSearchError}
                </div>
            )}
            
            {parkingResults && (
                <div className="mt-8 space-y-4">
                     <h3 className="text-2xl font-bold text-center">المواقف القريبة</h3>
                     {parkingResults.map((lot, index) => (
                        <ParkingLotCard key={index} lot={lot} />
                     ))}
                </div>
            )}
        </div>
    );
};

export default ParkMyCar;
