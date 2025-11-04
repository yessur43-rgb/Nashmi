

import React, { useState, useEffect, useRef } from 'react';
import { Tool, Trip, JournalEntry, JournalPhoto, JournalVideo, Expense } from '../types';
import * as db from '../services/dbService';
import * as geminiService from '../services/geminiService';
import { Scan, MapPin, Search, UtensilsCrossed, PartyPopper, Route, FlaskConical, User, Heart, Sun, Moon, Building2, Key, ParkingCircle, Home, Car, Mic, Loader2, BrainCircuit, Coffee, Utensils, Camera, Video, Plus, X } from 'lucide-react';
import { compressImageAndConvertToBase64, blobToBase64 } from '../utils/helpers';
import QuickAudioModal from './common/QuickAudioModal';

interface ToolInfo {
  id: Tool;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

interface SmartAction {
  id: Tool;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  priority?: number;
  params?: any;
}

const tools: ToolInfo[] = [
  { id: Tool.FindPlaces, title: 'ابحث عن أماكن', description: 'ابحث عن مطاعم، مساجد، محطات، وغيرها', icon: MapPin, color: 'bg-blue-500' },
  { id: Tool.ProductAnalyzer, title: 'تحليل المنتج', description: 'تحقق من حلال/حرام المنتجات', icon: Scan, color: 'bg-teal-500' },
  { id: Tool.MenuAnalyzer, title: 'تحليل القائمة', description: 'حلل قوائم المطاعم تلقائياً', icon: UtensilsCrossed, color: 'bg-red-500' },
  { id: Tool.FindIt, title: 'أوجدها لي', description: 'ابحث عن منتجات ومتاجر', icon: Search, color: 'bg-purple-500' },
  { id: Tool.OnMyWay, title: 'على طريقي', description: 'أماكن على طريق رحلتك', icon: Route, color: 'bg-orange-500' },
  { id: Tool.ActivitiesFinder, title: 'الأنشطة', description: 'اكتشف أنشطة وفعاليات', icon: PartyPopper, color: 'bg-pink-500' },
  { id: Tool.CityCenterFinder, title: 'أين قلب المدينة؟', description: 'اكتشف وسط المدينة ومعالمه', icon: Building2, color: 'bg-indigo-500' },
  { id: Tool.AskMeAnything, title: 'اسألني أي شيء', description: 'مساعدك الذكي لكل استفسارات السفر', icon: BrainCircuit, color: 'bg-indigo-500' },
  { id: Tool.ParkMyCar, title: 'أين أوقفت سيارتي؟', description: 'احفظ موقع سيارتك بسهولة', icon: ParkingCircle, color: 'bg-slate-500' },
  { id: Tool.MyAccommodation, title: 'أين أسكن؟', description: 'احفظ موقع سكنك للعودة إليه', icon: Home, color: 'bg-cyan-500' },
  { id: Tool.IngredientGuide, title: 'دليل المكونات', description: 'معلومات عن المكونات الغذائية', icon: FlaskConical, color: 'bg-yellow-500' },
  { id: Tool.MySpace, title: 'مساحتي', description: 'دفتر رحلات شخصي ذكي', icon: User, color: 'bg-green-500' },
  { id: Tool.Favorites, title: 'المفضلة', description: 'احفظ أماكنك المفضلة', icon: Heart, color: 'bg-rose-500' },
];

interface DashboardProps {
  onSelectTool: (tool: Tool, initialState?: any) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onOpenApiKeyModal: () => void;
  location: { lat: number; lon: number } | null;
  locationError: string | null;
}

const SmartCard: React.FC<{ action: SmartAction; onClick: () => void; }> = ({ action, onClick }) => (
    <div
        onClick={onClick}
        className="flex-shrink-0 w-48 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-md dark:shadow-black/20 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col items-start gap-3"
    >
        <div className={`p-2.5 rounded-full ${action.color} text-white shadow-md`}>
            <action.icon size={24} />
        </div>
        <div className="flex-grow">
            <h3 className="text-md font-bold text-gray-800 dark:text-white">{action.title}</h3>
            <p className="text-gray-500 dark:text-gray-400 text-xs">{action.subtitle}</p>
        </div>
    </div>
);

const ToolCard: React.FC<{ tool: ToolInfo; onClick: () => void; }> = ({ tool, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="group bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md dark:shadow-black/20 hover:shadow-lg transform hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-center gap-4"
    >
      <div className={`p-3 rounded-full ${tool.color} text-white shadow-md flex-shrink-0`}>
        <tool.icon size={28} />
      </div>
      <div className="flex-grow">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-1">{tool.title}</h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{tool.description}</p>
      </div>
    </div>
  );
};

const generateId = () => `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const Dashboard: React.FC<DashboardProps> = ({ onSelectTool, isDarkMode, toggleDarkMode, onOpenApiKeyModal, location, locationError }) => {
  const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
  
  // Unified Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const speechRecognitionRef = useRef<any>(null); // Using 'any' for SpeechRecognition

  // Quick Capture FAB state
  const [isFabMenuOpen, setIsFabMenuOpen] = useState(false);
  const quickPhotoInputRef = useRef<HTMLInputElement>(null);
  const quickVideoInputRef = useRef<HTMLInputElement>(null);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  
  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      speechRecognitionRef.current = new SpeechRecognition();
      const recognition = speechRecognitionRef.current;
      recognition.continuous = false;
      recognition.lang = 'ar-SA';
      recognition.interimResults = true;

      recognition.onresult = (event: any) => { // Using 'any' for SpeechRecognitionEvent
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const finalTranscript = event.results[i][0].transcript.trim();
            setSearchQuery(finalTranscript);
            processCommand(finalTranscript);
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        setInterimTranscript(interim);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };
       recognition.onerror = (event: any) => { // Using 'any' for SpeechRecognitionError
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setInterimTranscript('');
      };

    } else {
      console.warn("Speech Recognition not supported in this browser.");
    }
  }, []);

  const processCommand = async (command: string) => {
    if (!command) return;
    
    setIsProcessing(true);
    setSearchQuery(command); // Show the final command in search bar

    const result = await geminiService.interpretUserCommand(command);

    if (result) {
        if (window.speechSynthesis && result.spokenResponse) {
            const utterance = new SpeechSynthesisUtterance(result.spokenResponse);
            utterance.lang = 'ar-SA';
            window.speechSynthesis.speak(utterance);
        }
        onSelectTool(result.tool, result.parameters);
        setSearchQuery(''); // Clear after execution
    } else {
        // Handle error - maybe show a toast message
        if (window.speechSynthesis) {
            const utterance = new SpeechSynthesisUtterance("عذراً، لم أفهم طلبك.");
            utterance.lang = 'ar-SA';
            window.speechSynthesis.speak(utterance);
        }
    }
    
    setIsProcessing(false);
  };
  
  const handleToggleListening = () => {
    if (isListening) {
      speechRecognitionRef.current?.stop();
      setIsListening(false);
    } else if (speechRecognitionRef.current) {
      setSearchQuery('');
      setInterimTranscript('');
      speechRecognitionRef.current.start();
      setIsListening(true);
    }
  };
  
  const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      processCommand(searchQuery);
  };

  useEffect(() => {
    const generateSmartActions = async () => {
        const potentialActions: SmartAction[] = [];
        const today = new Date().toISOString().split('T')[0];
        const currentHour = new Date().getHours();

        // --- High Priority ---
        const parkingInfo = await db.getParkingInfo();
        if (parkingInfo) {
            potentialActions.push({
                id: Tool.ParkMyCar,
                title: 'العودة إلى سيارتي',
                subtitle: `أوقفتها في ${new Date(parkingInfo.timestamp).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit', numberingSystem: 'latn' })}`,
                icon: Car,
                color: 'bg-slate-500',
                priority: 100
            });
        }

        const accommodations = await db.getAllAccommodations();
        if (accommodations.length > 0) {
            const latestAccommodation = accommodations.sort((a, b) => b.timestamp - a.timestamp)[0];
            potentialActions.push({
                id: Tool.MyAccommodation,
                title: 'العودة إلى سكني',
                subtitle: `آخر مكان: ${latestAccommodation.name}`,
                icon: Home,
                color: 'bg-cyan-500',
                priority: 90
            });
        }
        
        const trips = await db.getAllTrips();
        const activeTrip = trips.find(trip => trip.endDate >= today && trip.startDate <= today);
        if (activeTrip) {
             potentialActions.push({
                id: Tool.MySpace,
                title: 'دوّن يومياتك',
                subtitle: `رحلة "${activeTrip.name}"`,
                icon: User,
                color: 'bg-green-500',
                priority: 80
            });
        }

        // --- Contextual (Time-based) ---
        if (currentHour >= 6 && currentHour < 11) { // Morning
            potentialActions.push({
                id: Tool.FindPlaces,
                title: 'أين أجد قهوة؟',
                subtitle: 'ابدأ يومك بنشاط',
                icon: Coffee,
                color: 'bg-amber-600',
                priority: 70,
                params: { query: 'مقهى' }
            });
        }
        if (currentHour >= 11 && currentHour < 15) { // Lunch
            potentialActions.push({
                id: Tool.FindPlaces,
                title: 'ابحث عن غداء حلال',
                subtitle: 'حان وقت الغداء',
                icon: Utensils,
                color: 'bg-red-500',
                priority: 70,
                params: { query: 'مطعم حلال' }
            });
        }
        if (currentHour >= 15 && currentHour < 19) { // Afternoon
            potentialActions.push({
                id: Tool.ActivitiesFinder,
                title: 'اكتشف أنشطة العصر',
                subtitle: 'استمتع بما تبقى من يومك',
                icon: PartyPopper,
                color: 'bg-pink-500',
                priority: 70,
                params: { query: 'أنشطة عائلية' }
            });
        }
        if (currentHour >= 19) { // Evening
            potentialActions.push({
                id: Tool.FindPlaces,
                title: 'مطاعم للعشاء',
                subtitle: 'أين ستتناول عشاءك؟',
                icon: UtensilsCrossed,
                color: 'bg-blue-500',
                priority: 70,
                params: { query: 'مطعم عشاء' }
            });
        }

        // --- Fillers ---
        const favs = [
            ...(await db.getAllFavoriteActivities()),
            ...(await db.getAllFavoriteStores()),
            ...(await db.getAllFavoritePlaces()),
            ...(await db.getAllFavoriteRoutePlaces()),
        ];

        if (favs.length > 0) {
            potentialActions.push({
                id: Tool.Favorites,
                title: 'اذهب للمفضلة',
                subtitle: `لديك ${favs.length} عناصر محفوظة`,
                icon: Heart,
                color: 'bg-rose-500',
                priority: 50
            });
        }

        // Default actions if list is small
        if (potentialActions.length < 4) {
            potentialActions.push({
                id: Tool.ProductAnalyzer,
                title: 'جرب تحليل المنتجات',
                subtitle: 'امسح باركود أو التقط صورة',
                icon: Scan,
                color: 'bg-teal-500',
                priority: 10
            });
            potentialActions.push({
                id: Tool.AskMeAnything,
                title: 'اسألني أي شيء',
                subtitle: 'مساعدك الذكي للسفر',
                icon: BrainCircuit,
                color: 'bg-indigo-500',
                priority: 5
            });
        }
        
        const uniqueActions = Array.from(new Map(potentialActions.map(item => [item.title, item])).values());
        const sortedActions = uniqueActions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        setSmartActions(sortedActions.slice(0, 5));
    };

    generateSmartActions();
  }, []);

    // Quick Capture Logic
    const getOrCreateActiveJournalObjects = async (): Promise<{ trip: Trip; entry: JournalEntry; }> => {
        const today = new Date().toISOString().split('T')[0];
        const allTrips = await db.getAllTrips();
        let activeTrip = allTrips.find(t => t.startDate <= today && t.endDate >= today);

        if (!activeTrip) {
            if (!location) {
                throw new Error("لا يمكن إنشاء رحلة جديدة بدون موقع.");
            }
            const tripName = await geminiService.generateTripNameFromLocation(location);
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + 7); // Default 1 week trip

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

    const handleQuickPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !location) return;
        
        setIsFabMenuOpen(false);
        setIsProcessing(true);
        try {
            const { trip, entry } = await getOrCreateActiveJournalObjects();
            const base64 = await compressImageAndConvertToBase64(file);
            const analysis = await geminiService.analyzeImageForJournal(base64, file.type, location);

            if (!analysis) {
                 throw new Error("فشل تحليل الصورة.");
            }

            if (analysis.type === 'expense' && analysis.data.amount != null && analysis.data.currency && analysis.data.amountInSAR != null) {
                const { description, amount, currency, amountInSAR } = analysis.data;
                const newExpense: Expense = {
                    id: generateId(),
                    description,
                    amount: amount,
                    currency: currency,
                    amountInSAR: amountInSAR,
                    photos: [{ id: generateId(), base64, lat: location.lat, lon: location.lon }]
                };
                entry.expenses.push(newExpense);
                await db.putTrip(trip);
                alert('تمت إضافة المصروف من الصورة إلى يومياتك بنجاح!');

            } else {
                const description = analysis.data.description || 'لم يتمكن الذكاء الاصطناعي من وصف هذه الصورة.';
                const newPhoto: JournalPhoto = { id: generateId(), base64, description, lat: location.lat, lon: location.lon };
                
                entry.photos.push(newPhoto);
                if (description) {
                    entry.notes = (entry.notes ? `${entry.notes}\n- ${description}` : `- ${description}`).trim();
                }
                await db.putTrip(trip);
                alert('تمت إضافة الصورة إلى يومياتك بنجاح!');
            }
        } catch (error) {
            console.error(error);
            alert((error as Error).message || "فشل في إضافة الصورة.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleQuickVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !location) return;

        setIsFabMenuOpen(false);
        setIsProcessing(true);
        try {
            const { trip, entry } = await getOrCreateActiveJournalObjects();
            const { base64, mimeType } = await blobToBase64(file);
            const description = await geminiService.analyzeMediaForJournal(base64, mimeType, location);
            const newVideo: JournalVideo = { id: generateId(), base64, mimeType, description, lat: location.lat, lon: location.lon };

            entry.videos.push(newVideo);
             if (description) {
                entry.notes = (entry.notes ? `${entry.notes}\n- ${description}` : `- ${description}`).trim();
            }
            await db.putTrip(trip);
            alert('تمت إضافة الفيديو إلى يومياتك بنجاح!');
        } catch (error) {
            console.error(error);
            alert((error as Error).message || "فشل في إضافة الفيديو.");
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleAudioAnalysis = async (analysis: any) => {
        setIsProcessing(true);
        try {
            const { trip, entry } = await getOrCreateActiveJournalObjects();
            if (analysis.type === 'note') {
                entry.notes = (entry.notes ? `${entry.notes}\n${analysis.data.transcription}` : analysis.data.transcription).trim();
            } else if (analysis.type === 'expense') {
                const processedExpense = await geminiService.processExpense({ text: analysis.data.amountText });
                if (processedExpense) {
                    const newExpense: Expense = {
                        id: generateId(),
                        description: analysis.data.description,
                        ...processedExpense
                    };
                    entry.expenses.push(newExpense);
                }
            }
            await db.putTrip(trip);
            alert('تمت إضافة التسجيل الصوتي إلى يومياتك!');
        } catch (error) {
            console.error(error);
            alert((error as Error).message || "فشل في إضافة التسجيل.");
        } finally {
            setIsProcessing(false);
        }
    };


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      <header className="p-6 flex justify-between items-center">
        <div className="w-24" />
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            <span className="font-sans">ZAD</span> | زاد
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">رفيقك في السفر</p>
        </div>
        <div className="flex items-center gap-3 w-24 justify-end">
          <button
            onClick={onOpenApiKeyModal}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            aria-label="تغيير مفتاح API"
          >
            <Key className="text-gray-700 dark:text-gray-400"/>
          </button>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="text-yellow-400" /> : <Moon className="text-gray-700" />}
          </button>
        </div>
      </header>

      <main className="px-6 pb-24 space-y-8">
        {/* Unified Search Bar */}
        <form onSubmit={handleFormSubmit} className="relative">
          <input 
            type="search"
            value={isListening ? interimTranscript : searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isListening ? "استمع الآن..." : "اسألني أي شيء أو ابحث..."}
            className="w-full p-4 pl-24 pr-12 text-lg bg-white dark:bg-gray-800 rounded-2xl shadow-md dark:shadow-black/20 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
            <button
                type="button"
                onClick={handleToggleListening}
                disabled={!speechRecognitionRef.current || isProcessing}
                className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-gray-200 dark:hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed`}
                aria-label={isListening ? "إيقاف الاستماع" : "بدء البحث الصوتي"}
            >
                <Mic className={isListening ? "" : "text-gray-500"} />
            </button>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            {isProcessing ? <Loader2 className="animate-spin text-primary" /> : <Search className="text-gray-400" />}
          </div>
        </form>

        {/* Smart Cards */}
        {smartActions.length > 0 && (
          <div>
            <div className="flex gap-4 overflow-x-auto pb-4 -mb-4">
              {smartActions.map(action => (
                <SmartCard key={action.id + action.title} action={action} onClick={() => onSelectTool(action.id, action.params)} />
              ))}
              <div className="flex-shrink-0 w-2"></div>
            </div>
          </div>
        )}

        {/* All Tools Grid */}
        <div>
            <h2 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-4">جميع الأدوات</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {tools.map((tool) => (
                    <ToolCard key={tool.id} tool={tool} onClick={() => onSelectTool(tool.id)} />
                ))}
            </div>
        </div>
      </main>

       {/* Quick Capture FAB */}
       <div className="fixed bottom-6 left-6 z-30">
        <input type="file" accept="image/*" capture="environment" ref={quickPhotoInputRef} onChange={handleQuickPhotoUpload} className="hidden" />
        <input type="file" accept="video/*" capture="environment" ref={quickVideoInputRef} onChange={handleQuickVideoUpload} className="hidden" />

        {isFabMenuOpen && (
            <div className="flex flex-col items-center gap-4 mb-4">
                <div className="flex flex-col items-center group" onClick={() => setIsAudioModalOpen(true)}>
                    <span className="text-xs bg-black/50 text-white px-2 py-1 rounded-md mb-1 opacity-0 group-hover:opacity-100 transition-opacity">صوت</span>
                    <button className="w-14 h-14 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600">
                        <Mic size={28} />
                    </button>
                </div>
                <div className="flex flex-col items-center group" onClick={() => quickVideoInputRef.current?.click()}>
                    <span className="text-xs bg-black/50 text-white px-2 py-1 rounded-md mb-1 opacity-0 group-hover:opacity-100 transition-opacity">فيديو</span>
                    <button className="w-14 h-14 bg-purple-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-purple-600">
                        <Video size={28} />
                    </button>
                </div>
                 <div className="flex flex-col items-center group" onClick={() => quickPhotoInputRef.current?.click()}>
                    <span className="text-xs bg-black/50 text-white px-2 py-1 rounded-md mb-1 opacity-0 group-hover:opacity-100 transition-opacity">صورة</span>
                    <button className="w-14 h-14 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600">
                        <Camera size={28} />
                    </button>
                </div>
            </div>
        )}
        <button
            onClick={() => setIsFabMenuOpen(!isFabMenuOpen)}
            disabled={!location}
            className="w-20 h-20 bg-primary text-white rounded-full flex items-center justify-center shadow-xl hover:bg-primary-dark transition-transform transform hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="سجل يومياتك"
        >
            {isFabMenuOpen ? <X size={36} /> : <Plus size={36} />}
        </button>
        </div>
        {isAudioModalOpen && (
            <QuickAudioModal 
                onClose={() => setIsAudioModalOpen(false)}
                onAudioAnalyzed={handleAudioAnalysis}
            />
        )}
    </div>
  );
};

export default Dashboard;