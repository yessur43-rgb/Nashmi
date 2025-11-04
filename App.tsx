
import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/common/Header';
import CaptureScreen from './components/CaptureScreen';
import ProductAnalyzer from './components/ProductAnalyzer';
import MenuAnalyzer from './components/MenuAnalyzer';
import IngredientGuide from './components/IngredientGuide';
import FindPlaces from './components/FindPlaces';
import FindIt from './components/FindIt';
import ActivitiesFinder from './components/ActivitiesFinder';
import OnMyWay from './components/OnMyWay';
import CityCenterFinder from './components/CityCenterFinder';
import ParkMyCar from './components/ParkMyCar';
import MyAccommodation from './components/MyAccommodation';
import Favorites from './components/Favorites';
// FIX: Removed unused 'StudioView' import which is not exported from MySpace.
import MySpace from './components/MySpace';
import AskMeAnything from './components/AskMeAnything';
import LocationInfo from './components/common/LocationInfo';
import ApiKeyModal from './components/common/ApiKeyModal';
import LoadingSpinner from './components/common/LoadingSpinner';
import Onboarding from './components/Onboarding';
import { Tool, Activity, StoreResult, Place, RoutePlace, Trip } from './types';
import * as db from './services/dbService';
import * as geminiService from './services/geminiService';

interface ToolProps {
  location?: { lat: number; lon: number } | null;
  locationError?: string | null;
  favorites?: Activity[];
  onToggleFavorite?: (activity: Activity) => void;
  favoriteStores?: StoreResult[];
  onToggleFavoriteStore?: (store: StoreResult) => void;
  favoritePlaces?: Place[];
  onToggleFavoritePlace?: (place: Place) => void;
  favoriteRoutePlaces?: RoutePlace[];
  onToggleFavoriteRoutePlace?: (place: RoutePlace) => void;
  initialState?: any; // For smart search initialization
}

