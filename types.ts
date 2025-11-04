export enum Tool {
    FindPlaces = 'FindPlaces',
    ProductAnalyzer = 'ProductAnalyzer',
    MenuAnalyzer = 'MenuAnalyzer',
    FindIt = 'FindIt',
    OnMyWay = 'OnMyWay',
    ActivitiesFinder = 'ActivitiesFinder',
    CityCenterFinder = 'CityCenterFinder',
    ParkMyCar = 'ParkMyCar',
    MyAccommodation = 'MyAccommodation',
    IngredientGuide = 'IngredientGuide',
    MySpace = 'MySpace',
    Favorites = 'Favorites',
    AskMeAnything = 'AskMeAnything',
}

export interface Ingredient {
    name: string;
    status: 'حلال' | 'حرام' | 'مشبوه';
}

export interface NutritionFact {
    name: string;
    amount: string;
    dailyValue?: string;
}

export interface ProductAnalysis {
    status: 'حلال' | 'حرام' | 'مشبوه';
    productName: string;
    ingredients: Ingredient[];
    reasoning: string;
    healthInfo?: string;
    evidence?: string;
    nutritionFacts?: NutritionFact[];
    healthAdvice?: string;
}

export interface MenuItem {
    dishName: string;
    status: 'حلال' | 'حرام' | 'مشبوه';
    notes?: string;
}

export interface Place {
    name: string;
    category: string;
    rating?: number;
    distance: string;
    mapsLink: string;
}

export interface StoreResult {
    type: 'store';
    name: string;
    address: string;
    distance: string;
    details: string;
    mapsLink: string;
}

export interface ProductResult {
    type: 'product';
    name: string;
    availability: string;
    details: string;
}

export type FindItResult = StoreResult | ProductResult;


export interface FindItImagePlaceResult {
    type: "place";
    name: string;
    description: string;
    mapsLink: string;
}

export interface FindItImageProductResult {
    type: "product";
    name: string;
    description: string;
    availability: string;
}

export type FindItImageResult = FindItImagePlaceResult | FindItImageProductResult;


export interface Activity {
    name: string;
    description: string;
    category: string;
    suitability: string;
    estimatedCost: string;
    distance: string;
    mapsLink: string;
}

export interface RoutePlace {
    name: string;
    category: string;
    details: string;
    detour: string;
    detourInKm: number;
    distanceFromStart: string;
    mapsLink: string;
}

export interface IngredientInfo {
    name: string;
    status: 'حلال' | 'حرام' | 'مشبوه' | 'معلومات';
    source: string;
    description: string;
    reasoning: string;
}

export interface PopularSpot {
    name: string;
    type: "مطعم" | "مقهى";
    description: string;
}

export interface CityCenterInfo {
    name: string;
    description: string;
    lat: number;
    lon: number;
    popularSpots: PopularSpot[];
    mapsLink: string;
    distance?: string;
}

export interface JournalPhoto {
    id: string;
    base64: string;
    description?: string;
    lat?: number;
    lon?: number;
}

export interface JournalVideo {
    id: string;
    base64: string;
    mimeType: string;
    description?: string;
    lat?: number;
    lon?: number;
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    currency: string;
    amountInSAR: number;
    photos?: JournalPhoto[];
}

export interface JournalEntry {
    id: string;
    date: string;
    title: string;
    notes: string;
    photos: JournalPhoto[];
    videos: JournalVideo[];
    expenses: Expense[];
}

export interface Trip {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    entries: JournalEntry[];
    exportedStoryHtml?: string;
}

export interface ParkingLot {
  name: string;
  distance: string;
  parkingType: 'بالساعة' | 'تدفع عند الخروج' | 'مجاني' | 'غير معروف';
  details: string;
  mapsLink: string;
}

export interface AccommodationInfo {
    id: string;
    name: string;
    photoBase64?: string;
    location: { lat: number; lon: number };
    timestamp: number;
}

export interface ParkingInfo {
    photoBase64: string;
    description: string;
    location: { lat: number; lon: number };
    timestamp: number;
}