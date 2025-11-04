import React, { useState, useEffect, useRef } from 'react';
import { Tool, Trip, JournalEntry, JournalPhoto, JournalVideo, Expense } from '../types';
import * as db from '../services/dbService';
import * as geminiService from '../services/geminiService';
import { blobToBase64, compressImageAndConvertToBase64 } from '../utils/helpers';
import ToolsDrawer from './ToolsDrawer';
import { Camera, Video, Mic, User, Grid3X3, Sun, Moon, Key, VideoOff, MicOff, CameraOff, AlertTriangle, Circle, Loader2, FlipHorizontal, Zap, ZapOff } from 'lucide-react';

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };
  
  const startCameraStream = async () => {
    stopCameraStream();
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: activeMode === 'video' // Only request audio if in video mode
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.error("Camera error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('يرجى تمكين الوصول إلى الكاميرا.');
      } else {
        setCameraError('لا يمكن الوصول إلى الكاميرا.');
      }
    }
  };

  useEffect(() => {
    // When camera mode changes, reset flash state as the new stream will have flash off.
    setIsFlashOn(false);
    startCameraStream();
    return () => stopCameraStream();
  }, [facingMode, activeMode]);
  
  const toggleFlash = async () => {
    if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities();
        // @ts-ignore: `torch` is a valid capability but not in all TS libs
        if (capabilities.torch) {
            try {
                await videoTrack.applyConstraints({
                    // @ts-ignore
                    advanced: [{ torch: !isFlashOn }]
                });
                setIsFlashOn(!isFlashOn);
            } catch (err) {
                console.error("Failed to toggle flash:", err);
            }
        }
    }
  };

  const getOrCreateActiveJournalObjects = async (): Promise<{ trip: Trip; entry: JournalEntry; }> => {
    // This logic is moved from Dashboard.tsx
    const today = new Date().toISOString().split('T')[0];
    const allTrips = await db.getAllTrips();
    let activeTrip = allTrips.find(t => t.startDate <= today && t.endDate >= today);

    if (!activeTrip) {
      if (!location) throw new Error("لا يمكن إنشاء رحلة جديدة بدون موقع.");
      const tripName = await geminiService.generateTripNameFromLocation(location);
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 7);

      const newTrip: Trip = {
        id: generateId(),
        name: tripName,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        entries: [],
      };
      await db.putTrip(newTrip);
      activeTrip = newTrip;
    }

    let todayEntry = activeTrip.entries.find(e => e.date === today);
    if (!todayEntry) {
      todayEntry = {
        id: generateId(),
        date: today,
        title: `يوميات ${today}`,
        notes: '',
        photos: [],
        videos: [],
        expenses: [],
      };
      activeTrip.entries.push(todayEntry);
      await db.putTrip(activeTrip);
    }
    return { trip: activeTrip, entry: todayEntry };
  };

  const handleTakePhoto = async () => {
    if (!videoRef.current || !location) return;
    setIsProcessing(true);
    setCaptureIndicator(true);
    setTimeout(() => setCaptureIndicator(false), 200);

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        setIsProcessing(false);
        return;
    }
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
    
    try {
        const { trip, entry } = await getOrCreateActiveJournalObjects();
        const analysis = await geminiService.analyzeImageForJournal(base64, 'image/jpeg', location);

        if (!analysis) throw new Error("فشل تحليل الصورة.");

        if (analysis.type === 'expense' && analysis.data.amount != null) {
            const { description, amount, currency, amountInSAR } = analysis.data;
            const newExpense: Expense = {
                id: generateId(), description, amount, currency, amountInSAR,
                photos: [{ id: generateId(), base64, lat: location.lat, lon: location.lon }]
            };
            entry.expenses.push(newExpense);
            await db.putTrip(trip);
            // Consider adding a toast notification here
        } else {
            const description = analysis.data.description || 'وصف تلقائي للصورة.';
            const newPhoto: JournalPhoto = { id: generateId(), base64, description, lat: location.lat, lon: location.lon };
            entry.photos.push(newPhoto);
            if (description) entry.notes = (entry.notes ? `${entry.notes}\n- ${description}` : `- ${description}`).trim();
            await db.putTrip(trip);
        }
    } catch (error) {
        console.error(error);
        // Add user-facing error feedback
    } finally {
        setIsProcessing(false);
    }
  };

  const handleToggleVideoRecording = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    } else {
      if (!streamRef.current || !location) return;
      setIsRecording(true);
      const options = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? { mimeType: 'video/webm;codecs=vp9' }
          : MediaRecorder.isTypeSupported('video/webm')
          ? { mimeType: 'video/webm' }
          : {};
      mediaRecorderRef.current = new MediaRecorder(streamRef.current, options);
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        const videoBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType });
        try {
            const { trip, entry } = await getOrCreateActiveJournalObjects();
            const { base64, mimeType } = await blobToBase64(videoBlob);
            const description = await geminiService.analyzeMediaForJournal(base64, mimeType, location);
            const newVideo: JournalVideo = { id: generateId(), base64, mimeType, description, lat: location.lat, lon: location.lon };
            entry.videos.push(newVideo);
            if (description) entry.notes = (entry.notes ? `${entry.notes}\n- ${description}` : `- ${description}`).trim();
            await db.putTrip(trip);
        } catch (error) {
            console.error(error);
        } finally {
            setIsProcessing(false);
        }
      };
      mediaRecorderRef.current.start();
    }
  };
  
  const handleToggleAudioRecording = async () => {
    if (isRecording) {
        mediaRecorderRef.current?.stop();
    } else {
        if (!location) return;
        setIsRecording(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? { mimeType: 'audio/webm;codecs=opus' } : {};
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = e => audioChunksRef.current.push(e.data);
            mediaRecorderRef.current.onstop = async () => {
                setIsRecording(false);
                setIsProcessing(true);
                const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType });
                 try {
                    const { trip, entry } = await getOrCreateActiveJournalObjects();
                    const { base64, mimeType } = await blobToBase64(audioBlob);
                    const analysis = await geminiService.analyzeAudioForJournal(base64, mimeType);

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
                } catch (e) { console.error(e); }
                finally { setIsProcessing(false); }
            };
            mediaRecorderRef.current.start();
        } catch (err) {
            console.error(err);
            setCameraError('يرجى تمكين الوصول إلى الميكروفون.');
            setIsRecording(false);
        }
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
           {isRecording ? <MicOff size={36} /> : <Mic size={36} />}
        </button>;
    }
  };

  return (
    <div className="relative w-screen h-screen bg-black text-white overflow-hidden">
      {isProcessing && <div className="absolute inset-0 bg-black/50 z-40 flex items-center justify-center"><Loader2 className="animate-spin" size={48} /></div>}
      <ToolsDrawer isOpen={isToolsDrawerOpen} onClose={() => setIsToolsDrawerOpen(false)} onSelectTool={onSelectTool} />

      {/* Main View */}
      {activeMode !== 'audio' && (
        <>
            <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
             <div className={`absolute inset-0 bg-white transition-opacity duration-200 ${captureIndicator ? 'opacity-80' : 'opacity-0'}`} style={{ pointerEvents: 'none' }}></div>
        </>
      )}
      {activeMode === 'audio' && (
          <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-4">
              <Mic size={128} className={`transition-colors duration-300 ${isRecording ? 'text-red-500' : 'text-primary'}`} />
              <p className="text-xl font-semibold">{isRecording ? "جاري التسجيل..." : "جاهز للتسجيل الصوتي"}</p>
          </div>
      )}
      {cameraError && (
        <div className="absolute inset-0 bg-black flex flex-col items-center justify-center p-4 text-center">
          <CameraOff size={64} className="text-red-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">خطأ في الكاميرا</h2>
          <p className="text-gray-400">{cameraError}</p>
        </div>
      )}

      {/* Header Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent">
        <div className="flex items-center gap-2">
            <button onClick={toggleDarkMode} className="p-2 bg-black/30 rounded-full backdrop-blur-sm"><Sun/></button>
            <button onClick={onOpenApiKeyModal} className="p-2 bg-black/30 rounded-full backdrop-blur-sm"><Key/></button>
        </div>
        <div className="flex items-center gap-2">
          {activeMode !== 'audio' &&
            <button onClick={toggleFlash} className={`p-2 bg-black/30 rounded-full backdrop-blur-sm ${isFlashOn ? 'text-yellow-400' : 'text-white'}`}>
                {isFlashOn ? <ZapOff /> : <Zap />}
            </button>
          }
          <button onClick={() => setFacingMode(p => p === 'user' ? 'environment' : 'user')} className="p-2 bg-black/30 rounded-full backdrop-blur-sm"><FlipHorizontal /></button>
        </div>
      </div>
      
      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center gap-6 bg-gradient-to-t from-black/70 to-transparent">
        {/* Mode Switcher */}
        <div className="bg-black/40 backdrop-blur-sm p-1 rounded-full flex items-center gap-1 text-sm font-semibold">
          <button onClick={() => setActiveMode('photo')} className={`px-4 py-2 rounded-full ${activeMode === 'photo' && 'bg-white/20'}`}>صورة</button>
          <button onClick={() => setActiveMode('video')} className={`px-4 py-2 rounded-full ${activeMode === 'video' && 'bg-white/20'}`}>فيديو</button>
          <button onClick={() => setActiveMode('audio')} className={`px-4 py-2 rounded-full ${activeMode === 'audio' && 'bg-white/20'}`}>صوت</button>
        </div>
        
        {/* Action Buttons */}
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