const App: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool | null>(null);
  const [initialToolState, setInitialToolState] = useState<any>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);
  const [isDbLoading, setIsDbLoading] = useState(true);

  const [favorites, setFavorites] = useState<Activity[]>([]);
  const [favoriteStores, setFavoriteStores] = useState<StoreResult[]>([]);
  const [favoritePlaces, setFavoritePlaces] = useState<Place[]>([]);
  const [favoriteRoutePlaces, setFavoriteRoutePlaces] = useState<RoutePlace[]>([]);

  // API Key State
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isKeyLoading, setIsKeyLoading] = useState(true);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  // Onboarding State
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);


  // DB, settings, and API Key load
  useEffect(() => {
    async function loadInitialData() {
      try {
        // API Key
        const storedKeySetting = await db.getSetting('apiKey');
        if (storedKeySetting && storedKeySetting.value) {
            const key = storedKeySetting.value;
            geminiService.initializeAiClient(key);
            setApiKey(key);
        }
        setIsKeyLoading(false);

        // Dark Mode
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const darkModeSetting = await db.getSetting('darkMode');
        setIsDarkMode(darkModeSetting ? darkModeSetting.value : prefersDark);
        
        // Favorites
        setFavorites(await db.getAllFavoriteActivities());
        setFavoriteStores(await db.getAllFavoriteStores());
        setFavoritePlaces(await db.getAllFavoritePlaces());
        setFavoriteRoutePlaces(await db.getAllFavoriteRoutePlaces());

        // Onboarding Check
        const onboardingSetting = await db.getSetting('onboardingCompleted');
        setOnboardingCompleted(onboardingSetting ? onboardingSetting.value : false);
      } catch (error) {
        console.error("Failed to load data from DB", error);
        setOnboardingCompleted(false); // Default to show onboarding on error
      } finally {
        setIsDbLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Update HTML class for dark mode
  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Geolocation
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
        setIsLocationLoading(false);
      },
      (err) => {
        setLocationError('يرجى تمكين الوصول إلى الموقع لاستخدام هذه الميزة.');
        setIsLocationLoading(false);
        console.error(err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  const handleSetApiKey = async (key: string) => {
      geminiService.initializeAiClient(key);
      await db.putSetting({ key: 'apiKey', value: key });
      setApiKey(key);
      setIsApiKeyModalOpen(false);
  };

  const handleOnboardingComplete = async () => {
      await db.putSetting({ key: 'onboardingCompleted', value: true });
      setOnboardingCompleted(true);
  };

  const handleToggleFavorite = async (activity: Activity) => {
    // FIX: Add guard clause to prevent operations if mapsLink (the keyPath) is missing.
    if (!activity.mapsLink) {
        console.warn("Attempted to favorite an activity without a mapsLink.", activity);
        return;
    }

    const isFavorited = favorites.some(fav => fav.mapsLink === activity.mapsLink);
    if (isFavorited) {
        await db.deleteFavoriteActivity(activity.mapsLink);
        setFavorites(prev => prev.filter(fav => fav.mapsLink !== activity.mapsLink));
    } else {
        await db.putFavoriteActivity(activity);
        setFavorites(prev => [...prev, activity]);
    }
  };
  
  const handleToggleFavoriteStore = async (store: StoreResult) => {
    // FIX: Add guard clause to prevent operations if mapsLink (the keyPath) is missing.
    if (!store.mapsLink) {
        console.warn("Attempted to favorite a store without a mapsLink.", store);
        return;
    }
    const isFavorited = favoriteStores.some(fav => fav.mapsLink === store.mapsLink);
    if (isFavorited) {
        await db.deleteFavoriteStore(store.mapsLink);
        setFavoriteStores(prev => prev.filter(fav => fav.mapsLink !== store.mapsLink));
    } else {
        await db.putFavoriteStore(store);
        setFavoriteStores(prev => [...prev, store]);
    }
  };

  const handleToggleFavoritePlace = async (place: Place) => {
    // FIX: Add guard clause to prevent operations if mapsLink (the keyPath) is missing.
    if (!place.mapsLink) {
        console.warn("Attempted to favorite a place without a mapsLink.", place);
        return;
    }
    const isFavorited = favoritePlaces.some(fav => fav.mapsLink === place.mapsLink);
    if (isFavorited) {
        await db.deleteFavoritePlace(place.mapsLink);
        setFavoritePlaces(prev => prev.filter(fav => fav.mapsLink !== place.mapsLink));
    } else {
        await db.putFavoritePlace(place);
        setFavoritePlaces(prev => [...prev, place]);
    }
  };

  const handleToggleFavoriteRoutePlace = async (place: RoutePlace) => {
    // FIX: Add guard clause to prevent operations if mapsLink (the keyPath) is missing.
    if (!place.mapsLink) {
        console.warn("Attempted to favorite a route place without a mapsLink.", place);
        return;
    }
    const isFavorited = favoriteRoutePlaces.some(fav => fav.mapsLink === place.mapsLink);
    if (isFavorited) {
        await db.deleteFavoriteRoutePlace(place.mapsLink);
        setFavoriteRoutePlaces(prev => prev.filter(fav => fav.mapsLink !== place.mapsLink));
    } else {
        await db.putFavoriteRoutePlace(place);
        setFavoriteRoutePlaces(prev => [...prev, place]);
    }
  };

  const toggleDarkMode = () => {
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);
    db.putSetting({ key: 'darkMode', value: newIsDarkMode });
  };

  const handleSelectTool = (tool: Tool, initialState: any = null) => {
    setInitialToolState(initialState);
    setActiveTool(tool);
  };

  const handleBack = () => {
    setActiveTool(null);
    setInitialToolState(null);
  };

  const toolComponents: Record<Tool, React.ComponentType<ToolProps>> = {
    [Tool.ProductAnalyzer]: ProductAnalyzer,
    [Tool.MenuAnalyzer]: MenuAnalyzer,
    [Tool.IngredientGuide]: IngredientGuide,
    [Tool.CityCenterFinder]: CityCenterFinder,
    [Tool.ParkMyCar]: ParkMyCar,
    [Tool.MyAccommodation]: MyAccommodation,
    [Tool.FindPlaces]: FindPlaces,
    [Tool.FindIt]: FindIt,
    [Tool.ActivitiesFinder]: ActivitiesFinder,
    [Tool.OnMyWay]: OnMyWay,
    [Tool.MySpace]: MySpace,
    [Tool.Favorites]: Favorites,
    [Tool.AskMeAnything]: AskMeAnything,
  };

  const toolTitles: Record<Tool, string> = {
    [Tool.ProductAnalyzer]: 'تحليل المنتج',
    [Tool.MenuAnalyzer]: 'تحليل القائمة',
    [Tool.IngredientGuide]: 'دليل المكونات',
    [Tool.CityCenterFinder]: 'أين قلب المدينة؟',
    [Tool.ParkMyCar]: 'أين أوقفت سيارتي؟',
    [Tool.MyAccommodation]: 'أين أسكن؟',
    [Tool.FindPlaces]: 'ابحث عن أماكن',
    [Tool.FindIt]: 'أوجدها لي',
    [Tool.ActivitiesFinder]: 'الأنشطة',
    [Tool.OnMyWay]: 'على طريقي',
    [Tool.MySpace]: 'مساحتي',
    [Tool.Favorites]: 'المفضلة',
    [Tool.AskMeAnything]: 'اسألني أي شيء',
  };

  const renderContent = () => {
    if (activeTool === null) {
      return (
        <CaptureScreen 
          onSelectTool={handleSelectTool}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          location={location}
          locationError={locationError}
        />
      );
    }

    const CurrentToolComponent = toolComponents[activeTool];

    return (
      <div className="flex flex-col h-screen">
        <Header 
          title={toolTitles[activeTool] || 'ZAD'}
          isDarkMode={isDarkMode} 
          toggleDarkMode={toggleDarkMode}
          onBack={handleBack}
          onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
        />
        <LocationInfo 
          location={location} 
          error={locationError} 
          isLoading={isLocationLoading} 
        />
        <main className="flex-grow overflow-y-auto">
          {isDbLoading ? <div className="p-8 text-center">جاري تحميل البيانات...</div> : (
            CurrentToolComponent && <CurrentToolComponent 
              location={location} 
              locationError={locationError}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              favoriteStores={favoriteStores}
              onToggleFavoriteStore={handleToggleFavoriteStore}
              favoritePlaces={favoritePlaces}
              onToggleFavoritePlace={handleToggleFavoritePlace}
              favoriteRoutePlaces={favoriteRoutePlaces}
              onToggleFavoriteRoutePlace={handleToggleFavoriteRoutePlace}
              initialState={initialToolState}
            />
          )}
        </main>
      </div>
    );
  };

  if (isKeyLoading || isDbLoading || onboardingCompleted === null) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
            <LoadingSpinner message="جاري تحميل التطبيق..." />
        </div>
    );
  }

  if (!onboardingCompleted) {
      return <Onboarding onComplete={handleOnboardingComplete} />;
  }

  if (!apiKey) {
      return <ApiKeyModal onSetApiKey={handleSetApiKey} onClose={() => {}} isClosable={false} />;
  }


  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen text-gray-900 dark:text-gray-100 font-sans">
      {renderContent()}
      {isApiKeyModalOpen && <ApiKeyModal onSetApiKey={handleSetApiKey} onClose={() => setIsApiKeyModalOpen(false)} />}
    </div>
  );
};

export default App;
