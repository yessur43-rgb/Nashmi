import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trip, JournalEntry, JournalPhoto, JournalVideo, Expense } from '../types';
import * as db from '../services/dbService';
import * as geminiService from '../services/geminiService';
import { blobToBase64, compressImageAndConvertToBase64 } from '../utils/helpers';
import LoadingSpinner from './common/LoadingSpinner';
import AudioRecorder from './common/AudioRecorder';
import StorageUsage from './common/StorageUsage';

import { 
    User, Plus, ArrowRight, Trash2, Edit, Download, Sparkles, ChevronsRight,
    Camera, Video, DollarSign, Mic, Image as ImageIcon, Video as VideoIcon,
    Receipt, Type, Save, X, MapPin, BookOpen
} from 'lucide-react';

interface ToolProps {
  location: { lat: number; lon: number } | null;
  locationError: string | null;
}

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const dispatchStorageUpdate = () => {
    window.dispatchEvent(new CustomEvent('custom-storage-update'));
};

const StoryViewer: React.FC<{ htmlContent: string; tripName: string; onClose: () => void; }> = ({ htmlContent, tripName, onClose }) => (
    <div className="fixed inset-0 bg-gray-100 dark:bg-gray-900 z-50 animate-fade-in flex flex-col">
        <header className="flex-shrink-0 flex items-center justify-between p-4 bg-gray-200 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
            <h2 className="text-xl font-bold truncate pr-4">قصة رحلة: {tripName}</h2>
            <button onClick={onClose} className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600 flex-shrink-0">
                <X size={24} />
            </button>
        </header>
        <iframe
            srcDoc={htmlContent}
            className="w-full h-full border-none flex-grow"
            title={`Trip Story - ${tripName}`}
        />
    </div>
);


