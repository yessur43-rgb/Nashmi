import React, { useState } from 'react';
import LoadingSpinner from './common/LoadingSpinner';
import * as geminiService from '../services/geminiService';
import { IngredientInfo } from '../types';
import { getStatusColor, getStatusRingColor } from '../utils/helpers';
import { FlaskConical, Search, ShieldCheck, ShieldAlert, ShieldX, Info, TestTube2, BrainCircuit, BookOpenText } from 'lucide-react';

const StatusIcon = ({ status }: { status: IngredientInfo['status'] }) => {
    switch (status) {
      case 'حلال': return <ShieldCheck className="w-8 h-8 text-green-500" />;
      case 'حرام': return <ShieldX className="w-8 h-8 text-red-500" />;
      case 'مشبوه': return <ShieldAlert className="w-8 h-8 text-yellow-500" />;
      default: return <Info className="w-8 h-8 text-blue-500" />;
    }
};

const getInfoStatusColor = (status: IngredientInfo['status']) => {
    if (status === 'معلومات') {
        return 'bg-blue-100 text-blue-800 border-blue-400';
    }
    return getStatusColor(status);
};

const getInfoStatusRingColor = (status: IngredientInfo['status']) => {
    if (status === 'معلومات') {
        return 'ring-blue-500';
    }
    return getStatusRingColor(status);
};


const IngredientGuide: React.FC = () => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<IngredientInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSearch = async (searchTerm: string) => {
        if (!searchTerm.trim()) return;

        setLoading(true);
        setResult(null);
        setError(null);
        setQuery(searchTerm); // Update input field with the search term

        try {
            const response = await geminiService.getIngredientInfo(searchTerm);
            if (response) {
                setResult(response);
            } else {
                setError('لم نتمكن من العثور على معلومات حول هذا المكون.');
            }
        } catch (err) {
            setError('حدث خطأ أثناء البحث عن المكون.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleSearch(query);
    };

    const quickSearches = ['جيلاتين', 'E120 (كارمين)', 'مصل اللبن', 'E471', 'جليسرين'];

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="text-center p-6 bg-primary-light dark:bg-primary-dark rounded-xl shadow-lg">
                <FlaskConical className="mx-auto w-12 h-12 text-white mb-2" />
                <h2 className="text-2xl font-bold text-white">دليل المكونات</h2>
                <p className="text-white/80">ابحث عن E-numbers أو أسماء المكونات</p>
            </div>
            
            <div className="flex flex-wrap gap-2 justify-center">
                 {quickSearches.map(term => (
                     <button 
                        key={term} 
                        onClick={() => handleSearch(term)} 
                        disabled={loading} 
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-full font-semibold shadow-sm hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 text-sm"
                    >
                        {term}
                    </button>
                 ))}
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="مثال: E471، جيلاتين..."
                    className="flex-grow p-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:text-white"
                    disabled={loading}
                />
                <button
                    type="submit"
                    className="p-3 bg-primary text-white rounded-lg font-semibold shadow-md hover:bg-primary-dark transition-colors disabled:opacity-50"
                    disabled={loading || !query.trim()}
                >
                    <Search />
                </button>
            </form>

            {loading && <LoadingSpinner message="جاري البحث..." />}
            
            {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center">{error}</div>}
            
            {result && (
                <div className="space-y-4 animate-fade-in">
                    <div className={`p-6 rounded-xl border-2 shadow-lg ${getInfoStatusColor(result.status)}`}>
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-full bg-white dark:bg-gray-800 ring-4 ${getInfoStatusRingColor(result.status)}`}>
                                <StatusIcon status={result.status} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">{result.name}</h2>
                                <p className="text-3xl font-extrabold">{result.status}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md space-y-2">
                         <div className="flex items-center gap-3 text-lg font-bold text-gray-700 dark:text-gray-200"><TestTube2/><h3>المصدر</h3></div>
                        <p className="text-gray-600 dark:text-gray-300">{result.source}</p>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md space-y-2">
                        <div className="flex items-center gap-3 text-lg font-bold text-gray-700 dark:text-gray-200"><BookOpenText/><h3>الوصف</h3></div>
                        <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{result.description}</p>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md space-y-2">
                         <div className="flex items-center gap-3 text-lg font-bold text-gray-700 dark:text-gray-200"><BrainCircuit/><h3>سبب الحكم</h3></div>
                        <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{result.reasoning}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default IngredientGuide;
