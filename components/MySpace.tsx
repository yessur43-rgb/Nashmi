

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
// FIX: Imported JournalImageAnalysis to resolve type error.
import { Trip, JournalEntry, JournalPhoto, JournalVideo, Expense, JournalImageAnalysis } from '../types';
import * as db from '../services/dbService';
import * as geminiService from '../services/geminiService';
// FIX: Imported getSupportedVideoMimeType to resolve error.
import { blobToBase64, compressImageAndConvertToBase64, generateThumbnail, generateVideoThumbnail, trimVideoBlob, removeAudioFromVideo, getLocalDateString } from '../utils/helpers';
import LoadingSpinner from './common/LoadingSpinner';
import AudioRecorder from './common/AudioRecorder';
import StorageUsage from './common/StorageUsage';

import { 
    User, Plus, ArrowRight, Trash2, Edit, Download, Sparkles, ChevronsRight,
    Camera, Video, DollarSign, Mic, Image as ImageIcon, Video as VideoIcon, VolumeX,
    Receipt, Type, Save, X, MapPin, BookOpen, Share2, Loader2,
    Library, Grid, Clapperboard, Filter, CheckSquare, XCircle, FileArchive, BookText
} from 'lucide-react';

interface ToolProps {
  location: { lat: number; lon: number } | null;
  locationError: string | null;
}

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const dispatchStorageUpdate = () => {
    window.dispatchEvent(new CustomEvent('custom-storage-update'));
};

