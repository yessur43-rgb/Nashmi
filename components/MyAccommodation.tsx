import React, { useState, useEffect, useRef } from 'react';
import { Home, MapPin, Trash2, Camera, AlertTriangle, Save, Plus, ArrowRight } from 'lucide-react';
import LoadingSpinner from './common/LoadingSpinner';
import { compressImageAndConvertToBase64 } from '../utils/helpers';
import { AccommodationInfo } from '../types';
import * as db from '../services/dbService';

interface MyAccommodationProps {
    location: { lat: number; lon: number } | null;
    locationError: string | null;
}

const MyAccommodation: React.FC<MyAccommodationProps> = ({ location, locationError }) => {
    const [accommodations, setAccommodations] = useState<AccommodationInfo[]>([]);
    const [isDbLoading, setIsDbLoading] = useState(true);
    const [view, setView] = useState<'list' | 'form'>('list');
    const [name, setName] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        async function loadAccommodations() {
            const data = await db.getAllAccommodations();
            setAccommodations(data);
            setIsDbLoading(false);
        }
        loadAccommodations();
    }, []);

    const resetForm = () => {
        setName('');
        setPhotoFile(null);
        setPhotoPreview(null);
        setError(null);
    };

    const handleGoToForm = () => {
        resetForm();
        setView('form');
    };

    const handleGoToList = () => {
        setView('list');
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setPhotoFile(file);
            setPhotoPreview(URL.createObjectURL(file));
        }
        event.target.value = '';
    };

    const handleSaveAccommodation = async () => {
        if (!name.trim()) {
            setError('الرجاء إدخال اسم للسكن.');
            return;
        }
        if (!location) {
            setError(locationError || 'لا يمكن حفظ الموقع. يرجى تمكين الوصول للموقع.');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            let base64Image: string | undefined = undefined;
            if (photoFile) {
                base64Image = await compressImageAndConvertToBase64(photoFile);
            }

            const newAccommodation: AccommodationInfo = {
                id: Date.now().toString(),
                name: name.trim(),
                photoBase64: base64Image,
                location: location,
                timestamp: Date.now(),
            };

            await db.putAccommodation(newAccommodation);
            setAccommodations(prev => [...prev, newAccommodation]);
            
            setView('list');
            resetForm();

        } catch (err) {
            setError('حدث خطأ أثناء حفظ الموقع. حاول مرة أخرى.');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteAccommodation = async (idToDelete: string) => {
        if (window.confirm("هل أنت متأكد من رغبتك في حذف هذا السكن؟")) {
            await db.deleteAccommodation(idToDelete);
            setAccommodations(prev => prev.filter(acc => acc.id !== idToDelete));
        }
    };

    const renderForm = () => (
        <div className="animate-fade-in">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={handleGoToList} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ArrowRight size={24} />
                </button>
                <h2 className="text-2xl font-bold">إضافة سكن جديد</h2>
            </div>

            <div className="flex flex-col items-center justify-center text-center space-y-4">
                {photoPreview ? (
                     <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600">
                        <img src={photoPreview} alt="معاينة" className="w-full h-full object-cover" />
                     </div>
                ) : (
                    <div className="flex items-center justify-center w-full h-40 bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                        <p className="text-gray-500 dark:text-gray-400">التقط صورة (اختياري)</p>
                    </div>
                )}
                
                <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={cameraInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                />
                
                <div className="w-full max-w-sm space-y-3">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="اسم السكن (مثال: فندق إنترلاكن)"
                        className="w-full p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                        disabled={isLoading || !location}
                    />
                     <button
                        onClick={() => cameraInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-3 p-3 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                        <Camera size={20} />
                        <span>{photoFile ? 'تغيير الصورة' : 'التقاط صورة للسكن'}</span>
                    </button>
                    <button
                        onClick={handleSaveAccommodation}
                        disabled={isLoading || !location || !name.trim()}
                        className="w-full flex items-center justify-center gap-3 p-4 bg-primary text-white rounded-xl font-bold shadow-lg hover:bg-primary-dark transition-transform transform hover:scale-105 disabled:opacity-50"
                    >
                        <Save size={24} />
                        <span>حفظ السكن</span>
                    </button>
                </div>
                {!location && <p className="text-sm text-red-500 mt-2">{locationError}</p>}
                 {error &&
                    <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center flex items-center justify-center gap-2">
                        <AlertTriangle /> {error}
                    </div>
                 }
            </div>
        </div>
    );

    const renderList = () => (
        <div className="animate-fade-in space-y-6">
            <div className="text-center p-6 bg-cyan-500 dark:bg-cyan-800/50 rounded-xl shadow-lg">
                <Home className="mx-auto w-12 h-12 text-white mb-2" />
                <h2 className="text-2xl font-bold text-white">أماكن سكني</h2>
                <p className="text-white/80">
                    {accommodations.length > 0 ? `لديك ${accommodations.length} أماكن محفوظة.` : 'احفظ مواقع سكنك للعودة إليها بسهولة.'}
                </p>
            </div>

            {accommodations.length > 0 ? (
                <div className="space-y-4">
                    {accommodations.map(info => {
                        const mapLink = `https://www.google.com/maps?q=${info.location.lat},${info.location.lon}`;
                        return (
                             <div key={info.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 flex items-center gap-4">
                                {info.photoBase64 ? (
                                    <img
                                        src={`data:image/jpeg;base64,${info.photoBase64}`}
                                        alt={info.name}
                                        className="w-24 h-24 object-cover rounded-lg flex-shrink-0"
                                    />
                                ) : (
                                    <div className="w-24 h-24 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                                        <Home className="w-10 h-10 text-gray-400" />
                                    </div>
                                )}
                                <div className="flex-grow flex flex-col justify-between self-stretch">
                                    <div>
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-lg font-bold leading-tight">{info.name}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap flex-shrink-0 mr-2">
                                                {new Date(info.timestamp).toLocaleDateString('ar-EG', { numberingSystem: 'latn' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <a
                                            href={mapLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-grow flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-lg font-semibold shadow-sm hover:bg-primary-dark transition-colors text-sm"
                                        >
                                            <MapPin size={16} />
                                            <span>العودة إليه</span>
                                        </a>
                                        <button
                                            onClick={() => handleDeleteAccommodation(info.id)}
                                            className="flex-grow flex items-center justify-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg font-semibold shadow-sm hover:bg-red-700 transition-colors text-sm"
                                        >
                                            <Trash2 size={16} />
                                            <span>مسح</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center p-8 border-2 border-dashed rounded-lg">
                    <p className="mb-4">لم تقم بحفظ أي سكن بعد.</p>
                </div>
            )}
             <button
                onClick={handleGoToForm}
                className="w-full flex items-center justify-center gap-3 p-4 bg-secondary text-gray-900 rounded-xl font-bold shadow-lg hover:bg-yellow-500 transition-transform transform hover:scale-105"
            >
                <Plus size={24} />
                <span>إضافة سكن جديد</span>
            </button>
        </div>
    );
    
    if (isDbLoading) {
        return <LoadingSpinner message="جاري تحميل البيانات..." />;
    }

    return (
        <div className="p-4 md:p-6">
            {isLoading ? <LoadingSpinner message="جاري الحفظ..." /> : (
                view === 'list' ? renderList() : renderForm()
            )}
        </div>
    );
};

export default MyAccommodation;
