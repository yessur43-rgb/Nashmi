import React, { useState } from 'react';
import * as geminiService from '../services/geminiService';
import { FindItResult, StoreResult, ProductResult, FindItImageResult, ProductAnalysis } from '../types';
import SkeletonCard from './common/SkeletonCard';
import LoadingSpinner from './common/LoadingSpinner';
import ImageInput from './common/ImageInput';
import StoreCard from './common/StoreCard';
import { fileToBase64, parseDistance, getStatusColor, getStatusRingColor } from '../utils/helpers';
import { Search, MapPin, Package, Store, AlertTriangle, Heart, ShieldCheck, ShieldAlert, ShieldX, ClipboardList, BrainCircuit, BookCheck, Calculator, HeartPulse, X, CheckSquare } from 'lucide-react';

interface FindItProps {
    location: { lat: number; lon: number } | null;
    locationError: string | null;
    favoriteStores?: StoreResult[];
    onToggleFavoriteStore?: (store: StoreResult) => void;
}

const ProductCard: React.FC<{ item: ProductResult, onCheckStatus: (item: ProductResult) => void }> = ({ item, onCheckStatus }) => (
     <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md flex flex-col items-start gap-4">
        <div className="w-full flex items-start gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-300 rounded-full">
                <Package size={24} />
            </div>
            <div className="flex-grow">
                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{item.name}</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400"><span className="font-semibold">التوفر:</span> {item.availability}</p>
                <p className="mt-2 text-gray-600 dark:text-gray-300">{item.details}</p>
            </div>
        </div>
        <button
            onClick={() => onCheckStatus(item)}
            className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-2 bg-teal-500 text-white rounded-lg font-semibold shadow-md hover:bg-teal-600 transition-colors"
        >
            <CheckSquare size={20} />
            <span>تحقق من الحالة</span>
        </button>
    </div>
);