const StoryViewer: React.FC<{ trip: Trip; onBack: () => void; }> = ({ trip, onBack }) => {
    const [canShare, setCanShare] = useState(false);

    useEffect(() => {
        if (trip.exportedStoryHtml && navigator.share && navigator.canShare) {
            const storyBlob = new Blob([trip.exportedStoryHtml], { type: 'text/html' });
            // FIX: Corrected the order of arguments for the File constructor.
            const storyFile = new File([storyBlob], `${trip.name}.html`, { type: 'text/html' });
            if (navigator.canShare({ files: [storyFile] })) {
                setCanShare(true);
            }
        }
    }, [trip.name, trip.exportedStoryHtml]);

    const handleShare = async () => {
        if (!trip.exportedStoryHtml) return;
        const storyBlob = new Blob([trip.exportedStoryHtml], { type: 'text/html' });
        // FIX: Corrected the order of arguments for the File constructor.
        const storyFile = new File([storyBlob], `${trip.name}.html`, { type: 'text/html' });
        try {
            await navigator.share({
                title: `قصة رحلتي: ${trip.name}`,
                text: `ألقِ نظرة على قصة رحلتي الرائعة "${trip.name}"!`,
                files: [storyFile],
            });
        } catch (error) {
            console.error('Error sharing story:', error);
        }
    };
    
    if (!trip.exportedStoryHtml) {
        return (
            <div className="p-4 md:p-6 animate-fade-in">
                <button onClick={onBack} className="flex items-center gap-2 mb-4 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ArrowRight />
                    <span>الرجوع</span>
                </button>
                <div className="text-center p-8 border-2 border-dashed rounded-lg text-gray-500">
                    <p className="text-xl">لم يتم إنشاء القصة لهذه الرحلة بعد.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fade-in flex flex-col h-full w-full">
            <div className="flex-shrink-0 flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ArrowRight size={24} />
                </button>
                <h2 className="text-xl font-bold truncate px-4">قصة: {trip.name}</h2>
                 <div className="w-10 h-10">
                    {canShare && (
                        <button onClick={handleShare} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="مشاركة القصة">
                            <Share2 size={24} />
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-grow w-full relative">
                <iframe
                    srcDoc={trip.exportedStoryHtml}
                    className="w-full h-full border-none absolute inset-0"
                    title={`Trip Story - ${trip.name}`}
                    sandbox="allow-scripts"
                />
            </div>
        </div>
    );
};

// Main Component
const MySpace: React.FC<ToolProps> = ({ location }) => {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [currentView, setCurrentView] = useState<'list' | 'tripForm' | 'tripDetails' | 'entryForm' | 'storyViewer'>('list');
    const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadTrips = useCallback(async () => {
        setIsLoading(true);
        try {
            const fetchedTrips = await db.getAllTrips();
            setTrips(fetchedTrips);
        } catch (err) {
            setError("Failed to load trips.");
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadTrips();
    }, [loadTrips]);

    const handleSaveTrip = async (tripData: Omit<Trip, 'id' | 'entries' | 'endDate'>) => {
        const newTrip: Trip = { ...tripData, id: generateId(), entries: [] };
        await db.putTrip(newTrip);
        setTrips(prev => [newTrip, ...prev].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
        setCurrentView('list');
        dispatchStorageUpdate();
    };

    const handleUpdateTrip = useCallback(async (updatedTrip: Trip) => {
        await db.putTrip(updatedTrip);
        setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
        setSelectedTrip(updatedTrip); // Keep selected trip updated
        dispatchStorageUpdate();
    }, []);

    const handleDeleteTrip = async (tripId: string) => {
        if (window.confirm("هل أنت متأكد من حذف هذه الرحلة وكل يومياتها؟")) {
            await db.deleteTrip(tripId);
            setTrips(prev => prev.filter(t => t.id !== tripId));
            setCurrentView('list');
            setSelectedTrip(null);
            dispatchStorageUpdate();
        }
    };
    
    const handleDeleteStory = async (tripId: string) => {
        if (window.confirm("هل أنت متأكد من حذف هذه القصة؟ لا يمكن التراجع عن هذا الإجراء.")) {
            const tripToUpdate = trips.find(t => t.id === tripId);
            if (tripToUpdate) {
                const updatedTrip = { ...tripToUpdate };
                delete updatedTrip.exportedStoryHtml;
                await handleUpdateTrip(updatedTrip);
            }
        }
    };

    if (isLoading) return <LoadingSpinner message="جاري تحميل رحلاتك..." />;

    switch (currentView) {
        case 'tripForm':
            return <TripForm onSave={handleSaveTrip} onCancel={() => setCurrentView('list')} />;
        case 'tripDetails':
            return selectedTrip && <TripDetails 
                trip={selectedTrip} 
                onBack={() => { setCurrentView('list'); setSelectedTrip(null); }} 
                onEditEntry={(entry) => { setSelectedEntry(entry); setCurrentView('entryForm'); }}
                onAddEntry={() => { setSelectedEntry(null); setCurrentView('entryForm'); }}
                onDeleteTrip={handleDeleteTrip}
                onUpdateTrip={handleUpdateTrip}
                onViewStory={() => setCurrentView('storyViewer')}
            />;
        case 'entryForm':
            return selectedTrip && <JournalEntryForm 
                trip={selectedTrip} 
                entry={selectedEntry} 
                onSave={async (updatedTrip) => {
                    await handleUpdateTrip(updatedTrip);
                    setCurrentView('tripDetails');
                    setSelectedEntry(null);
                }} 
                onCancel={() => { setCurrentView('tripDetails'); setSelectedEntry(null); }}
                location={location}
            />;
         case 'storyViewer':
            return selectedTrip && <StoryViewer 
                trip={selectedTrip} 
                onBack={() => { setCurrentView(selectedTrip.entries.length > 0 ? 'tripDetails' : 'list');}} 
            />;
        default:
            return <TripAndStoryList 
                trips={trips}
                onSelectTrip={(trip) => { setSelectedTrip(trip); setCurrentView('tripDetails'); }} 
                onAddTrip={() => setCurrentView('tripForm')} 
                onViewStory={(trip) => { setSelectedTrip(trip); setCurrentView('storyViewer'); }}
                onDeleteStory={handleDeleteStory}
            />;
    }
};

const TripAndStoryList: React.FC<{
    trips: Trip[];
    onSelectTrip: (trip: Trip) => void;
    onAddTrip: () => void;
    onViewStory: (trip: Trip) => void;
    onDeleteStory: (tripId: string) => void;
}> = ({ trips, onSelectTrip, onAddTrip, onViewStory, onDeleteStory }) => {
    const [activeTab, setActiveTab] = useState<'trips' | 'stories'>('trips');
    const stories = trips.filter(t => t.exportedStoryHtml);

    const getFirstImage = (trip: Trip): string | null => {
        for (const entry of trip.entries) {
            if (entry.photos && entry.photos.length > 0) {
                const photo = entry.photos[0];
                return `data:image/jpeg;base64,${photo.thumbnailBase64 || photo.base64}`;
            }
        }
        return null;
    };

    return (
        <div className="p-4 md:p-6 space-y-6 animate-fade-in">
            <div className="text-center p-6 bg-green-500 dark:bg-green-800/50 rounded-xl shadow-lg">
                <User className="mx-auto w-12 h-12 text-white mb-2" />
                <h2 className="text-2xl font-bold text-white">مساحتي</h2>
                <p className="text-white/80">دفتر رحلاتك الشخصي والذكي</p>
            </div>

            <div className="flex border-b border-gray-300 dark:border-gray-600">
                <button
                    onClick={() => setActiveTab('trips')}
                    className={`flex-1 text-center py-3 font-semibold transition-colors ${activeTab === 'trips' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}
                >
                    الرحلات ({trips.length})
                </button>
                <button
                    onClick={() => setActiveTab('stories')}
                    className={`flex-1 text-center py-3 font-semibold transition-colors ${activeTab === 'stories' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary'}`}
                >
                    القصص ({stories.length})
                </button>
            </div>
            
            {activeTab === 'trips' && (
                <div className="space-y-4 animate-fade-in">
                    <button onClick={onAddTrip} className="w-full flex items-center justify-center gap-2 p-4 bg-primary text-white rounded-lg font-bold shadow-lg hover:bg-primary-dark transition-colors">
                        <Plus /><span>إضافة رحلة جديدة</span>
                    </button>
                    {trips.length > 0
                        ? trips.map(trip => {
                            const today = getLocalDateString();
                            const isCompleted = trip.endDate && trip.endDate < today;
                            const isActive = trip.startDate <= today && !isCompleted;

                            return (
                                <div key={trip.id} onClick={() => onSelectTrip(trip)} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md cursor-pointer hover:shadow-lg transition-shadow">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="text-xl font-bold">{trip.name}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                                                {trip.startDate} {trip.endDate ? ` - ${trip.endDate}` : ''}
                                            </p>
                                        </div>
                                        {isCompleted ? (
                                            <span className="text-xs font-bold text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                                                مكتملة
                                            </span>
                                        ) : isActive ? (
                                            <span className="text-xs font-bold text-green-700 bg-green-100 dark:bg-green-900/50 dark:text-green-300 px-2 py-1 rounded-full">
                                                جارية
                                            </span>
                                        ) : (
                                             <span className="text-xs font-bold text-blue-700 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-300 px-2 py-1 rounded-full">
                                                قادمة
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
                                        <span>{trip.entries.length} يوميات</span>
                                        <div className="flex items-center gap-1 text-primary dark:text-primary-light">
                                            <span>عرض التفاصيل</span><ChevronsRight size={16} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                        : <div className="text-center p-8 border-2 border-dashed rounded-lg text-gray-500">لم تقم بإضافة أي رحلات بعد.</div>
                    }
                </div>
            )}
            {activeTab === 'stories' && (
                <div className="space-y-4 animate-fade-in">
                    {stories.length > 0
                        ? stories.map(trip => {
                            const firstImage = getFirstImage(trip);
                            return (
                                <div key={trip.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 flex-grow cursor-pointer" onClick={() => onViewStory(trip)}>
                                        {firstImage ? (
                                            <img src={firstImage} alt={trip.name} className="w-24 h-24 object-cover rounded-lg flex-shrink-0" loading="lazy" />
                                        ) : (
                                            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <BookOpen className="text-gray-400" size={32} />
                                            </div>
                                        )}
                                        <div className="flex-grow">
                                            <h3 className="text-xl font-bold">{trip.name}</h3>
                                            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{trip.startDate} - {trip.endDate}</p>
                                            <div className="flex items-center gap-1 mt-2 text-primary dark:text-primary-light text-sm font-semibold">
                                                <span>عرض القصة</span><ChevronsRight size={16} />
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDeleteStory(trip.id); }}
                                        className="p-3 text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 flex-shrink-0"
                                        aria-label="حذف القصة"
                                    >
                                        <Trash2 size={22} />
                                    </button>
                                </div>
                            );
                        })
                        : <div className="text-center p-8 border-2 border-dashed rounded-lg text-gray-500">لم تقم بإنشاء أي قصص بعد.</div>
                    }
                </div>
            )}
            
            <StorageUsage />
        </div>
    );
};


const TripForm: React.FC<{onSave: (trip: Omit<Trip, 'id' | 'entries' | 'endDate'>) => void; onCancel: () => void;}> = ({ onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState(getLocalDateString());
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!name || !startDate) { setError("يرجى ملء جميع الحقول."); return; }
        setError(''); onSave({ name, startDate });
    };

    return (
        <div className="p-4 md:p-6 space-y-4 animate-fade-in bg-white dark:bg-gray-800 rounded-xl shadow-lg">
             <h2 className="text-2xl font-bold text-center">رحلة جديدة</h2>
            {error && <p className="text-red-500 text-center">{error}</p>}
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="اسم الرحلة (مثال: رحلة سويسرا ٢٠٢٤)" className="w-full p-3 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600" />
            <div className="grid grid-cols-1">
                <div>
                    <label className="block text-sm font-medium mb-1">تاريخ البدء</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
            </div>
            <div className="flex gap-4">
                <button onClick={onCancel} className="w-full p-3 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold">إلغاء</button>
                <button onClick={handleSubmit} className="w-full p-3 bg-primary text-white rounded-lg font-semibold">بدء الرحلة</button>
            </div>
        </div>
    );
};

const TripDetails: React.FC<{
    trip: Trip; 
    onBack: () => void; 
    onEditEntry: (entry: JournalEntry) => void; 
    onAddEntry: () => void; 
    onDeleteTrip: (tripId: string) => void;
    onUpdateTrip: (updatedTrip: Trip) => void;
    onViewStory: () => void;
}> = ({ trip, onBack, onAddEntry, onEditEntry, onDeleteTrip, onUpdateTrip, onViewStory }) => {
    const [summary, setSummary] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(trip.name);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ENTRIES_PER_PAGE = 10;
    
    useEffect(() => {
        const today = getLocalDateString();
        const hasTodayEntry = trip.entries.some(e => e.date === today);

        if (!hasTodayEntry && trip.startDate <= today && (!trip.endDate || today <= trip.endDate)) {
            const newEntry: JournalEntry = {
                id: generateId(),
                date: today,
                title: `يوميات ${today}`,
                notes: '',
                photos: [],
                videos: [],
                expenses: [],
            };
            const updatedTrip = { ...trip, entries: [newEntry, ...trip.entries] };
            onUpdateTrip(updatedTrip);
        }
    }, [trip, onUpdateTrip]);

    const sortedEntries = useMemo(() => 
        trip.entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [trip.entries]);

    const displayedEntries = useMemo(() =>
        sortedEntries.slice(0, currentPage * ENTRIES_PER_PAGE),
    [sortedEntries, currentPage]);

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    const handleSaveName = () => {
        if (editedName.trim() && editedName.trim() !== trip.name) {
            onUpdateTrip({ ...trip, name: editedName.trim() });
        }
        setIsEditingName(false);
    };
    
    const handleEndTrip = () => {
        if (window.confirm("هل أنت متأكد من إنهاء هذه الرحلة؟ لا يمكنك إضافة يوميات جديدة بعد إنهائها.")) {
            const today = getLocalDateString();
            onUpdateTrip({ ...trip, endDate: today });
        }
    };

    const isOngoing = !trip.endDate || trip.endDate >= getLocalDateString();

    const grandTotal = trip.entries.reduce((tripSum, entry) =>
        tripSum + entry.expenses.reduce((entrySum, exp) => entrySum + exp.amountInSAR, 0),
    0);

    const handleSummarize = async () => {
        setIsProcessing(true);
        const result = await geminiService.summarizeEntireTrip(trip.entries);
        setSummary(result);
        setIsProcessing(false);
    };

    const handleGenerateStory = async () => {
        setIsProcessing(true);
        try {
            const storySummary = summary || await geminiService.summarizeEntireTrip(trip.entries);
            if(storySummary && !summary) setSummary(storySummary);
            
            const mediaMap = new Map<string, string>();
            trip.entries.forEach(entry => {
                entry.photos.forEach(photo => mediaMap.set(photo.id, `data:image/jpeg;base64,${photo.base64}`));
                entry.videos.forEach(video => mediaMap.set(video.id, `data:${video.mimeType};base64,${video.base64}`));
            });

            const simplifiedTrip: any = {
                ...trip,
                entries: trip.entries.map(entry => ({
                    ...entry,
                    photos: entry.photos.map(p => ({ id: p.id, lat: p.lat, lon: p.lon, description: p.description })),
                    videos: entry.videos.map(v => ({ id: v.id, lat: v.lat, lon: v.lon, description: v.description })),
                    expenses: entry.expenses.map(({ photos, ...rest }) => rest)
                }))
            };
            
            const htmlTemplate = await geminiService.generateTripHtmlStory(simplifiedTrip, storySummary);

            if (htmlTemplate) {
                let finalHtml = htmlTemplate;
                mediaMap.forEach((dataUrl, id) => {
                    const srcPattern = new RegExp(`src=["']${id}["']`, 'g');
                    finalHtml = finalHtml.replace(srcPattern, `src="${dataUrl}"`);
                    const bgUrlPattern = new RegExp(`url\\(["']${id}["']\\)`, 'g');
                    finalHtml = finalHtml.replace(bgUrlPattern, `url("${dataUrl}")`);
                });

                const updatedTrip = { ...trip, exportedStoryHtml: finalHtml };
                onUpdateTrip(updatedTrip);
                onViewStory();
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDeleteEntry = (entryId: string) => {
        if (window.confirm("هل أنت متأكد من حذف هذه اليوميات؟")) {
            const updatedEntries = trip.entries.filter(e => e.id !== entryId);
            onUpdateTrip({ ...trip, entries: updatedEntries });
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between gap-2">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ArrowRight size={24} /></button>
                {isEditingName ? (
                    <input
                        ref={nameInputRef}
                        type="text"
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        onBlur={handleSaveName}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                        className="text-2xl font-bold text-center flex-grow bg-transparent border-b-2 border-primary dark:border-primary-light focus:outline-none mx-2"
                    />
                ) : (
                    <h2 className="text-2xl font-bold text-center flex-grow truncate px-2" onClick={() => setIsEditingName(true)}>{trip.name}</h2>
                )}
                <div className="flex items-center">
                    <button onClick={() => isEditingName ? handleSaveName() : setIsEditingName(true)} className="p-2 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        {isEditingName ? <Save size={20} /> : <Edit size={20} />}
                    </button>
                    <button onClick={() => onDeleteTrip(trip.id)} className="p-2 text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50"><Trash2 size={20} /></button>
                </div>
            </div>
             {grandTotal > 0 && (
                 <div className="text-center text-lg text-gray-500 dark:text-gray-400 -mt-4">
                    إجمالي مصاريف الرحلة: <span className="font-bold text-primary dark:text-primary-light">{grandTotal.toFixed(2)} SAR</span>
                </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button onClick={handleSummarize} disabled={isProcessing || trip.entries.length === 0} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-secondary text-gray-900 rounded-lg font-semibold shadow-md hover:bg-yellow-500 disabled:opacity-50">
                    <Sparkles size={20}/><span>لخص الرحلة</span>
                </button>
                {trip.exportedStoryHtml ? (
                    <button onClick={onViewStory} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-500 text-white rounded-lg font-semibold shadow-md hover:bg-green-600">
                        <BookOpen size={20} />
                        <span>عرض القصة</span>
                    </button>
                ) : (
                    <button onClick={handleGenerateStory} disabled={isProcessing} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold shadow-md hover:bg-blue-600 disabled:opacity-50">
                        <Download size={20}/><span>إنشاء قصة</span>
                    </button>
                )}
            </div>

            {isProcessing && <LoadingSpinner message="جاري العمل..." />}
            {summary && <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow whitespace-pre-wrap">{summary}</div>}
            
            {isOngoing && (
                 <button onClick={onAddEntry} className="w-full flex items-center justify-center gap-2 p-4 bg-primary text-white rounded-lg font-bold shadow-lg hover:bg-primary-dark">
                    <Plus /><span>إضافة يوميات جديدة</span>
                </button>
            )}

            <div className="relative pt-8">
                 <span className="absolute top-1/2 left-0 w-full h-px bg-gray-300 dark:bg-gray-600"></span>
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 bg-gray-50 dark:bg-gray-900 font-bold">
                     الجدول الزمني للرحلة
                 </div>
            </div>
             <div className="space-y-4">
                 {displayedEntries.map(entry => {
                     const dailyTotal = entry.expenses.reduce((sum, exp) => sum + exp.amountInSAR, 0);
                     const words = (entry.notes || '').split(/\s+/);
                     const snippet = words.length > 10
                        ? words.slice(0, 10).join(' ') + '...'
                        : (entry.notes || 'لا توجد ملاحظات.');

                     return (
                         <div key={entry.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md hover:shadow-lg transition-shadow flex items-center gap-3">
                             <button onClick={() => onEditEntry(entry)} className="p-3 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 flex-shrink-0" aria-label="تعديل اليومية">
                                 <Edit size={20} />
                             </button>
                             <div className="flex-grow min-w-0 cursor-pointer" onClick={() => onEditEntry(entry)}>
                                 <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{entry.title || `يوميات ${entry.date}`}</h3>
                                 <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{entry.date}</p>
                                 <p className="mt-2 text-gray-600 dark:text-gray-300 break-words">{snippet}</p>
                                 {dailyTotal > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">إجمالي الصرف اليومي:</span>
                                        <span className="text-md font-bold text-primary dark:text-primary-light">{dailyTotal.toFixed(2)} SAR</span>
                                    </div>
                                )}
                             </div>
                             <button onClick={() => handleDeleteEntry(entry.id)} className="p-3 text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 flex-shrink-0" aria-label="حذف اليومية">
                                 <Trash2 size={20} />
                             </button>
                         </div>
                     );
                 })}
                {sortedEntries.length > displayedEntries.length && (
                    <button 
                        onClick={() => setCurrentPage(p => p + 1)} 
                        className="w-full text-center py-3 text-primary dark:text-primary-light font-semibold hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg">
                        تحميل المزيد
                    </button>
                )}
                 {!isOngoing && displayedEntries.length === 0 && (
                     <p className="text-center text-gray-500 py-4">لم يتم إضافة أي يوميات لهذه الرحلة.</p>
                 )}
             </div>
             {isOngoing && (
                <div className="text-center mt-6">
                    <button 
                        onClick={handleEndTrip}
                        className="flex items-center justify-center gap-2 mx-auto px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-lg font-semibold hover:bg-red-200 dark:hover:bg-red-900"
                    >
                        <CheckSquare size={18} />
                        <span>إنهاء الرحلة</span>
                    </button>
                </div>
            )}
        </div>
    );
};

const JournalEntryForm: React.FC<{trip: Trip; entry: JournalEntry | null; onSave: (trip: Trip) => void; onCancel: () => void; location: { lat: number; lon: number } | null;}> = ({ trip, entry, onSave, onCancel, location }) => {
    const [currentEntry, setCurrentEntry] = useState<JournalEntry>(entry || { id: generateId(), date: getLocalDateString(), title: '', notes: '', photos: [], videos: [], expenses: [] });
    const [isProcessing, setIsProcessing] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [fullscreenMedia, setFullscreenMedia] = useState<{ type: 'image' | 'video'; data: string; mimeType?: string; } | null>(null);
    const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(null);
    const [processingVideoId, setProcessingVideoId] = useState<string | null>(null);
    const [isStoryMode, setIsStoryMode] = useState(false);
    const [enhancingPhotoId, setEnhancingPhotoId] = useState<string | null>(null);

    // Media processing queue state
    const [mediaQueue, setMediaQueue] = useState<{ file: File; totalInBatch: number }[]>([]);
    const [isProcessingMedia, setIsProcessingMedia] = useState(false);
    const [processingStatus, setProcessingStatus] = useState('');


    // Expense Modal State
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isProcessingExpense, setIsProcessingExpense] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [expenseData, setExpenseData] = useState<{
        description: string;
        amountText: string;
        amount: number | null;
        currency: string | null;
        amountInSAR: number | null;
        photo?: JournalPhoto | null;
    }>({ description: '', amountText: '', amount: null, currency: null, amountInSAR: null, photo: null });
    const expenseReceiptInputRef = useRef<HTMLInputElement>(null);
    const expensePhotoInputRef = useRef<HTMLInputElement>(null);

    const updateEntry = (updates: Partial<JournalEntry>) => setCurrentEntry(prev => ({ ...prev, ...updates }));
    const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));


    useEffect(() => {
        let objectUrl: string | null = null;
        if (fullscreenMedia?.type === 'video') {
            try {
                const byteCharacters = atob(fullscreenMedia.data);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: fullscreenMedia.mimeType });
                objectUrl = URL.createObjectURL(blob);
                setVideoObjectUrl(objectUrl);
            } catch(e) {
                console.error("Failed to create blob from base64 data for video playback.", e);
                setVideoObjectUrl(`data:${fullscreenMedia.mimeType};base64,${fullscreenMedia.data}`);
            }
        } else {
            setVideoObjectUrl(null); // Clear if not a video
        }
        
        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [fullscreenMedia]);

    const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const MAX_PHOTO_SIZE_MB = 20;
        const MAX_VIDEO_SIZE_MB = 100;
        const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;
        const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

        if (!e.target.files) return;
        const allFiles: File[] = Array.from(e.target.files);
        if (allFiles.length === 0) return;

        setFormError(null);

        const validFiles: File[] = [];
        const oversizedFiles: string[] = [];

        allFiles.forEach(file => {
            if (file.type.startsWith('image/') && file.size > MAX_PHOTO_SIZE_BYTES) {
                oversizedFiles.push(`${file.name} (أكبر من ${MAX_PHOTO_SIZE_MB} ميجابايت)`);
            } else if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE_BYTES) {
                oversizedFiles.push(`${file.name} (أكبر من ${MAX_VIDEO_SIZE_MB} ميجابايت)`);
            } else {
                validFiles.push(file);
            }
        });

        if (oversizedFiles.length > 0) {
            setFormError(`تم تخطي بعض الملفات لأنها كبيرة جدًا: ${oversizedFiles.join(', ')}`);
        }
        
        if (validFiles.length === 0) {
             e.target.value = ''; // Reset file input
            return;
        }

        const newQueueItems = validFiles.map(file => ({ file, totalInBatch: validFiles.length }));
        setMediaQueue(prev => [...prev, ...newQueueItems]);
        
        // Reset file input to allow selecting the same file again
        e.target.value = '';
    };

    useEffect(() => {
        const processQueue = async () => {
            if (mediaQueue.length === 0) {
                if(isProcessingMedia) {
                    setIsProcessingMedia(false);
                    setProcessingStatus('');
                }
                return;
            }
            if (isProcessingMedia) return;

            setIsProcessingMedia(true);
            const { file: fileToProcess, totalInBatch } = mediaQueue[0];
            const currentNumber = totalInBatch - mediaQueue.length + 1;
            
            setProcessingStatus(`جاري معالجة ${currentNumber} من ${totalInBatch}...`);
            
            try {
                if (fileToProcess.type.startsWith('image/')) {
                    const base64 = await compressImageAndConvertToBase64(fileToProcess);
                    const thumbnailBase64 = await generateThumbnail(base64);
                    const analysis: JournalImageAnalysis | null = await geminiService.analyzeImageForJournal(base64, fileToProcess.type, location);

                    if (!analysis) throw new Error("فشل تحليل الصورة.");

                    if (analysis.type === 'expense' && analysis.data.amount != null) {
                        const expenseData = analysis.data;
                        const newExpense: Expense = {
                            id: generateId(), description: expenseData.description, amount: expenseData.amount,
                            currency: expenseData.currency, amountInSAR: expenseData.amountInSAR,
                            photos: [{ id: generateId(), base64, thumbnailBase64, lat: location?.lat, lon: location?.lon }]
                        };
                        updateEntry({ expenses: [...currentEntry.expenses, newExpense] });
                    } else {
                        const description = (analysis.data as any)?.description || 'لم يتمكن الذكاء الاصطناعي من وصف هذه الصورة.';
                        const newPhoto: JournalPhoto = { id: generateId(), base64, thumbnailBase64, description, lat: location?.lat, lon: location?.lon };
                        const newNotes = description ? (currentEntry.notes ? `${currentEntry.notes}\n- ${description}` : `- ${description}`) : currentEntry.notes;
                        updateEntry({ photos: [...currentEntry.photos, newPhoto], notes: newNotes.trim() });
                    }
                } else if (fileToProcess.type.startsWith('video/')) {
                    setProcessingStatus(`قص الفيديو ${currentNumber} من ${totalInBatch}...`);
                    await yieldToMain();
                    const MAX_DURATION_SECONDS = 60;
                    const { blob: processedVideoBlob } = await trimVideoBlob(fileToProcess, MAX_DURATION_SECONDS);

                    setProcessingStatus(`تحليل الفيديو ${currentNumber} من ${totalInBatch}...`);
                    await yieldToMain();
                    const base64 = await blobToBase64(processedVideoBlob);
                    const mimeType = processedVideoBlob.type;
                    
                    await yieldToMain();
                    const thumbnailBase64 = await generateVideoThumbnail(new File([processedVideoBlob], fileToProcess.name, { type: mimeType })).catch(e => {
                        console.warn("Thumbnail generation failed, skipping:", e);
                        return undefined;
                    });

                    const description = await geminiService.analyzeMediaForJournal(base64, mimeType, location);
                    
                    const newVideo: JournalVideo = { id: generateId(), base64, mimeType, thumbnailBase64, description, lat: location?.lat, lon: location?.lon };
                    const newNotes = description ? (currentEntry.notes ? `${currentEntry.notes}\n- ${description}` : `- ${description}`) : currentEntry.notes;
                    updateEntry({ videos: [...currentEntry.videos, newVideo], notes: newNotes.trim() });
                }
            } catch (error) {
                console.error("Error processing file:", fileToProcess.name, error);
                const errorMessage = error instanceof Error ? error.message : `خطأ غير معروف`;
                setFormError(`فشلت معالجة ${fileToProcess.name}: ${errorMessage}`);
            } finally {
                setMediaQueue(prev => prev.slice(1));
                setIsProcessingMedia(false); 
            }
        };

        const timeoutId = setTimeout(processQueue, 100); // Give UI time to update status
        return () => clearTimeout(timeoutId);
    }, [mediaQueue, isProcessingMedia, location, currentEntry.notes, currentEntry.photos, currentEntry.videos, currentEntry.expenses]);


    const handleNoteFromAudio = async (audioBlob: Blob) => {
        setIsProcessing(true);
        const base64 = await blobToBase64(audioBlob);
        const mimeType = audioBlob.type || 'audio/webm';
        const transcribedText = await geminiService.transcribeAudio(base64, mimeType);
        if (transcribedText) {
            updateEntry({ notes: currentEntry.notes ? `${currentEntry.notes}\n${transcribedText}` : transcribedText });
        }
        setIsProcessing(false);
    };

    const handleSummarizeEntry = async () => {
        setIsProcessing(true);
        const result = await geminiService.summarizeJournalEntry(currentEntry.notes, currentEntry.photos, currentEntry.videos, location);
        if (result) {
            updateEntry({
                title: currentEntry.title || `يوميات ${currentEntry.date}`,
                notes: result
            });
            setIsStoryMode(true);
        }
        setIsProcessing(false);
    };
    
    // --- Expense Logic ---
    const closeExpenseModal = () => {
        setIsExpenseModalOpen(false);
        setEditingExpense(null);
        setExpenseData({ description: '', amountText: '', amount: null, currency: null, amountInSAR: null, photo: null });
    };

    const handleScanReceiptForModal = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        setIsProcessingExpense(true);
        const file = e.target.files[0];
        const base64 = await compressImageAndConvertToBase64(file);
        const thumbnailBase64 = await generateThumbnail(base64);
        const result = await geminiService.analyzeReceiptImage(base64);
        if (result) {
            setExpenseData({
                description: result.description,
                amountText: `${result.amount} ${result.currency}`,
                amount: result.amount,
                currency: result.currency,
                amountInSAR: result.amountInSAR,
                photo: { id: generateId(), base64, thumbnailBase64, lat: location?.lat, lon: location?.lon }
            });
        }
        setIsProcessingExpense(false);
    };

    const handleAddExpenseFromAudioInModal = async (audioBlob: Blob) => {
        setIsProcessingExpense(true);
        try {
            const base64 = await blobToBase64(audioBlob);
            const mimeType = audioBlob.type || 'audio/webm';
            const result = await geminiService.analyzeExpenseFromAudio(base64, mimeType);
            if (result) {
                setExpenseData(p => ({
                    ...p,
                    description: result.description,
                    amountText: result.amountText,
                    amount: null,
                    currency: null,
                    amountInSAR: null,
                }));
            }
        } finally {
            setIsProcessingExpense(false);
        }
    };

    const handleRefineDescription = async () => {
        if (!expenseData.description) return;
        setIsProcessingExpense(true);
        const refined = await geminiService.refineExpenseDescription(expenseData.description);
        setExpenseData(p => ({ ...p, description: refined }));
        setIsProcessingExpense(false);
    };

    const handleExpensePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const file = e.target.files[0];
        const base64 = await compressImageAndConvertToBase64(file);
        const thumbnailBase64 = await generateThumbnail(base64);
        setExpenseData(prev => ({
            ...prev,
            photo: { id: generateId(), base64, thumbnailBase64, lat: location?.lat, lon: location?.lon }
        }));
    };
    
    const handleSaveExpense = async () => {
        if (!expenseData.description || !expenseData.amountText) {
            alert('الرجاء إدخال وصف ومبلغ للمصروف.');
            return;
        }
        setIsProcessingExpense(true);
        try {
            let processed: Omit<Expense, 'id' | 'description' | 'photos'> | null = null;

            if (expenseData.amount !== null && expenseData.currency !== null && expenseData.amountInSAR !== null) {
                processed = {
                    amount: expenseData.amount,
                    currency: expenseData.currency,
                    amountInSAR: expenseData.amountInSAR,
                };
            } else {
                processed = await geminiService.processExpense({ text: expenseData.amountText });
            }

            if (processed) {
                const expensePayload: Omit<Expense, 'id'> = {
                    ...processed,
                    description: expenseData.description,
                    photos: expenseData.photo ? [expenseData.photo] : [],
                };
                
                if (editingExpense) {
                    // Update existing expense
                    const updatedExpense = { ...editingExpense, ...expensePayload };
                    updateEntry({ expenses: currentEntry.expenses.map(e => e.id === editingExpense.id ? updatedExpense : e) });
                } else {
                    // Add new expense
                    const newExpense: Expense = { ...expensePayload, id: generateId() };
                    updateEntry({ expenses: [...currentEntry.expenses, newExpense] });
                }
                closeExpenseModal();
            } else {
                 alert('لم أتمكن من فهم المبلغ والعملة. حاول مرة أخرى (مثال: 50.5 CHF أو 25 يورو).');
            }
        } catch (error) {
             console.error("Error processing expense:", error);
             alert('حدث خطأ أثناء معالجة المصروف.');
        } finally {
            setIsProcessingExpense(false);
        }
    };
    
    const handleEditExpense = (exp: Expense) => {
        setEditingExpense(exp);
        setExpenseData({
            description: exp.description,
            amountText: `${exp.amount} ${exp.currency}`,
            amount: exp.amount,
            currency: exp.currency,
            amountInSAR: exp.amountInSAR,
            photo: exp.photos?.[0] || null
        });
        setIsExpenseModalOpen(true);
    };

    const handleDeleteExpense = (expenseId: string) => {
        updateEntry({ expenses: currentEntry.expenses.filter(e => e.id !== expenseId) });
    };

    // --- End Expense Logic ---

    const handleDeletePhoto = (photoId: string) => {
        updateEntry({ photos: currentEntry.photos.filter(p => p.id !== photoId) });
    };

    const handleEnhancePhoto = async (photoId: string) => {
        const photoToEnhance = currentEntry.photos.find(p => p.id === photoId);
        if (!photoToEnhance) return;
    
        setEnhancingPhotoId(photoId);
        setFormError(null);
        try {
            const enhancedBase64 = await geminiService.enhancePhoto(photoToEnhance.base64);
            if (enhancedBase64) {
                const thumbnail = await generateThumbnail(enhancedBase64);
                const updatedPhoto = { ...photoToEnhance, base64: enhancedBase64, thumbnailBase64: thumbnail };
                updateEntry({
                    photos: currentEntry.photos.map(p => p.id === photoId ? updatedPhoto : p)
                });
            } else {
                throw new Error("لم يتم إرجاع صورة محسنة.");
            }
        } catch (err: any) {
            setFormError(err.message || "فشل تحسين الصورة.");
        } finally {
            setEnhancingPhotoId(null);
        }
    };
    
    const handleMuteVideo = async (videoId: string) => {
        const videoToMute = currentEntry.videos.find(v => v.id === videoId);
        if (!videoToMute) return;

        if (!window.confirm("هل أنت متأكد من أنك تريد إزالة الصوت من هذا الفيديو بشكل دائم؟ لا يمكن التراجع عن هذا الإجراء.")) {
            return;
        }

        setProcessingVideoId(videoId);
        setFormError(null);
        try {
            const { base64, mimeType } = await removeAudioFromVideo(videoToMute.base64, videoToMute.mimeType);
            const mutedVideo: JournalVideo = { ...videoToMute, base64, mimeType };
            
            updateEntry({
                videos: currentEntry.videos.map(v => v.id === videoId ? mutedVideo : v)
            });
        } catch (error) {
            console.error("Error muting video:", error);
            setFormError("فشلت عملية إزالة الصوت من الفيديو.");
        } finally {
            setProcessingVideoId(null);
        }
    };


    const handleDeleteVideo = (videoId: string) => {
        updateEntry({ videos: currentEntry.videos.filter(v => v.id !== videoId) });
    };

    const handleSave = async () => {
        if (mediaQueue.length > 0) {
            setFormError("يرجى الانتظار حتى تكتمل معالجة جميع الصور ومقاطع الفيديو.");
            return;
        }
        setFormError(null);
        setIsProcessing(true);
        try {
            const finalEntry = { ...currentEntry, title: currentEntry.title || `يوميات ${currentEntry.date}` };
            const updatedEntries = entry ? trip.entries.map(e => e.id === entry.id ? finalEntry : e) : [...trip.entries, finalEntry];
            onSave({ ...trip, entries: updatedEntries });
        } catch (error) {
            console.error("Error saving entry:", error);
            setFormError("حدث خطأ أثناء الحفظ.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const totalExpenses = currentEntry.expenses.reduce((sum, exp) => sum + exp.amountInSAR, 0);

    const renderExpenseModal = () => (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4 animate-fade-in" onClick={closeExpenseModal}>
            <div className="bg-gray-800 text-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5" onClick={e => e.stopPropagation()}>
                {isProcessingExpense && <div className="absolute inset-0 bg-black/40 z-10 flex items-center justify-center rounded-2xl"><LoadingSpinner message="جاري التحليل..."/></div>}
                <h3 className="text-2xl font-bold text-center mb-2">{editingExpense ? 'تعديل المصروف' : 'إضافة مصروف جديد'}</h3>

                <div className="flex items-center gap-4">
                    <AudioRecorder onRecordingComplete={handleAddExpenseFromAudioInModal} disabled={isProcessingExpense} />
                    <input type="file" accept="image/*" ref={expenseReceiptInputRef} onChange={handleScanReceiptForModal} className="hidden" />
                    <button onClick={() => expenseReceiptInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 p-3 bg-violet-500 text-white rounded-lg font-semibold shadow-md hover:bg-violet-600">
                        <Receipt size={20}/><span>امسح الفاتورة</span>
                    </button>
                </div>
                
                <div className="relative flex items-center">
                    <span className="flex-grow border-t border-gray-600"></span>
                    <span className="flex-shrink mx-2 text-gray-400 text-sm">أو أدخل يدوياً</span>
                    <span className="flex-grow border-t border-gray-600"></span>
                </div>

                 <div className="relative">
                    <input
                        type="text"
                        placeholder="وصف المصروف (مثال: غداء، تذاكر قطار)"
                        value={expenseData.description}
                        onChange={e => setExpenseData(p => ({...p, description: e.target.value}))}
                        className="w-full p-3 pl-10 bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    />
                    <button
                        onClick={handleRefineDescription}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 rounded-full hover:bg-gray-600 hover:text-white disabled:opacity-50"
                        disabled={isProcessingExpense || !expenseData.description.trim()}
                        aria-label="تحسين الوصف"
                        title="تحسين الوصف باستخدام Gemini"
                    >
                        <Sparkles size={20} />
                    </button>
                </div>
                 <input
                    type="text"
                    placeholder="المبلغ (مثال: 50 CHF أو 25.50 يورو)"
                    value={expenseData.amountText}
                    onChange={e => setExpenseData(p => ({
                        ...p,
                        amountText: e.target.value,
                        amount: null,
                        currency: null,
                        amountInSAR: null
                    }))}
                    className="w-full p-3 bg-gray-700 border-2 border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                 />

                <div className="space-y-2">
                    <label className="text-sm text-gray-400">صور المصروف (اختياري)</label>
                    <input type="file" accept="image/*" ref={expensePhotoInputRef} onChange={handleExpensePhotoUpload} className="hidden" />
                    {expenseData.photo ? (
                        <div className="relative w-full h-32">
                           <img src={`data:image/jpeg;base64,${expenseData.photo.thumbnailBase64 || expenseData.photo.base64}`} alt="معاينة المصروف" className="w-full h-full object-cover rounded-lg" loading="lazy" />
                           <button onClick={() => setExpenseData(p => ({...p, photo: null}))} className="absolute top-1 right-1 bg-black/50 p-1 rounded-full"><X size={16}/></button>
                        </div>
                    ) : (
                        <button onClick={() => expensePhotoInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-gray-600 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:bg-gray-700">
                           <ImageIcon size={32}/><span>إضافة صورة</span>
                        </button>
                    )}
                </div>

                <div className="flex gap-4 pt-2">
                    <button onClick={closeExpenseModal} className="w-full p-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-semibold">إلغاء</button>
                    <button onClick={handleSaveExpense} className="w-full flex items-center justify-center gap-2 p-3 bg-teal-500 hover:bg-teal-600 rounded-lg font-semibold">
                       <Plus size={20}/> <span>{editingExpense ? 'تعديل' : 'إضافة'}</span>
                    </button>
                </div>
            </div>
        </div>
    );

    return (
         <div className="p-4 md:p-6 space-y-4 animate-fade-in relative">
            {isExpenseModalOpen && renderExpenseModal()}
            {fullscreenMedia && (
                <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setFullscreenMedia(null)}>
                    <button
                        onClick={() => setFullscreenMedia(null)}
                        className="absolute top-4 right-4 z-10 p-3 bg-black/50 backdrop-blur-sm border border-white/20 text-white rounded-full hover:bg-black/70 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
                        aria-label="إغلاق"
                    >
                        <X size={32} />
                    </button>
                    {fullscreenMedia.type === 'image' ? (
                        <img src={fullscreenMedia.data} alt="عرض مكبر" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()}/>
                    ) : (
                        videoObjectUrl ?
                        <video src={videoObjectUrl} controls autoPlay className="max-w-full max-h-full rounded-lg" onClick={(e) => e.stopPropagation()}/>
                        : <LoadingSpinner message="جاري تحميل الفيديو..."/>
                    )}
                </div>
            )}
            {isProcessing && <div className="absolute inset-0 bg-black/20 z-10 flex items-center justify-center rounded-lg"><LoadingSpinner message="جاري الحفظ..."/></div>}
            
            {formError && <div className="p-4 my-2 bg-red-100 text-red-700 rounded-lg text-center">{formError}</div>}

            <div className="flex items-center justify-between">
                <button onClick={onCancel} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ArrowRight size={24} /></button>
                <h2 className="text-2xl font-bold">{entry ? "تفاصيل اليوم" : "يوم جديد"}</h2>
                <div className="w-10"></div>
            </div>
            
             {isStoryMode ? (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md space-y-4 animate-fade-in">
                    <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-bold text-primary dark:text-primary-light">{currentEntry.title}</h3>
                        <button onClick={() => setIsStoryMode(false)} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-gray-600 bg-gray-200 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600">
                           <Edit size={16}/> <span>تعديل</span>
                        </button>
                    </div>
                    <div className="text-gray-700 dark:text-gray-200 text-lg leading-relaxed whitespace-pre-wrap font-sans">
                        {currentEntry.notes}
                    </div>
                </div>
            ) : (
                <>
                    <input type="date" value={currentEntry.date} onChange={e => updateEntry({ date: e.target.value })} min={trip.startDate} max={trip.endDate} className="w-full p-3 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                    <input type="text" value={currentEntry.title} onChange={e => updateEntry({ title: e.target.value })} placeholder="عنوان اليوم (مثال: يوم في الجبال)" className="w-full p-3 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                    <div className="relative">
                        <textarea value={currentEntry.notes} onChange={e => updateEntry({ notes: e.target.value })} placeholder="اكتب ملاحظاتك هنا..." rows={currentEntry.notes ? 8 : 4} className="w-full p-3 pl-12 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600"></textarea>
                        <AudioRecorder onRecordingComplete={handleNoteFromAudio} className="absolute bottom-2 left-2"/>
                    </div>
                </>
            )}

            <button onClick={handleSummarizeEntry} disabled={isProcessing || isProcessingMedia || (currentEntry.notes.trim() === '' && currentEntry.photos.length === 0 && currentEntry.videos.length === 0)} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-gray-900 rounded-lg font-semibold shadow-md hover:bg-yellow-500 disabled:opacity-50">
                <Sparkles size={20}/><span>{isStoryMode ? 'أعد كتابة القصة' : 'لخص لي يومي بالذكاء الاصطناعي'}</span>
            </button>
            
             {isProcessingMedia && (
                <div className="p-3 my-2 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-lg text-center flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={20} />
                    <span>{processingStatus}</span>
                </div>
            )}

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md space-y-3">
                <h3 className="font-bold">الصور والفيديوهات</h3>
                <input type="file" accept="image/*" multiple ref={photoInputRef} onChange={handleMediaUpload} className="hidden" />
                <input type="file" accept="video/*" multiple ref={videoInputRef} onChange={handleMediaUpload} className="hidden" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => photoInputRef.current?.click()} disabled={isProcessingMedia} className="flex items-center justify-center gap-2 p-3 bg-blue-500 text-white rounded-lg font-semibold disabled:opacity-50"><ImageIcon/><span>إضافة صورة</span></button>
                    <button onClick={() => videoInputRef.current?.click()} disabled={isProcessingMedia} className="flex items-center justify-center gap-2 p-3 bg-purple-500 text-white rounded-lg font-semibold disabled:opacity-50"><VideoIcon/><span>إضافة فيديو</span></button>
                </div>
                {(currentEntry.photos.length > 0 || currentEntry.videos.length > 0) && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {currentEntry.photos.map(p => {
                            const src = `data:image/jpeg;base64,${p.thumbnailBase64 || p.base64}`;
                            const fullSrc = `data:image/jpeg;base64,${p.base64}`;
                            return (
                                <div key={p.id} className="relative w-24 h-24 flex-shrink-0 group">
                                    <img src={src} alt="صورة يوميات" className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setFullscreenMedia({ type: 'image', data: fullSrc })} loading="lazy" />
                                     {enhancingPhotoId === p.id && (
                                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-lg z-20">
                                            <Loader2 className="animate-spin text-white" size={28} />
                                        </div>
                                    )}
                                    <div className="absolute top-1 right-1 flex gap-1 z-10">
                                        <button onClick={(e) => { e.stopPropagation(); handleEnhancePhoto(p.id); }} className="bg-yellow-500/80 text-white rounded-full p-1 hover:bg-yellow-500 transition-colors" aria-label="تحسين الصورة"><Sparkles size={14} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDeletePhoto(p.id); }} className="bg-red-600/80 text-white rounded-full p-1 hover:bg-red-600 transition-colors" aria-label="حذف الصورة"><X size={14} /></button>
                                    </div>
                                    {p.lat && p.lon && (<a href={`https://www.google.com/maps?q=${p.lat},${p.lon}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-1.5 left-1.5 z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" aria-label="عرض الموقع على الخريطة"><MapPin size={16} /></a>)}
                                </div>
                            );
                        })}
                        {currentEntry.videos.map(v => {
                            const thumbSrc = v.thumbnailBase64 ? `data:image/jpeg;base64,${v.thumbnailBase64}` : null;
                            return (
                                <div key={v.id} className="relative w-24 h-24 flex-shrink-0 group bg-gray-900 rounded-lg">
                                    {thumbSrc ? (
                                        <img src={thumbSrc} alt="صورة مصغرة للفيديو" className="w-full h-full object-cover rounded-lg cursor-pointer" onClick={() => setFullscreenMedia({ type: 'video', data: v.base64, mimeType: v.mimeType })} loading="lazy" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <VideoIcon className="text-white/80" size={32} />
                                        </div>
                                    )}
                                    <div 
                                        className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-lg"
                                        onClick={() => setFullscreenMedia({ type: 'video', data: v.base64, mimeType: v.mimeType })}
                                    >
                                        <VideoIcon className="text-white drop-shadow-lg" size={32} />
                                    </div>

                                    {processingVideoId === v.id && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg z-20">
                                            <Loader2 className="animate-spin text-white" size={32} />
                                        </div>
                                    )}
                                    <div className="absolute top-1 right-1 flex flex-col gap-1 z-10">
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteVideo(v.id); }} className="bg-red-600/80 text-white rounded-full p-1 hover:bg-red-600 transition-colors" aria-label="حذف الفيديو"><X size={14} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleMuteVideo(v.id); }} className="bg-gray-800/80 text-white rounded-full p-1 hover:bg-gray-900 transition-colors" aria-label="إزالة الصوت" title="إزالة الصوت نهائياً"><VolumeX size={14} /></button>
                                    </div>
                                    {v.lat && v.lon && (<a href={`https://www.google.com/maps?q=${v.lat},${v.lon}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-1.5 left-1.5 z-10 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" aria-label="عرض الموقع على الخريطة"><MapPin size={16} /></a>)}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md space-y-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold">مصاريف اليوم</h3>
                    <p className="font-bold text-primary dark:text-primary-light">إجمالي الصرف: {totalExpenses.toFixed(2)} SAR</p>
                </div>
                 <button onClick={() => setIsExpenseModalOpen(true)} className="w-full text-center py-3 text-primary dark:text-primary-light font-semibold hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg">
                    + إضافة مصروف
                </button>
                <ul className="space-y-2">
                    {currentEntry.expenses.map(exp => (
                        <li key={exp.id} className="bg-gray-100 dark:bg-gray-700/50 p-3 rounded-lg shadow-sm flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 flex-grow min-w-0">
                                {exp.photos && exp.photos[0] && (
                                    <img 
                                        src={`data:image/jpeg;base64,${exp.photos[0].thumbnailBase64 || exp.photos[0].base64}`} 
                                        alt={exp.description}
                                        className="w-14 h-14 object-cover rounded-md flex-shrink-0"
                                        loading="lazy"
                                    />
                                )}
                                <span className="text-gray-800 dark:text-gray-100 truncate">{exp.description}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="text-right">
                                    <div className="flex items-center justify-end gap-2 font-bold text-primary dark:text-primary-light whitespace-nowrap">
                                        <span>SAR {exp.amountInSAR.toFixed(2)}</span>
                                        <button onClick={() => handleEditExpense(exp)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="تعديل المصروف">
                                            <Edit size={18} />
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono text-right whitespace-nowrap">
                                        {exp.amount} {exp.currency}
                                    </p>
                                </div>
                                <button onClick={() => handleDeleteExpense(exp.id)} className="p-2 text-red-500 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50" aria-label="حذف المصروف">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            
            <div className="flex gap-4 pt-4">
                <button onClick={onCancel} className="w-full p-4 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold">إلغاء</button>
                <button onClick={handleSave} className="w-full p-4 bg-primary text-white rounded-lg font-semibold" disabled={isProcessing || isProcessingMedia}>حفظ اليومية</button>
            </div>
        </div>
    );
};

export default MySpace;
