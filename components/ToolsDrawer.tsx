import React from 'react';
import { Tool } from '../types';
import { X, MapPin, Scan, UtensilsCrossed, Search, Route, PartyPopper, Building2, BrainCircuit, ParkingCircle, Home, FlaskConical, User, Heart, CloudRain } from 'lucide-react';

interface ToolInfo {
  id: Tool;
  title: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const tools: ToolInfo[] = [
  { id: Tool.FindPlaces, title: 'ابحث عن أماكن', description: 'مطاعم، مساجد، وغيرها', icon: MapPin, color: 'bg-blue-500' },
  { id: Tool.ProductAnalyzer, title: 'تحليل المنتج', description: 'تحقق من حلال/حرام', icon: Scan, color: 'bg-teal-500' },
  { id: Tool.MenuAnalyzer, title: 'تحليل القائمة', description: 'حلل قوائم المطاعم', icon: UtensilsCrossed, color: 'bg-red-500' },
  { id: Tool.FindIt, title: 'أوجدها لي', description: 'ابحث عن منتجات ومتاجر', icon: Search, color: 'bg-purple-500' },
  { id: Tool.OnMyWay, title: 'على طريقي', description: 'أماكن على طريق رحلتك', icon: Route, color: 'bg-orange-500' },
  { id: Tool.ActivitiesFinder, title: 'الأنشطة', description: 'اكتشف أنشطة وفعاليات', icon: PartyPopper, color: 'bg-pink-500' },
  { id: Tool.CityCenterFinder, title: 'أين قلب المدينة؟', description: 'اكتشف وسط المدينة', icon: Building2, color: 'bg-indigo-500' },
  { id: Tool.AskMeAnything, title: 'اسألني أي شيء', description: 'مساعدك الذكي للسفر', icon: BrainCircuit, color: 'bg-indigo-500' },
  { id: Tool.RainFinder, title: 'باحث الأمطار', description: 'ابحث عن الأمطار القريبة', icon: CloudRain, color: 'bg-sky-500' },
  { id: Tool.ParkMyCar, title: 'أين أوقفت سيارتي؟', description: 'احفظ موقع سيارتك', icon: ParkingCircle, color: 'bg-slate-500' },
  { id: Tool.MyAccommodation, title: 'أين أسكن؟', description: 'احفظ موقع سكنك', icon: Home, color: 'bg-cyan-500' },
  { id: Tool.IngredientGuide, title: 'دليل المكونات', description: 'معلومات عن المكونات', icon: FlaskConical, color: 'bg-yellow-500' },
  { id: Tool.MySpace, title: 'مساحتي', description: 'دفتر رحلات شخصي', icon: User, color: 'bg-green-500' },
  { id: Tool.Favorites, title: 'المفضلة', description: 'أماكنك المحفوظة', icon: Heart, color: 'bg-rose-500' },
];

const ToolCard: React.FC<{ tool: ToolInfo; onClick: () => void; }> = ({ tool, onClick }) => (
  <div
    onClick={onClick}
    className="group bg-white/10 dark:bg-gray-800/50 backdrop-blur-lg p-4 rounded-2xl shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300 cursor-pointer flex items-center gap-4 border border-white/20"
  >
    <div className={`p-3 rounded-full ${tool.color} text-white shadow-md flex-shrink-0`}>
      <tool.icon size={24} />
    </div>
    <div className="flex-grow">
      <h3 className="text-lg font-bold text-white mb-0.5">{tool.title}</h3>
      <p className="text-gray-300 dark:text-gray-400 text-xs">{tool.description}</p>
    </div>
  </div>
);

interface ToolsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTool: (tool: Tool) => void;
}

const ToolsDrawer: React.FC<ToolsDrawerProps> = ({ isOpen, onClose, onSelectTool }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-20" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className={`fixed bottom-0 left-0 right-0 bg-gray-900/70 dark:bg-gray-900/80 backdrop-blur-xl p-4 rounded-t-3xl shadow-[0_-10px_30px_rgba(0,0,0,0.3)] transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}
      >
        <div className="flex justify-between items-center pb-4">
          <h2 className="text-xl font-bold text-white">جميع الأدوات</h2>
          <button onClick={onClose} className="p-2 text-gray-300 bg-white/10 rounded-full hover:bg-white/20">
            <X size={24} />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto pr-2 space-y-3">
            {tools.map(tool => (
                <ToolCard 
                    key={tool.id} 
                    tool={tool} 
                    onClick={() => {
                        onSelectTool(tool.id);
                        onClose();
                    }} 
                />
            ))}
        </div>
      </div>
    </div>
  );
};

export default ToolsDrawer;