const AnalysisResultModal: React.FC<{ analysis: ProductAnalysis, onClose: () => void }> = ({ analysis, onClose }) => {
    const StatusIcon = ({ status }: { status: ProductAnalysis['status'] }) => {
        switch (status) {
          case 'حلال': return <ShieldCheck className="w-8 h-8 text-green-500" />;
          case 'حرام': return <ShieldX className="w-8 h-8 text-red-500" />;
          case 'مشبوه': return <ShieldAlert className="w-8 h-8 text-yellow-500" />;
          default: return null;
        }
    };
    return (
        <div className="fixed inset-0 bg-black/60 z-30 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 p-4 border-b dark:border-gray-700 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold">نتيجة تحليل المنتج</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                        <X />
                    </button>
                </div>
                <div className="p-4 space-y-4">
                    <div className={`p-6 rounded-xl border-2 shadow-lg ${getStatusColor(analysis.status)}`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full bg-white dark:bg-gray-800 ring-4 ${getStatusRingColor(analysis.status)}`}>
                                <StatusIcon status={analysis.status} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">{analysis.productName}</h2>
                                <p className="text-3xl font-extrabold">{analysis.status}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md space-y-4">
                        <div className="flex items-center gap-3 text-lg font-bold text-gray-700 dark:text-gray-200"><ClipboardList/><h3>قائمة المكونات</h3></div>
                        <ul className="space-y-2">
                            {analysis.ingredients.map((ing, index) => (
                                <li key={index} className={`flex justify-between items-center p-3 rounded-lg ${getStatusColor(ing.status)}`}>
                                <span>{ing.name}</span>
                                <span className="font-semibold px-2 py-1 text-sm rounded-full">{ing.status}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    {analysis.reasoning && (
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md space-y-2">
                            <div className="flex items-center gap-3 text-lg font-bold text-gray-700 dark:text-gray-200"><BrainCircuit/><h3>أساس التحليل</h3></div>
                            <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{analysis.reasoning}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const FindIt: React.FC<FindItProps> = ({ location, locationError, favoriteStores = [], onToggleFavoriteStore = () => {} }) => {
    const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');

    // Text search state
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<FindItResult[] | null>(null);

    // Image search state
    const [isImageSearching, setIsImageSearching] = useState(false);
    const [imageError, setImageError] = useState<string | null>(null);
    const [imageResult, setImageResult] = useState<FindItImageResult | null>(null);
    
    // On-demand analysis state
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<ProductAnalysis | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);

    const executeTextSearch = async (searchQuery: string) => {
        if (!location) {
            setError(locationError || 'لا يمكن البحث بدون تحديد الموقع.');
            return;
        }
        if (!searchQuery.trim()) return;

        setIsSearching(true);
        setResults(null);
        setError(null);
        setImageResult(null);

        try {
            const response = await geminiService.findItForMe(searchQuery, location);
            if (response && Array.isArray(response) && response.length > 0) {
                 const stores = response.filter(r => r.type === 'store') as StoreResult[];
                 const products = response.filter(r => r.type === 'product');
                 const sortedStores = stores.sort((a,b) => parseDistance(a.distance) - parseDistance(b.distance));
                 setResults([...sortedStores, ...products]);
            } else {
                setError("لم نتمكن من العثور على ما تبحث عنه. حاول البحث بكلمات مختلفة.");
                setResults([]);
            }
        } catch (err) {
            setError('حدث خطأ أثناء البحث.');
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };
    
    const handleTextSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        executeTextSearch(query);
    };

    const handleImageSearch = async (file: File) => {
        if (!location) {
            setImageError(locationError || 'لا يمكن البحث بدون تحديد الموقع.');
            return;
        }

        setIsImageSearching(true);
        setImageResult(null);
        setImageError(null);
        setActiveTab('image');

        try {
            const base64Image = await fileToBase64(file);
            const response = await geminiService.findItByImage(base64Image, location);
            if (response) {
                setImageResult(response);
            } else {
                setImageError("لم نتمكن من تحليل الصورة. حاول مرة أخرى بصورة أوضح.");
            }
        } catch (err) {
            setImageError('حدث خطأ أثناء معالجة الصورة.');
            console.error(err);
        } finally {
            setIsImageSearching(false);
        }
    };
    
    const handleCheckStatus = async (product: ProductResult) => {
        setIsAnalyzing(true);
        setAnalysisResult(null);
        setAnalysisError(null);
        try {
            const result = await geminiService.analyzeProductByName(product.name);
            if (result) {
                setAnalysisResult(result);
            } else {
                setAnalysisError(`لم نتمكن من تحليل المنتج "${product.name}". قد لا تكون المعلومات متوفرة عبر الإنترنت.`);
            }
        } catch (error) {
            setAnalysisError("حدث خطأ أثناء تحليل المنتج.");
            console.error(error);
        } finally {
            setIsAnalyzing(false);
        }
    };


    const handleFindProductNearby = async () => {
        if (!imageResult || imageResult.type !== 'product' || !imageResult.name) return;

        const productName = imageResult.name;
        
        setActiveTab('text');
        setQuery(productName);
        
        await executeTextSearch(productName);
    };

    return (
        <div className="p-4 md:p-6 space-y-6">
            {isAnalyzing && <LoadingSpinner message="جاري تحليل المنتج..." />}
            {analysisResult && <AnalysisResultModal analysis={analysisResult} onClose={() => setAnalysisResult(null)} />}
            {analysisError && <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center flex items-center justify-center gap-2"> <AlertTriangle /> {analysisError} </div>}

            <div className="text-center p-6 bg-purple-500 dark:bg-purple-800/50 rounded-xl shadow-lg">
                <Search className="mx-auto w-12 h-12 text-white mb-2" />
                <h2 className="text-2xl font-bold text-white">أوجدها لي</h2>
                <p className="text-white/80">ابحث عن منتجات أو متاجر تبيعها بالقرب منك</p>
            </div>
            
            <div className="flex border-b border-gray-300 dark:border-gray-600 mb-4 justify-center">
                <button
                    onClick={() => setActiveTab('text')}
                    className={`px-6 py-3 font-semibold text-lg transition-colors duration-200 ${activeTab === 'text' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light'}`}
                >
                    بحث بالنص
                </button>
                <button
                    onClick={() => setActiveTab('image')}
                    className={`px-6 py-3 font-semibold text-lg transition-colors duration-200 ${activeTab === 'image' ? 'border-b-2 border-primary text-primary' : 'text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light'}`}
                >
                    بحث بالصورة
                </button>
            </div>

            {activeTab === 'text' && (
                <div className="space-y-6 animate-fade-in">
                    <form onSubmit={handleTextSubmit} className="flex gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="مثال: جبنة موزاريلا، كوكا كولا..."
                            className="flex-grow p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                            disabled={isSearching || !location}
                        />
                        <button
                            type="submit"
                            className="p-3 bg-primary text-white rounded-lg font-semibold shadow-md hover:bg-primary-dark transition-colors disabled:opacity-50"
                            disabled={isSearching || !location || !query.trim()}
                        >
                            <Search />
                        </button>
                    </form>

                    {isSearching && (
                        <div className="space-y-4">
                            <SkeletonCard />
                            <SkeletonCard />
                        </div>
                    )}

                    {error &&
                        <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center flex items-center justify-center gap-2">
                            <AlertTriangle /> {error}
                        </div>
                    }

                    {results && (
                        <div className="space-y-4">
                            {results.length > 0 ? (
                                results.map((item, index) => {
                                    if (item.type === 'store') {
                                        const storeItem = item as StoreResult;
                                        const isFavorite = favoriteStores.some(fav => fav.mapsLink && fav.mapsLink === storeItem.mapsLink);
                                        return <StoreCard key={index} item={storeItem} isFavorite={isFavorite} onToggleFavorite={onToggleFavoriteStore} />;
                                    }
                                    if (item.type === 'product') {
                                        return <ProductCard key={index} item={item as ProductResult} onCheckStatus={handleCheckStatus} />;
                                    }
                                    return null;
                                })
                            ) : (
                                <div className="p-4 bg-yellow-100 text-yellow-700 rounded-lg text-center">
                                   لم يتم العثور على نتائج.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'image' && (
                <div className="space-y-6 animate-fade-in">
                    <ImageInput onImageSelect={handleImageSearch} disabled={isImageSearching || !location} />
                    
                    {isImageSearching && <LoadingSpinner message="جاري تحليل الصورة..." />}
                    
                    {imageError && 
                        <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center flex items-center justify-center gap-2">
                            <AlertTriangle /> {imageError}
                        </div>
                    }
                    
                    {imageResult && (
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-lg flex flex-col items-start gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-full">
                                    {imageResult.type === 'place' ? <Store size={24} /> : <Package size={24} />}
                                </div>
                                <h3 className="font-bold text-xl text-gray-800 dark:text-gray-100">{imageResult.name}</h3>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 text-base">{imageResult.description}</p>
                            
                            {imageResult.type === 'place' && imageResult.mapsLink && (
                                <a 
                                    href={imageResult.mapsLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-white rounded-lg font-semibold shadow-md hover:bg-primary-dark transition-colors"
                                >
                                    <MapPin size={20} />
                                    <span>عرض على الخريطة</span>
                                </a>
                            )}

                            {imageResult.type === 'product' && 
                                <>
                                    {imageResult.availability && (
                                        <div className="w-full mt-2 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                                             <p className="text-sm text-gray-800 dark:text-gray-200">
                                                <span className="font-semibold">أماكن التوفر (بشكل عام):</span> {imageResult.availability}
                                             </p>
                                        </div>
                                    )}
                                    <button 
                                        onClick={handleFindProductNearby}
                                        disabled={isSearching}
                                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-secondary text-gray-900 rounded-lg font-semibold shadow-md hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Search size={20} />
                                        <span>ابحث عن المنتج بالقرب منك</span>
                                    </button>
                                </>
                            }
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FindIt;