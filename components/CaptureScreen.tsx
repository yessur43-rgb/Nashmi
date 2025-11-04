

import React, { useState, useEffect, useRef } from 'react';
import { Tool, Trip, JournalEntry, JournalPhoto, JournalVideo, Expense } from '../types';
import * as db from '../services/dbService';
import * as geminiService from '../services/geminiService';
import { blobToBase64, generateVideoThumbnail, getSupportedVideoMimeType, removeAudioFromVideo } from '../utils/helpers';
import ToolsDrawer from './ToolsDrawer';
// FIX: Added MicOff to lucide-react imports
import { Camera, Video, Mic, User, Grid3X3, Sun, Moon, Key, AlertTriangle, Circle, Loader2, FlipHorizontal, Zap, ZapOff, XCircle, Save, Volume2, VolumeX, MicOff, Sparkles } from 'lucide-react';

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

type CapturedMedia = {
    type: 'photo' | 'video' | 'audio';
    objectUrl: string;
    base64: string;
    blob?: Blob;
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const [activeMode, setActiveMode] = useState<'photo' | 'video' | 'audio'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [captureIndicator, setCaptureIndicator] = useState(false);
  
  const [recordingTime, setRecordingTime] = useState(0);
  const timerIntervalRef = useRef<number | null>(null);
  
  // New state for the preview screen
  const [capturedMedia, setCapturedMedia] = useState<CapturedMedia | null>(null);
  const [shouldMuteVideo, setShouldMuteVideo] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);


  useEffect(() => {
    if (isRecording && (activeMode === 'video' || activeMode === 'audio')) {
        setRecordingTime(0);
        timerIntervalRef.current = window.setInterval(() => {
            setRecordingTime(prevTime => prevTime + 1);
        }, 1000);
    } else {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }
        setRecordingTime(0);
    }

    return () => {
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording, activeMode]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  };

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };
  
  const startCameraStream = async () => {
    if (capturedMedia) return; // Don't start stream if preview is shown
    stopCameraStream();
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: activeMode === 'video'
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('تم رفض الوصول إلى الكاميرا. يرجى تمكين الإذن في إعدادات متصفحك.');
      } else {
        setCameraError('لا يمكن الوصول إلى الكاميرا. قد تكون قيد الاستخدام من قبل تطبيق آخر.');
      }
    }
  };

  useEffect(() => {
    setIsFlashOn(false);
    if (!capturedMedia) {
        startCameraStream();
    }
    return () => stopCameraStream();
  }, [facingMode, activeMode, capturedMedia]);

  useEffect(() => {
    // Cleanup for object URLs
    return () => {
        if (capturedMedia) {
            URL.revokeObjectURL(capturedMedia.objectUrl);
        }
    };
  }, [capturedMedia]);
  
  const toggleFlash = async () => {
    if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities();
        // @ts-ignore
        if (capabilities.torch) {
            try {
                // @ts-ignore
                await videoTrack.applyConstraints({ advanced: [{ torch: !isFlashOn }] });
                setIsFlashOn(!isFlashOn);
            } catch (err) { console.error("Failed to toggle flash:", err); }
        }
    }
  };

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

  const handleTakePhoto = async () => {
    if (!videoRef.current) return;
    setCaptureIndicator(true);
    setTimeout(() => setCaptureIndicator(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob(async (blob) => {
        if (blob) {
            const objectUrl = URL.createObjectURL(blob);
            const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
            setCapturedMedia({ type: 'photo', objectUrl, base64 });
            stopCameraStream();
        }
    }, 'image/jpeg', 0.9);
  };

  const handleToggleVideoRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    } else {
      if (!streamRef.current) return;
      setIsRecording(true);
      const options = getSupportedVideoMimeType();
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
        const videoBlob = new Blob(audioChunksRef.current, { type: mimeType });
        // FIX: Add a check to ensure the recorded video blob is not empty, preventing a "Load failed" error in the preview player.
        if (videoBlob.size === 0) {
            console.warn("Video recording resulted in an empty file. Discarding.");
            setCameraError("فشل تسجيل الفيديو. قد يكون التسجيل قصيرًا جدًا.");
            // Reset to a clean state
            setIsRecording(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            setRecordingTime(0);
            return;
        }
        const objectUrl = URL.createObjectURL(videoBlob);
        const base64 = await blobToBase64(videoBlob);
        setCapturedMedia({ type: 'video', objectUrl, base64, blob: videoBlob, mimeType });
        stopCameraStream();
      };
      mediaRecorderRef.current.start();
    }
  };
  
  const handleToggleAudioRecording = async () => {
    if (isRecording) {
        mediaRecorderRef.current?.stop();
    } else {
        setIsRecording(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const options = getSupportedVideoMimeType();
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
            mediaRecorderRef.current.onstop = async () => {
                setIsRecording(false);
                stopCameraStream();
                const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                // FIX: Add a check to ensure the recorded audio blob is not empty, preventing a "Load failed" error in the preview player.
                if (audioBlob.size === 0) {
                    console.warn("Audio recording resulted in an empty file. Discarding.");
                    setCameraError("فشل تسجيل الصوت. قد يكون التسجيل قصيرًا جدًا.");
                    // Reset to a clean state
                    setIsRecording(false);
                    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
                    setRecordingTime(0);
                    return;
                }
                const objectUrl = URL.createObjectURL(audioBlob);
                const base64 = await blobToBase64(audioBlob);
                setCapturedMedia({ type: 'audio', objectUrl, base64, blob: audioBlob, mimeType });
            };
            mediaRecorderRef.current.start();
        } catch (err) {
            console.error(err);
            setCameraError('يرجى تمكين الوصول إلى الميكروفون.');
            setIsRecording(false);
        }
    }
  };

  const handleDiscardMedia = () => {
    if (capturedMedia) {
        URL.revokeObjectURL(capturedMedia.objectUrl);
    }
    setCapturedMedia(null);
    setShouldMuteVideo(false);
  };

  const handleEnhancePhoto = async () => {
    if (!capturedMedia || capturedMedia.type !== 'photo') return;
    
    setIsEnhancing(true);
    setCameraError(null);
    try {
        const enhancedBase64 = await geminiService.enhancePhoto(capturedMedia.base64);
        if (enhancedBase64) {
            // Create new blob and object URL for the enhanced image
            const byteCharacters = atob(enhancedBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/jpeg' });
            const newObjectUrl = URL.createObjectURL(blob);

            // Revoke old URL before setting new state to prevent memory leaks
            URL.revokeObjectURL(capturedMedia.objectUrl);
            
            setCapturedMedia({
                ...capturedMedia,
                base64: enhancedBase64,
                objectUrl: newObjectUrl,
            });

        } else {
            setCameraError("فشل تحسين الصورة. حاول مرة أخرى.");
        }
    } catch (error) {
        console.error("Error enhancing photo:", error);
        setCameraError("حدث خطأ غير متوقع أثناء تحسين الصورة.");
    } finally {
        setIsEnhancing(false);
    }
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
        } else if (capturedMedia.type === 'audio') {
            const analysis = await geminiService.analyzeAudioForJournal(capturedMedia.base64, capturedMedia.mimeType || 'audio/webm');
            if (analysis?.type === 'note') {
                entry.notes = (entry.notes ? `${entry.notes}\n${analysis.data.transcription}` : analysis.data.transcription).trim();
            } else if (analysis?.type === 'expense') {
                const processed = await geminiService.processExpense({ text: analysis.data.amountText });
                if (processed) {
                    const newExpense: Expense = { id: generateId(), description: analysis.data.description, ...processed };
                    entry.expenses.push(newExpense);
                }
            }
        }
        await db.putTrip(trip);
    } catch (error) {
        console.error("Error processing media:", error);
        setCameraError(error instanceof Error ? error.message : 'حدث خطأ أثناء معالجة المحتوى.');
    } finally {
        setIsProcessing(false);
        handleDiscardMedia();
    }
  };

  const renderCaptureButton = () => {
    const isCaptureDisabled = isProcessing || !location;
    switch (activeMode) {
      case 'photo':
        return <button onClick={handleTakePhoto} disabled={isCaptureDisabled} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 disabled:opacity-50" aria-label="التقاط صورة" />;
      case 'video':
        return <button onClick={handleToggleVideoRecording} disabled={isCaptureDisabled} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center disabled:opacity-50" aria-label="تسجيل فيديو">
          <div className={`w-12 h-12 bg-red-500 transition-all duration-200 ${isRecording ? 'rounded-md' : 'rounded-full'}`} />
        </button>;
      case 'audio':
        return <button onClick={handleToggleAudioRecording} disabled={isCaptureDisabled} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 flex items-center justify-center text-red-500 disabled:opacity-50" aria-label="تسجيل صوت">
           {isRecording ? <MicOff size={36} className="animate-pulse" /> : <Mic size={36} />}
        </button>;
    }
  };
  
  if (capturedMedia) {
    return (
        <div className="absolute inset-0 bg-black z-20 flex flex-col animate-fade-in">
            {isProcessing && <div className="absolute inset-0 bg-black/70 z-40 flex flex-col items-center justify-center"><Loader2 className="animate-spin mb-4" size={48} /><p>جاري الحفظ...</p></div>}
            {isEnhancing && <div className="absolute inset-0 bg-black/70 z-30 flex flex-col items-center justify-center"><Loader2 className="animate-spin mb-4" size={48} /><p>جاري تحسين الصورة بالذكاء الاصطناعي...</p></div>}
            
            <div className="flex-grow flex items-center justify-center p-4 relative">
                {capturedMedia.type === 'photo' && <img src={capturedMedia.objectUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />}
                {capturedMedia.type === 'video' && <video src={capturedMedia.objectUrl} controls autoPlay className="max-w-full max-h-full rounded-lg" />}
                {capturedMedia.type === 'audio' && <div className="p-8 flex flex-col items-center gap-4"><Mic size={80} className="text-primary"/><audio src={capturedMedia.objectUrl} controls autoPlay className="w-full max-w-sm" /></div>}
            </div>
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
                        <button onClick={handleEnhancePhoto} disabled={isEnhancing} className="flex flex-col items-center gap-1 text-white disabled:opacity-50">
                            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center text-yellow-300">
                                <Sparkles size={32}/>
                            </div>
                            <span className="text-xs font-bold">تحسين</span>
                        </button>
                    ) : (
                        <div className="w-16 h-16" /> // Placeholder for alignment
                    )}
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="relative w-screen h-screen bg-black text-white overflow-hidden">
      <ToolsDrawer isOpen={isToolsDrawerOpen} onClose={() => setIsToolsDrawerOpen(false)} onSelectTool={onSelectTool} />
      {activeMode !== 'audio' && (
        <>
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
            <div className={`absolute inset-0 bg-white transition-opacity duration-200 ${captureIndicator ? 'opacity-80' : 'opacity-0'}`} style={{ pointerEvents: 'none' }} />
        </>
      )}
      {activeMode === 'audio' && (
          <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-4">
              <Mic size={128} className={`transition-colors duration-300 ${isRecording ? 'text-red-500 animate-pulse' : 'text-primary'}`} />
              <p className="text-xl font-semibold">{isRecording ? "جاري التسجيل..." : "جاهز للتسجيل الصوتي"}</p>
              {isRecording && <p className="font-mono text-lg">{formatTime(recordingTime)}</p>}
          </div>
      )}
      {cameraError && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-4 text-center">
          <AlertTriangle size={64} className="text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">حدث خطأ</h2>
          <p className="text-gray-400">{cameraError}</p>
          <button onClick={startCameraStream} className="mt-4 px-4 py-2 bg-primary rounded-lg"> حاول مرة أخرى</button>
        </div>
      )}

      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent z-10">
        <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className="p-2 bg-black/30 rounded-full backdrop-blur-sm"><Sun/></button>
            <button onClick={onOpenApiKeyModal} className="p-2 bg-black/30 rounded-full backdrop-blur-sm"><Key/></button>
        </div>
         {isRecording && (activeMode === 'video' || activeMode === 'audio') && (
            <div className="bg-red-500 text-white px-3 py-1 rounded-full font-mono text-sm flex items-center gap-2 animate-pulse">
                <Circle fill="white" size={8} />
                <span>{formatTime(recordingTime)}</span>
            </div>
        )}
        <div className="flex items-center gap-2">
          {activeMode !== 'audio' &&
            <button onClick={toggleFlash} className={`p-2 bg-black/30 rounded-full backdrop-blur-sm ${isFlashOn ? 'text-yellow-400' : 'text-white'}`}>
                {isFlashOn ? <ZapOff /> : <Zap />}
            </button>
          }
          <button onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')} className="p-2 bg-black/30 rounded-full backdrop-blur-sm"><FlipHorizontal /></button>
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center gap-6 bg-gradient-to-t from-black/70 to-transparent">
        <div className="bg-black/40 backdrop-blur-sm p-1 rounded-full flex items-center gap-1 text-sm font-semibold">
          <button onClick={() => setActiveMode('photo')} className={`px-4 py-2 rounded-full ${activeMode === 'photo' && 'bg-white/20'}`}>صورة</button>
          <button onClick={() => setActiveMode('video')} className={`px-4 py-2 rounded-full ${activeMode === 'video' && 'bg-white/20'}`}>فيديو</button>
          <button onClick={() => setActiveMode('audio')} className={`px-4 py-2 rounded-full ${activeMode === 'audio' && 'bg-white/20'}`}>صوت</button>
        </div>
        <div className="w-full flex justify-around items-center">
            <button onClick={() => onSelectTool(Tool.MySpace)} className="flex flex-col items-center gap-1">
                <div className="w-14 h-14 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center"><User size={28}/></div>
                <span className="text-xs font-bold">مساحتي</span>
            </button>
            {renderCaptureButton()}
            <button onClick={() => setIsToolsDrawerOpen(true)} className="flex flex-col items-center gap-1">
                <div className="w-14 h-14 bg-black/30 backdrop-blur-sm rounded-full flex items-center justify-center"><Grid3X3 size={28}/></div>
                <span className="text-xs font-bold">الأدوات</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default CaptureScreen;