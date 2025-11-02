import React, { useState, useEffect } from 'react';
import { Tool } from '../types';
import * as db from '../services/dbService';
import { Scan, MapPin, Search, UtensilsCrossed, PartyPopper, Route, FlaskConical, User, Heart, Sun, Moon, Building2, Key, ParkingCircle, Home, Car } from 'lucide-react';

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
  onSelectTool: (tool: Tool) => void;
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
        <div className="relative">
          <input 
            type="search"
            placeholder="ابحث في كل أدوات زاد..."
            className="w-full p-4 pr-12 text-lg bg-white dark:bg-gray-800 rounded-2xl shadow-md dark:shadow-black/20 focus:outline-none focus:ring-2 focus:ring-primary"
            disabled // Placeholder for now
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400" />
        </div>

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