// Main Component
const MySpace: React.FC<ToolProps> = ({ location }) => {
    const [trips, setTrips] = useState<Trip[]>([]);
    const [currentView, setCurrentView] = useState<'list' | 'tripForm' | 'tripDetails' | 'entryForm'>('list');
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

    const handleSaveTrip = async (tripData: Omit<Trip, 'id' | 'entries'>) => {
        const newTrip: Trip = { ...tripData, id: generateId(), entries: [] };
        await db.putTrip(newTrip);
        setTrips(prev => [newTrip, ...prev].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
        setCurrentView('list');
        dispatchStorageUpdate();
    };

    const handleUpdateTrip = async (updatedTrip: Trip) => {
        await db.putTrip(updatedTrip);
        setTrips(prev => prev.map(t => t.id === updatedTrip.id ? updatedTrip : t));
        setSelectedTrip(updatedTrip); // Keep selected trip updated
        dispatchStorageUpdate();
    };

    const handleDeleteTrip = async (tripId: string) => {
        if (window.confirm("هل أنت متأكد من حذف هذه الرحلة وكل يومياتها؟")) {
            await db.deleteTrip(tripId);
            setTrips(prev => prev.filter(t => t.id !== tripId));
            setCurrentView('list');
            setSelectedTrip(null);
            dispatchStorageUpdate();
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
        default:
            return <TripList 
                trips={trips}
                onSelectTrip={(trip) => { setSelectedTrip(trip); setCurrentView('tripDetails'); }} 
                onAddTrip={() => setCurrentView('tripForm')} 
            />;
    }
};

const TripList: React.FC<{trips: Trip[]; onSelectTrip: (trip: Trip) => void; onAddTrip: () => void;}> = ({ trips, onSelectTrip, onAddTrip }) => (
    <div className="p-4 md:p-6 space-y-6 animate-fade-in">
        <div className="text-center p-6 bg-green-500 dark:bg-green-800/50 rounded-xl shadow-lg">
            <User className="mx-auto w-12 h-12 text-white mb-2" />
            <h2 className="text-2xl font-bold text-white">مساحتي</h2>
            <p className="text-white/80">دفتر رحلاتك الشخصي والذكي</p>
        </div>
        <button onClick={onAddTrip} className="w-full flex items-center justify-center gap-2 p-4 bg-primary text-white rounded-lg font-bold shadow-lg hover:bg-primary-dark transition-colors">
            <Plus /><span>إضافة رحلة جديدة</span>
        </button>
        <div className="space-y-4">
            {trips.length > 0 
                ? trips.map(trip => (
                    <div key={trip.id} onClick={() => onSelectTrip(trip)} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md cursor-pointer hover:shadow-lg transition-shadow">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold">{trip.name}</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{trip.startDate} - {trip.endDate}</p>
                            </div>
                        </div>
                         <div className="flex justify-between items-center mt-2 text-sm text-gray-500 dark:text-gray-400">
                            <span>{trip.entries.length} يوميات</span>
                            <div className="flex items-center gap-1 text-primary dark:text-primary-light">
                                <span>عرض التفاصيل</span><ChevronsRight size={16} />
                            </div>
                        </div>
                    </div>
                )) 
                : <div className="text-center p-8 border-2 border-dashed rounded-lg text-gray-500">لم تقم بإضافة أي رحلات بعد.</div>
            }
        </div>
        <StorageUsage />
    </div>
);

const TripForm: React.FC<{onSave: (trip: Omit<Trip, 'id' | 'entries'>) => void; onCancel: () => void;}> = ({ onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [error, setError] = useState('');

    const handleSubmit = () => {
        if (!name || !startDate || !endDate) { setError("يرجى ملء جميع الحقول."); return; }
        if (endDate < startDate) { setError("تاريخ النهاية يجب أن يكون بعد تاريخ البداية."); return; }
        setError(''); onSave({ name, startDate, endDate });
    };

    return (
        <div className="p-4 md:p-6 space-y-4 animate-fade-in bg-white dark:bg-gray-800 rounded-xl shadow-lg">
             <h2 className="text-2xl font-bold text-center">رحلة جديدة</h2>
            {error && <p className="text-red-500 text-center">{error}</p>}
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="اسم الرحلة (مثال: رحلة سويسرا ٢٠٢٤)" className="w-full p-3 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">تاريخ البدء</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-3 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">تاريخ الانتهاء</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-3 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600" />
                </div>
            </div>
            <div className="flex gap-4">
                <button onClick={onCancel} className="w-full p-3 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold">إلغاء</button>
                <button onClick={handleSubmit} className="w-full p-3 bg-primary text-white rounded-lg font-semibold">حفظ الرحلة</button>
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
}> = ({ trip, onBack, onAddEntry, onEditEntry, onDeleteTrip, onUpdateTrip }) => {
    const [summary, setSummary] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(trip.name);
    const nameInputRef = useRef<HTMLInputElement>(null);
    const [isStoryVisible, setIsStoryVisible] = useState(false);

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

            const simplifiedTrip = {
                ...trip,
                entries: trip.entries.map(entry => ({
                    ...entry,
                    photos: entry.photos.map(p => ({ id: p.id, lat: p.lat, lon: p.lon })),
                    videos: entry.videos.map(v => ({ id: v.id, lat: v.lat, lon: v.lon })),
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
                setIsStoryVisible(true);
            }
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="p-4 md:p-6 space-y-6 animate-fade-in">
             {isStoryVisible && trip.exportedStoryHtml && (
                <StoryViewer htmlContent={trip.exportedStoryHtml} tripName={trip.name} onClose={() => setIsStoryVisible(false)} />
            )}
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
                <button onClick={handleGenerateStory} disabled={isProcessing} className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-500 text-white rounded-lg font-semibold shadow-md hover:bg-blue-600 disabled:opacity-50">
                    <Download size={20}/><span>{trip.exportedStoryHtml ? 'إعادة إنشاء القصة' : 'إنشاء قصة مصورة'}</span>
                </button>
            </div>
             {trip.exportedStoryHtml && (
                <button onClick={() => setIsStoryVisible(true)} className="w-full flex items-center justify-center gap-2 p-4 bg-green-500 text-white rounded-lg font-bold shadow-lg hover:bg-green-600 transition-colors">
                    <BookOpen size={24} />
                    <span>عرض القصة المصورة</span>
                </button>
            )}
            {isProcessing && <LoadingSpinner message="جاري العمل..." />}
            {summary && <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow whitespace-pre-wrap">{summary}</div>}
            <button onClick={onAddEntry} className="w-full flex items-center justify-center gap-2 p-4 bg-primary text-white rounded-lg font-bold shadow-lg hover:bg-primary-dark">
                <Plus /><span>إضافة يوميات جديدة</span>
            </button>
            <div className="relative pt-8">
                 <span className="absolute top-1/2 left-0 w-full h-px bg-gray-300 dark:bg-gray-600"></span>
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 bg-gray-50 dark:bg-gray-900 font-bold">
                     الجدول الزمني للرحلة
                 </div>
            </div>
             <div className="space-y-4">
                 {trip.entries.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(entry => {
                     const dailyTotal = entry.expenses.reduce((sum, exp) => sum + exp.amountInSAR, 0);
                     return (
                         <div key={entry.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onEditEntry(entry)}>
                             <div className="flex justify-between items-start">
                                 <div>
                                     <h3 className="text-lg font-bold">{entry.title}</h3>
                                     <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">{entry.date}</p>
                                 </div>
                                 <div className="p-2 text-gray-500 dark:text-gray-400"><Edit size={18} /></div>
                             </div>
                             <p className="mt-2 text-gray-600 dark:text-gray-400 truncate">{entry.notes || "لا توجد ملاحظات."}</p>
                             {dailyTotal > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                    <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">إجمالي الصرف اليومي:</span>
                                    <span className="text-md font-bold text-primary dark:text-primary-light">{dailyTotal.toFixed(2)} SAR</span>
                                </div>
                            )}
                         </div>
                     );
                 })}
             </div>
        </div>
    );
};


const JournalEntryForm: React.FC<{trip: Trip; entry: JournalEntry | null; onSave: (trip: Trip) => void; onCancel: () => void; location: { lat: number; lon: number } | null;}> = ({ trip, entry, onSave, onCancel, location }) => {
    const [currentEntry, setCurrentEntry] = useState<JournalEntry>(entry || { id: generateId(), date: new Date().toISOString().split('T')[0], title: '', notes: '', photos: [], videos: [], expenses: [] });
    const [isProcessing, setIsProcessing] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const videoInputRef = useRef<HTMLInputElement>(null);
    const [newVideos, setNewVideos] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
    const [formError, setFormError] = useState<string | null>(null);
    const [fullscreenMedia, setFullscreenMedia] = useState<{ type: 'image' | 'video'; src: string } | null>(null);

    // Expense Modal State
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [isProcessingExpense, setIsProcessingExpense] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    // FIX: Enhanced expenseData state to store pre-verified data and avoid re-verification.
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

    useEffect(() => {
        const urls = newVideos.map(v => v.previewUrl);
        return () => {
            urls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [newVideos]);

    const updateEntry = (updates: Partial<JournalEntry>) => setCurrentEntry(prev => ({ ...prev, ...updates }));

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);
        const newPhotos: JournalPhoto[] = [];
        for (const file of files) {
            const base64 = await compressImageAndConvertToBase64(file as File);
            newPhotos.push({ id: generateId(), base64, lat: location?.lat, lon: location?.lon });
        }
        updateEntry({ photos: [...currentEntry.photos, ...newPhotos] });
    };

    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        const MAX_VIDEO_SIZE_MB = 50;
        const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
        
        const validFiles = [];
        const oversizedFiles = [];

        for (const file of files) {
            const currentFile = file as File;
            if (currentFile.size > MAX_VIDEO_SIZE_BYTES) {
                oversizedFiles.push(currentFile.name);
            } else {
                validFiles.push(currentFile);
            }
        }

        if (oversizedFiles.length > 0) {
            setFormError(`الملفات التالية كبيرة جدًا: ${oversizedFiles.join(', ')}. الحد الأقصى المسموح به هو ${MAX_VIDEO_SIZE_MB} ميجابايت لكل ملف.`);
        } else {
            setFormError(null);
        }
        
        if (validFiles.length > 0) {
            const newlyUploadedVideos = validFiles.map(rawFile => {
                 const file = rawFile as File;
                 const id = generateId();
                 const previewUrl = URL.createObjectURL(file);
                 return { id, file, previewUrl };
            });
            setNewVideos(prev => [...prev, ...newlyUploadedVideos]);
        }
    };

    const handleNoteFromAudio = async (audioBlob: Blob) => {
        setIsProcessing(true);
        const { base64, mimeType } = await blobToBase64(audioBlob);
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
        }
        setIsProcessing(false);
    };
    
    // --- Expense Logic ---
    const closeExpenseModal = () => {
        setIsExpenseModalOpen(false);
        setEditingExpense(null);
        // FIX: Reset the enhanced expenseData state.
        setExpenseData({ description: '', amountText: '', amount: null, currency: null, amountInSAR: null, photo: null });
    };

    const handleScanReceiptForModal = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        setIsProcessingExpense(true);
        const file = e.target.files[0];
        const base64 = await compressImageAndConvertToBase64(file);
        const result = await geminiService.analyzeReceiptImage(base64);
        if (result) {
            // FIX: Populate the state with pre-verified data from the API.
            setExpenseData({
                description: result.description,
                amountText: `${result.amount} ${result.currency}`,
                amount: result.amount,
                currency: result.currency,
                amountInSAR: result.amountInSAR,
                photo: { id: generateId(), base64, lat: location?.lat, lon: location?.lon }
            });
        }
        setIsProcessingExpense(false);
    };

    const handleAddExpenseFromAudioInModal = async (audioBlob: Blob) => {
        setIsProcessingExpense(true);
        try {
            const { base64, mimeType } = await blobToBase64(audioBlob);
            const result = await geminiService.analyzeExpenseFromAudio(base64, mimeType);
            if (result) {
                // FIX: Reset pre-verified fields as the data comes from audio and needs processing on save.
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
        setExpenseData(prev => ({
            ...prev,
            photo: { id: generateId(), base64, lat: location?.lat, lon: location?.lon }
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

            // FIX: Use pre-processed data if available to avoid redundant API call.
            if (expenseData.amount !== null && expenseData.currency !== null && expenseData.amountInSAR !== null) {
                processed = {
                    amount: expenseData.amount,
                    currency: expenseData.currency,
                    amountInSAR: expenseData.amountInSAR,
                };
            } else {
                // Otherwise, process the text input as a fallback.
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
        // FIX: Populate all fields, including pre-verified data, when editing.
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

    const handleDeleteVideo = (videoId: string) => {
        updateEntry({ videos: currentEntry.videos.filter(v => v.id !== videoId) });
    };

    const handleDeleteNewVideo = (videoId: string) => {
        setNewVideos(prev => {
            const videoToRemove = prev.find(v => v.id === videoId);
            if (videoToRemove) {
                URL.revokeObjectURL(videoToRemove.previewUrl);
            }
            return prev.filter(v => v.id !== videoId);
        });
    };

    const handleSave = async () => {
        setFormError(null);
        setIsProcessing(true);
        try {
            const convertedNewVideos: JournalVideo[] = await Promise.all(
                newVideos.map(async (v) => {
                    const { base64, mimeType } = await blobToBase64(v.file);
                    return { id: v.id, base64, mimeType, lat: location?.lat, lon: location?.lon };
                })
            );
            const allVideos = [...currentEntry.videos, ...convertedNewVideos];
            const finalEntry = { ...currentEntry, videos: allVideos, title: currentEntry.title || `يوميات ${currentEntry.date}` };
            const updatedEntries = entry ? trip.entries.map(e => e.id === entry.id ? finalEntry : e) : [...trip.entries, finalEntry];
            onSave({ ...trip, entries: updatedEntries });
        } catch (error) {
            console.error("Error saving entry with videos:", error);
            setFormError("حدث خطأ أثناء معالجة وحفظ الفيديو. قد يكون حجمه كبيراً جداً.");
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
                    // FIX: Reset pre-verified data on manual change to trigger re-verification on save.
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
                           <img src={`data:image/jpeg;base64,${expenseData.photo.base64}`} alt="معاينة المصروف" className="w-full h-full object-cover rounded-lg" />
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
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setFullscreenMedia(null)}>
                    <button className="absolute top-4 right-4 p-2 text-white bg-black/50 rounded-full hover:bg-black/75" aria-label="إغلاق"><X size={32} /></button>
                    {fullscreenMedia.type === 'image' ? <img src={fullscreenMedia.src} alt="عرض مكبر" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()}/>
                     : <video src={fullscreenMedia.src} controls autoPlay className="max-w-full max-h-full" onClick={(e) => e.stopPropagation()}/>}
                </div>
            )}
            {isProcessing && <div className="absolute inset-0 bg-black/20 z-10 flex items-center justify-center rounded-lg"><LoadingSpinner message="جاري المعالجة..."/></div>}
            
            {formError && <div className="p-4 my-2 bg-red-100 text-red-700 rounded-lg text-center">{formError}</div>}

            <div className="flex items-center justify-between">
                <button onClick={onCancel} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ArrowRight size={24} /></button>
                <h2 className="text-2xl font-bold">{entry ? "تفاصيل اليوم" : "يوم جديد"}</h2>
                <div className="w-10"></div>
            </div>
            
            <input type="date" value={currentEntry.date} onChange={e => updateEntry({ date: e.target.value })} min={trip.startDate} max={trip.endDate} className="w-full p-3 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600" />
            <input type="text" value={currentEntry.title} onChange={e => updateEntry({ title: e.target.value })} placeholder="عنوان اليوم (مثال: يوم في الجبال)" className="w-full p-3 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600" />

            <div className="relative">
                <textarea value={currentEntry.notes} onChange={e => updateEntry({ notes: e.target.value })} placeholder="اكتب ملاحظاتك هنا..." rows={currentEntry.notes ? 8 : 4} className="w-full p-3 pl-12 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600"></textarea>
                <AudioRecorder onRecordingComplete={handleNoteFromAudio} className="absolute bottom-2 left-2"/>
            </div>

            <button onClick={handleSummarizeEntry} disabled={isProcessing || (currentEntry.photos.length === 0 && currentEntry.videos.length === 0 && newVideos.length === 0)} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-gray-900 rounded-lg font-semibold shadow-md hover:bg-yellow-500 disabled:opacity-50">
                <Sparkles size={20}/><span>لخص لي يومي بالذكاء الاصطناعي</span>
            </button>
            
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md space-y-3">
                <h3 className="font-bold">الصور والفيديوهات</h3>
                <input type="file" accept="image/*" multiple ref={photoInputRef} onChange={handlePhotoUpload} className="hidden" />
                <input type="file" accept="video/*" multiple ref={videoInputRef} onChange={handleVideoUpload} className="hidden" />
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => photoInputRef.current?.click()} className="flex items-center justify-center gap-2 p-3 bg-blue-500 text-white rounded-lg font-semibold"><ImageIcon/><span>إضافة صورة</span></button>
                    <button onClick={() => videoInputRef.current?.click()} className="flex items-center justify-center gap-2 p-3 bg-purple-500 text-white rounded-lg font-semibold"><VideoIcon/><span>إضافة فيديو</span></button>
                </div>
                {(currentEntry.photos.length > 0 || currentEntry.videos.length > 0 || newVideos.length > 0) && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {currentEntry.photos.map(p => {
                            const src = `data:image/jpeg;base64,${p.base64}`;
                            return (
                                <div key={p.id} className="relative w-24 h-24 flex-shrink-0 group">
                                    <img src={src} alt="صورة يوميات" className="w-full h-full object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setFullscreenMedia({ type: 'image', src })} />
                                    <button onClick={(e) => { e.stopPropagation(); handleDeletePhoto(p.id); }} className="absolute top-1 right-1 bg-red-600/80 text-white rounded-full p-1 hover:bg-red-600 transition-colors z-10" aria-label="حذف الصورة"><X size={14} /></button>
                                    {p.lat && p.lon && (<a href={`https://www.google.com/maps?q=${p.lat},${p.lon}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-1 left-1 bg-blue-500/80 text-white rounded-full p-1 hover:bg-blue-500 transition-colors z-10" aria-label="عرض الموقع على الخريطة"><MapPin size={14} /></a>)}
                                </div>
                            );
                        })}
                        {currentEntry.videos.map(v => {
                            const src = `data:${v.mimeType};base64,${v.base64}`;
                            return (
                                <div key={v.id} className="relative w-24 h-24 flex-shrink-0 group">
                                    <div className="w-full h-full cursor-pointer" onClick={() => setFullscreenMedia({ type: 'video', src })}>
                                        <video src={src} className="w-full h-full object-cover rounded-lg" />
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg group-hover:bg-black/50 transition-colors"><VideoIcon className="text-white/80" size={32} /></div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteVideo(v.id); }} className="absolute top-1 right-1 bg-red-600/80 text-white rounded-full p-1 hover:bg-red-600 transition-colors z-10" aria-label="حذف الفيديو"><X size={14} /></button>
                                    {v.lat && v.lon && (<a href={`https://www.google.com/maps?q=${v.lat},${v.lon}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="absolute bottom-1 left-1 bg-blue-500/80 text-white rounded-full p-1 hover:bg-blue-500 transition-colors z-10" aria-label="عرض الموقع على الخريطة"><MapPin size={14} /></a>)}
                                </div>
                            );
                        })}
                        {newVideos.map(v => {
                            const src = v.previewUrl;
                            return (
                                <div key={v.id} className="relative w-24 h-24 flex-shrink-0 group">
                                    <div className="w-full h-full cursor-pointer" onClick={() => setFullscreenMedia({ type: 'video', src })}>
                                        <video src={src} className="w-full h-full object-cover rounded-lg" />
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-lg group-hover:bg-black/50 transition-colors"><VideoIcon className="text-white/80" size={32} /></div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteNewVideo(v.id); }} className="absolute top-1 right-1 bg-red-600/80 text-white rounded-full p-1 hover:bg-red-600 transition-colors z-10" aria-label="حذف الفيديو"><X size={14} /></button>
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
                                        src={`data:image/jpeg;base64,${exp.photos[0].base64}`} 
                                        alt={exp.description}
                                        className="w-14 h-14 object-cover rounded-md flex-shrink-0"
                                    />
                                )}
                                <span className="text-gray-800 dark:text-gray-100 truncate">{exp.description}</span>
                            </div>
                            <div className="flex items-center gap-4 flex-shrink-0">
                                <div className="text-right">
                                    <div className="flex items-center justify-end gap-2 font-bold text-primary dark:text-primary-light whitespace-nowrap">
                                        <span>SAR {exp.amountInSAR.toFixed(2)}</span>
                                        <button onClick={() => handleEditExpense(exp)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="تعديل المصروف">
                                            <Edit size={16} />
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono text-right whitespace-nowrap">
                                        {exp.amount} {exp.currency}
                                    </p>
                                </div>
                                <button onClick={() => handleDeleteExpense(exp.id)} className="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full" aria-label="حذف المصروف">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>

            <div className="flex gap-4 pt-4">
                <button onClick={onCancel} className="w-full p-3 bg-gray-200 dark:bg-gray-700 rounded-lg font-semibold">إلغاء</button>
                <button onClick={handleSave} className="w-full p-3 bg-primary text-white rounded-lg font-semibold flex items-center justify-center gap-2"><Save/> حفظ اليوميات</button>
            </div>
        </div>
    );
};

export default MySpace;