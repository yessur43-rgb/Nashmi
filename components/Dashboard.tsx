import React, { useState, useEffect, useRef } from 'react';
import { Tool } from '../types';
import * as db from '../services/dbService';
import * as geminiService from '../services/geminiService';
import { Scan, MapPin, Search, UtensilsCrossed, PartyPopper, Route, FlaskConical, User, Heart, Sun, Moon, Building2, Key, ParkingCircle, Home, Car, Mic, Loader2 } from 'lucide-react';

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
}

const tools: ToolInfo[] = [
  { id: Tool.FindPlaces, title: 'ابحث عن أماكن', description: 'ابحث عن مطاعم، مساجد، محطات، وغيرها', icon: MapPin, color: 'bg-blue-500' },
  { id: Tool.ProductAnalyzer, title: 'تحليل المنتج', description: 'تحقق من حلال/حرام المنتجات', icon: Scan, color: 'bg-teal-500' },
  { id: Tool.MenuAnalyzer, title: 'تحليل القائمة', description: 'حلل قوائم المطاعم تلقائياً', icon: UtensilsCrossed, color: 'bg-red-500' },
  { id: Tool.FindIt, title: 'أوجدها لي', description: 'ابحث عن منتجات ومتاجر', icon: Search, color: 'bg-purple-500' },
  { id: Tool.OnMyWay, title: 'على طريقي', description: 'أماكن على طريق رحلتك', icon: Route, color: 'bg-orange-500' },
  { id: Tool.ActivitiesFinder, title: 'الأنشطة', description: 'اكتشف أنشطة وفعاليات', icon: PartyPopper, color: 'bg-pink-500' },
  { id: Tool.CityCenterFinder, title: 'أين قلب المدينة؟', description: 'اكتشف وسط المدينة ومعالمه', icon: Building2, color: 'bg-indigo-500' },
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

const Dashboard: React.FC<DashboardProps> = ({ onSelectTool, isDarkMode, toggleDarkMode, onOpenApiKeyModal }) => {
  const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
  
  // Unified Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const speechRecognitionRef = useRef<any>(null); // Using 'any' for SpeechRecognition
  
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
        const actions: SmartAction[] = [];
        const today = new Date().toISOString().split('T')[0];

        // 1. Park My Car
        const parkingInfo = await db.getParkingInfo();
        if (parkingInfo) {
            actions.push({
                id: Tool.ParkMyCar,
                title: 'العودة إلى سيارتي',
                subtitle: `أوقفتها في ${new Date(parkingInfo.timestamp).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit', numberingSystem: 'latn' })}`,
                icon: Car,
                color: 'bg-slate-500'
            });
        }

        // 2. My Accommodation
        const accommodations = await db.getAllAccommodations();
        if (accommodations.length > 0) {
            const latestAccommodation = accommodations.sort((a, b) => b.timestamp - a.timestamp)[0];
            actions.push({
                id: Tool.MyAccommodation,
                title: 'العودة إلى سكني',
                subtitle: `آخر مكان: ${latestAccommodation.name}`,
                icon: Home,
                color: 'bg-cyan-500'
            });
        }
        
        // 3. My Space (Journaling)
        const trips = await db.getAllTrips();
        const activeTrip = trips.find(trip => trip.endDate >= today && trip.startDate <= today);
        if (activeTrip) {
             actions.push({
                id: Tool.MySpace,
                title: 'دوّن يومياتك',
                subtitle: `رحلة "${activeTrip.name}"`,
                icon: User,
                color: 'bg-green-500'
            });
        }

        // 4. Favorites
        const favs = [
            ...(await db.getAllFavoriteActivities()),
            ...(await db.getAllFavoriteStores()),
            ...(await db.getAllFavoritePlaces()),
            ...(await db.getAllFavoriteRoutePlaces()),
        ];

        if (favs.length > 0) {
            actions.push({
                id: Tool.Favorites,
                title: 'اذهب للمفضلة',
                subtitle: `لديك ${favs.length} عناصر محفوظة`,
                icon: Heart,
                color: 'bg-rose-500'
            });
        }

        // 5. Default/Welcome Action if no other actions
        if (actions.length === 0) {
             actions.push({
                id: Tool.ProductAnalyzer,
                title: 'جرب تحليل المنتجات',
                subtitle: 'امسح باركود أو التقط صورة',
                icon: Scan,
                color: 'bg-teal-500'
            });
            actions.push({
                id: Tool.FindPlaces,
                title: 'ابحث عن أماكن',
                subtitle: 'مطاعم حلال، مساجد، والمزيد',
                icon: MapPin,
                color: 'bg-blue-500'
            });
        }

        setSmartActions(actions);
    };

    generateSmartActions();
  }, []);


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

      <main className="px-6 pb-6 space-y-8">
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
                <SmartCard key={action.id} action={action} onClick={() => onSelectTool(action.id)} />
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
    </div>
  );
};

export default Dashboard;