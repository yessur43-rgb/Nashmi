import React, { useState } from 'react';
import ImageInput from './common/ImageInput';
import LoadingSpinner from './common/LoadingSpinner';
import * as geminiService from '../services/geminiService';
import { fileToBase64, getStatusColor, getStatusRingColor } from '../utils/helpers';
import { ProductAnalysis } from '../types';
import { ShieldCheck, ShieldAlert, ShieldX, ClipboardList, BrainCircuit, BookCheck, Calculator, HeartPulse } from 'lucide-react';

const ProductAnalyzer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleImageAnalysis = async (file: File) => {
    setLoading(true);
    setAnalysis(null);
    setError(null);
    try {
      const base64Image = await fileToBase64(file);
      const result = await geminiService.analyzeProductImage(base64Image);
      if (result) {
        setAnalysis(result);
      } else {
        setError('لم نتمكن من تحليل المنتج. حاول مرة أخرى.');
      }
    } catch (err) {
      setError('حدث خطأ أثناء معالجة الصورة.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleBarcodeAnalysis = async (barcode: string) => {
    setLoading(true);
    setAnalysis(null);
    setError(null);
    try {
      const result = await geminiService.analyzeProductByBarcode(barcode);
      if (result) {
        setAnalysis(result);
      } else {
        setError(`لم نتمكن من العثور على معلومات للمنتج بالباركود: ${barcode}.`);
      }
    } catch (err) {
      setError('حدث خطأ أثناء تحليل الباركود.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = ({ status }: { status: ProductAnalysis['status'] }) => {
    switch (status) {
      case 'حلال': return <ShieldCheck className="w-8 h-8 text-green-500" />;
      case 'حرام': return <ShieldX className="w-8 h-8 text-red-500" />;
      case 'مشبوه': return <ShieldAlert className="w-8 h-8 text-yellow-500" />;
      default: return null;
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <ImageInput 
        onImageSelect={handleImageAnalysis} 
        onBarcodeScan={handleBarcodeAnalysis}
        disabled={loading} 
      />
      
      {loading && <LoadingSpinner message="جاري التحليل بالذكاء الاصطناعي..." />}
      
      {error && <div className="p-4 bg-red-100 text-red-700 rounded-lg text-center">{error}</div>}
      
      {analysis && (
        <div className="space-y-6 animate-fade-in">
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

          {analysis.nutritionFacts && analysis.nutritionFacts.length > 0 && (
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md space-y-4">
              <div className="flex items-center gap-3 text-lg font-bold text-gray-700 dark:text-gray-200"><Calculator/><h3>الحقائق الغذائية</h3></div>
              <ul className="space-y-2 text-sm">
                {analysis.nutritionFacts.map((fact, index) => (
                  <li key={index} className="flex justify-between items-center p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                    <span className="font-semibold text-gray-800 dark:text-gray-100">{fact.name}</span>
                    <span className="font-mono text-gray-600 dark:text-gray-300">
                      {fact.amount}
                      {fact.dailyValue && <span className="ml-2 text-gray-500 dark:text-gray-400">({fact.dailyValue})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.healthAdvice && (
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md space-y-2">
               <div className="flex items-center gap-3 text-lg font-bold text-gray-700 dark:text-gray-200"><HeartPulse/><h3>نصيحة صحية</h3></div>
              <p className="text-gray-600 dark:text-gray-300">{analysis.healthAdvice}</p>
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md space-y-2">
             <div className="flex items-center gap-3 text-lg font-bold text-gray-700 dark:text-gray-200"><BrainCircuit/><h3>أساس التحليل</h3></div>
            <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{analysis.reasoning}</p>
          </div>
          
          {analysis.evidence && (
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-md space-y-2">
               <div className="flex items-center gap-3 text-lg font-bold text-gray-700 dark:text-gray-200"><BookCheck/><h3>الأدلة الشرعية</h3></div>
              <p className="text-gray-600 dark:text-gray-300">{analysis.evidence}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductAnalyzer;