import React, { useState, useEffect, useRef } from 'react';
import { Tool, Trip, JournalEntry, JournalPhoto, JournalVideo, Expense } from '../types';
import * as db from '../services/dbService';
import * as geminiService from '../services/geminiService';
import { blobToBase64, generateVideoThumbnail, removeAudioFromVideo } from '../utils/helpers';
import ToolsDrawer from './ToolsDrawer';
import QuickAudioModal from './common/QuickAudioModal';
import { Camera, Video, Mic, User, Grid3X3, Sun, Moon, Key, AlertTriangle, Loader2, XCircle, Save, Volume2, VolumeX, Sparkles, RotateCcw } from 'lucide-react';

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

type CapturedMedia = {
    type: 'photo' | 'video';
    objectUrl: string;
    base64: string;
    blob: Blob;
    mimeType?: string;
};

interface CaptureScreenProps {
  onSelectTool: (tool: Tool, initialState?: any) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onOpenApiKeyModal: () => void;
  location: { lat: number; lon: number } | null;
  locationError: string | null;
}

const CaptureScreen: React.FC<CaptureScreenProps> = ({ onSelectTool, isDarkMode, toggleDarkMode, onOpenApiKeyModal, location, locationError }) => {
  const [isToolsDrawerOpen, setIsToolsDrawerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Preview and enhancement state
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(null);
  const [shouldMuteVideo, setShouldMuteVideo] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [originalPhotoBeforeEnhance, setOriginalPhotoBeforeEnhance] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);


  useEffect(() => {
    return () => {
        if (capturedMedia) {
            URL.revokeObjectURL(capturedMedia.objectUrl);
        }
    };
  }, [capturedMedia]);
  
  const getOrCreateActiveJournalObjects = async (): Promise<{ trip: Trip; entry: JournalEntry; }> => {
    const today = new Date().toISOString().split('T')[0];
    const allTrips = await db.getAllTrips();
    let activeTrip = allTrips.find(t => t.startDate <= today && t.endDate >= today);

    if (!activeTrip) {
      if (!location) throw new Error("لا يمكن إنشاء رحلة جديدة بدون موقع.");
      const tripName = await geminiService.generateTripNameFromLocation(location);
      const newTrip: Trip = {
        id: generateId(), name: tripName,
        startDate: today,
        endDate: new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0],
        entries: [],
      };
      await db.putTrip(newTrip);
      activeTrip = newTrip;
    }

    let todayEntry = activeTrip.entries.find(e => e.date === today);
    if (!todayEntry) {
      todayEntry = {
        id: generateId(), date: today, title: `يوميات ${today}`, notes: '',
        photos: [], videos: [], expenses: [],
      };
      activeTrip.entries.push(todayEntry);
      await db.putTrip(activeTrip);
    }
    return { trip: activeTrip, entry: todayEntry };
  };

  const handleMediaSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
        const objectUrl = URL.createObjectURL(file);
        const base64 = await blobToBase64(file);
        
        if (file.type.startsWith('image/')) {
            setCapturedMedia({ type: 'photo', objectUrl, base64, blob: file });
        } else if (file.type.startsWith('video/')) {
            setCapturedMedia({ type: 'video', objectUrl, base64, blob: file, mimeType: file.type });
        }
    } catch (err) {
        console.error("Error handling media select:", err);
        setError("فشلت معالجة الملف الملتقط.");
    } finally {
        setIsProcessing(false);
        event.target.value = ''; // Reset input
    }
  };

  const handleDiscardMedia = () => {
    if (capturedMedia) {
        URL.revokeObjectURL(capturedMedia.objectUrl);
    }
    setCapturedMedia(null);
    setShouldMuteVideo(false);
    setOriginalPhotoBeforeEnhance(null);
  };

  const handleEnhancePhoto = async () => {
    if (!capturedMedia || capturedMedia.type !== 'photo') return;
    
    setIsEnhancing(true);
    setError(null);
    try {
        const enhancedBase64 = await geminiService.enhancePhoto(capturedMedia.base64);
        if (enhancedBase64) {
            const byteCharacters = atob(enhancedBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
            const newObjectUrl = URL.createObjectURL(blob);
            
            setOriginalPhotoBeforeEnhance(capturedMedia.base64);
            URL.revokeObjectURL(capturedMedia.objectUrl);
            
            setCapturedMedia({ ...capturedMedia, base64: enhancedBase64, objectUrl: newObjectUrl, blob });
        } else {
            setError("فشل تحسين الصورة. حاول مرة أخرى.");
        }
    } catch (error) {
        console.error("Error enhancing photo:", error);
        setError("حدث خطأ غير متوقع أثناء تحسين الصورة.");
    } finally {
        setIsEnhancing(false);
    }
  };
  
  const handleUndoEnhance = () => {
    if (!originalPhotoBeforeEnhance || !capturedMedia) return;
    
    const byteCharacters = atob(originalPhotoBeforeEnhance);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/jpeg' });
    const newObjectUrl = URL.createObjectURL(blob);
    
    URL.revokeObjectURL(capturedMedia.objectUrl);
    
    setCapturedMedia({ ...capturedMedia, base64: originalPhotoBeforeEnhance, objectUrl: newObjectUrl, blob });
    setOriginalPhotoBeforeEnhance(null);
  };

  const handleSaveMedia = async () => {
    if (!capturedMedia || !location) return;
    setIsProcessing(true);
    
    try {
        const { trip, entry } = await getOrCreateActiveJournalObjects();
        
        if (capturedMedia.type === 'photo') {
            const analysis = await geminiService.analyzeImageForJournal(capturedMedia.base64, 'image/jpeg', location);
            if (!analysis) throw new Error("فشل تحليل الصورة.");
            if (analysis.type === 'expense' && analysis.data.amount != null) {
                const { description, amount, currency, amountInSAR } = analysis.data;
                const newExpense: Expense = { id: generateId(), description, amount, currency, amountInSAR, photos: [{ id: generateId(), base64: capturedMedia.base64, lat: location.lat, lon: location.lon }] };
                entry.expenses.push(newExpense);
            } else {
                const description = analysis.data.description || 'وصف تلقائي للصورة.';
                const newPhoto: JournalPhoto = { id: generateId(), base64: capturedMedia.base64, description, lat: location.lat, lon: location.lon };
                entry.photos.push(newPhoto);
                if (description) entry.notes = (entry.notes ? `${entry.notes}\n- ${description}` : `- ${description}`).trim();
            }
        } else if (capturedMedia.type === 'video' && capturedMedia.blob) {
            let finalBase64 = capturedMedia.base64;
            let finalMimeType = capturedMedia.mimeType || 'video/webm';
            if (shouldMuteVideo) {
                const muted = await removeAudioFromVideo(finalBase64, finalMimeType);
                finalBase64 = muted.base64;
                finalMimeType = muted.mimeType;
            }
            const thumbnailBase64 = await generateVideoThumbnail(capturedMedia.blob).catch(() => undefined);
            const description = await geminiService.analyzeMediaForJournal(finalBase64, finalMimeType, location);
            const newVideo: JournalVideo = { id: generateId(), base64: finalBase64, mimeType: finalMimeType, thumbnailBase64, description, lat: location.lat, lon: location.lon };
            entry.videos.push(newVideo);
            if (description) entry.notes = (entry.notes ? `${entry.notes}\n- ${description}` : `- ${description}`).trim();
        }
        await db.putTrip(trip);
    } catch (error) {
        console.error("Error processing media:", error);
        setError(error instanceof Error ? error.message : 'حدث خطأ أثناء معالجة المحتوى.');
    } finally {
        setIsProcessing(false);
        handleDiscardMedia();
    }
  };

  const handleAudioAnalyzed = async (analysis: any) => {
    if (!location) return;
    setIsProcessing(true);
    try {
        const { trip, entry } = await getOrCreateActiveJournalObjects();
        if (analysis?.type === 'note') {
            entry.notes = (entry.notes ? `${entry.notes}\n${analysis.data.transcription}` : analysis.data.transcription).trim();
        } else if (analysis?.type === 'expense') {
            const processed = await geminiService.processExpense({ text: analysis.data.amountText });
            if (processed) {
                const newExpense: Expense = { id: generateId(), description: analysis.data.description, ...processed };
                entry.expenses.push(newExpense);
            }
        }
        await db.putTrip(trip);
    } catch (error) {
        console.error("Error saving audio analysis:", error);
    } finally {
        setIsProcessing(false);
    }
  };
  
  if (capturedMedia) {
    const previewSrc = showOriginal && originalPhotoBeforeEnhance 
      ? `data:image/jpeg;base64,${originalPhotoBeforeEnhance}`
      : capturedMedia.objectUrl;

    return (
        <div className="absolute inset-0 bg-black z-20 flex flex-col animate-fade-in">
            {isProcessing && <div className="absolute inset-0 bg-black/70 z-40 flex flex-col items-center justify-center"><Loader2 className="animate-spin mb-4" size={48} /><p>جاري الحفظ...</p></div>}
            {isEnhancing && <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center"><Loader2 className="animate-spin mb-4" size={48} /><p>جاري تحسين الصورة بالذكاء الاصطناعي...</p></div>}
            
            <div className="flex-grow relative">
                {capturedMedia.type === 'photo' && (
                    <div 
                      className="relative w-full h-full"
                      onMouseDown={() => {if(originalPhotoBeforeEnhance) setShowOriginal(true)}}
                      onMouseUp={() => setShowOriginal(false)}
                      onTouchStart={() => {if(originalPhotoBeforeEnhance) setShowOriginal(true)}}
                      onTouchEnd={() => setShowOriginal(false)}
                    >
                        <img src={previewSrc} alt="Preview" className="w-full h-full object-cover" />
                        {originalPhotoBeforeEnhance && (
                            <div className={`absolute inset-0 flex items-center justify-center text-white text-lg font-bold bg-black/50 transition-opacity duration-300 ${showOriginal ? 'opacity-100' : 'opacity-0'}`}>
                                قبل
                            </div>
                        )}
                    </div>
                )}
                {capturedMedia.type === 'video' && <video src={capturedMedia.objectUrl} controls autoPlay className="w-full h-full object-cover" />}
            </div>
            {originalPhotoBeforeEnhance && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-semibold">
                    اضغط مطولاً لرؤية النسخة الأصلية
                </div>
            )}
            <div className="flex-shrink-0 p-6 bg-gradient-to-t from-black/70 to-transparent">
                <div className="w-full flex justify-around items-center">
                    <button onClick={handleDiscardMedia} disabled={isEnhancing} className="flex flex-col items-center gap-1 text-white disabled:opacity-50">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"><XCircle size={32}/></div>
                        <span className="text-xs font-bold">تجاهل</span>
                    </button>
                    <button onClick={handleSaveMedia} disabled={isEnhancing} className="flex flex-col items-center gap-1 text-white disabled:opacity-50">
                        <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center"><Save size={40}/></div>
                        <span className="text-sm font-bold">حفظ</span>
                    </button>
                    {capturedMedia.type === 'video' ? (
                         <button onClick={() => setShouldMuteVideo(p => !p)} disabled={isEnhancing} className="flex flex-col items-center gap-1 text-white disabled:opacity-50">
                            <div className={`w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transition-colors ${shouldMuteVideo ? 'text-red-400' : ''}`}>
                                {shouldMuteVideo ? <VolumeX size={32}/> : <Volume2 size={32}/>}
                            </div>
                            <span className="text-xs font-bold">{shouldMuteVideo ? 'مكتوم' : 'الصوت'}</span>
                        </button>
                    ) : capturedMedia.type === 'photo' ? (
                        originalPhotoBeforeEnhance ? (
                             <button onClick={handleUndoEnhance} disabled={isEnhancing} className="flex flex-col items-center gap-1 text-white disabled:opacity-50">
                                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-yellow-300">
                                    <RotateCcw size={32}/>
                                </div>
                                <span className="text-xs font-bold">تراجع</span>
                            </button>
                        ) : (
                            <button onClick={handleEnhancePhoto} disabled={isEnhancing} className="flex flex-col items-center gap-1 text-white disabled:opacity-50">
                                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-yellow-300">
                                    <Sparkles size={32}/>
                                </div>
                                <span className="text-xs font-bold">تحسين</span>
                            </button>
                        )
                    ) : (
                        <div className="w-16 h-16" />
                    )}
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {isAudioModalOpen && <QuickAudioModal onClose={() => setIsAudioModalOpen(false)} onAudioAnalyzed={handleAudioAnalyzed} />}
        
        <input type="file" accept="image/*" capture="environment" ref={photoInputRef} onChange={handleMediaSelect} className="hidden" />
        <input type="file" accept="video/*" capture="environment" ref={videoInputRef} onChange={handleMediaSelect} className="hidden" />

        <header className="flex-shrink-0 p-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
                <button onClick={toggleDarkMode} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full"><Sun/></button>
                <button onClick={onOpenApiKeyModal} className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full"><Key/></button>
            </div>
            <h1 className="text-2xl font-bold font-sans">ZAD | زاد</h1>
            <div className="w-20"></div> {/* Spacer */}
        </header>
        
        <main className="flex-grow flex flex-col justify-center items-center p-6 text-center">
            {isProcessing && <Loader2 className="animate-spin mb-4 text-primary" size={48} />}
            {error && <div className="p-3 mb-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-2"><AlertTriangle size={18}/> {error}</div>}
            
            <h2 className="text-3xl font-bold mb-2">أهلاً بك</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8">ماذا تريد أن تفعل الآن؟</p>

            <div className="w-full max-w-sm space-y-4">
                <button 
                    onClick={() => photoInputRef.current?.click()}
                    disabled={isProcessing || !location}
                    className="w-full h-24 bg-blue-500 text-white rounded-2xl shadow-lg flex items-center justify-center gap-4 text-2xl font-bold hover:bg-blue-600 transition-transform transform hover:scale-105 disabled:opacity-50"
                >
                    <Camera size={32} />
                    <span>التقط صورة</span>
                </button>
                <button 
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isProcessing || !location}
                    className="w-full h-24 bg-purple-500 text-white rounded-2xl shadow-lg flex items-center justify-center gap-4 text-2xl font-bold hover:bg-purple-600 transition-transform transform hover:scale-105 disabled:opacity-50"
                >
                    <Video size={32} />
                    <span>سجل فيديو</span>
                </button>
                 <button 
                    onClick={() => setIsAudioModalOpen(true)}
                    disabled={isProcessing}
                    className="w-full h-24 bg-red-500 text-white rounded-2xl shadow-lg flex items-center justify-center gap-4 text-2xl font-bold hover:bg-red-600 transition-transform transform hover:scale-105 disabled:opacity-50"
                >
                    <Mic size={32} />
                    <span>ملاحظة صوتية</span>
                </button>
            </div>
            {!location && locationError && <p className="text-sm text-red-500 mt-4">{locationError}</p>}
        </main>
        
        <footer className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex justify-around items-center">
                <button onClick={() => onSelectTool(Tool.MySpace)} className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light">
                    <User size={28}/>
                    <span className="text-xs font-bold">مساحتي</span>
                </button>
                <button onClick={() => setIsToolsDrawerOpen(true)} className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light">
                    <Grid3X3 size={28}/>
                    <span className="text-xs font-bold">الأدوات</span>
                </button>
            </div>
        </footer>

        <ToolsDrawer isOpen={isToolsDrawerOpen} onClose={() => setIsToolsDrawerOpen(false)} onSelectTool={onSelectTool} />
    </div>
  );
};

export default CaptureScreen;