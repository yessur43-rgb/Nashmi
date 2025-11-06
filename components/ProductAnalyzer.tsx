import React, { useState } from 'react';
import ImageInput from './common/ImageInput';
import LoadingSpinner from './common/LoadingSpinner';
import * as geminiService from '../services/geminiService';
import { fileToBase64, getStatusColor, getStatusRingColor } from '../utils/helpers';
import { ProductAnalysis } from '../types';
import { ShieldCheck, ShieldAlert, ShieldX, ClipboardList, BrainCircuit, BookCheck, Calculator, HeartPulse, ChevronDown } from 'lucide-react';

const AccordionItem: React.FC<{
  title: string;
  icon: React.ReactElement;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, icon, isOpen, onToggle, children }) => {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden transition-all duration-300 shadow-sm">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          {React.cloneElement(icon, { className: "w-6 h-6 text-primary dark:text-primary-light" })}
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">{title}</h3>
        </div>
        <ChevronDown
          className={`w-6 h-6 text-gray-500 dark:text-gray-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="p-4 bg-white dark:bg-gray-900/50">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};


const ProductAnalyzer: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<ProductAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openAccordion, setOpenAccordion] = useState<string | null>('ingredients');

  const handleAccordionToggle = (id: string) => {
    setOpenAccordion(prev => (prev === id ? null : id));
  };
  
  const handleImageAnalysis = async (file: File) => {
    setLoading(true);
    setAnalysis(null);
    setError(null);
    try {
      const base64Image = await fileToBase64(file);
      const result = await geminiService.analyzeProductImage(base64Image);
      if (result) {
        setAnalysis(result);
        setOpenAccordion('ingredients'); // Default to open ingredients
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
        setOpenAccordion('ingredients'); // Default to open ingredients
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
      case 'حلال': return <ShieldCheck className="w-10 h-10 text-green-500" />;
      case 'حرام': return <ShieldX className="w-10 h-10 text-red-500" />;
      case 'مشبوه': return <ShieldAlert className="w-10 h-10 text-yellow-500" />;
      default: return null;
    }
  };

  const getStatusGradient = (status: ProductAnalysis['status']) => {
    switch (status) {
      case 'حلال': return 'from-green-50 to-green-100 dark:from-green-900/50 dark:to-green-900/80 border-green-200 dark:border-green-700';
      case 'حرام': return 'from-red-50 to-red-100 dark:from-red-900/50 dark:to-red-900/80 border-red-200 dark:border-red-700';
      case 'مشبوه': return 'from-yellow-50 to-yellow-100 dark:from-yellow-900/50 dark:to-yellow-900/80 border-yellow-200 dark:border-yellow-700';
      default: return 'from-gray-50 to-gray-100 dark:from-gray-900/50 dark:to-gray-900/80 border-gray-200 dark:border-gray-700';
    }
  };

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
        <div className="space-y-4 animate-fade-in">
          <div className={`p-6 rounded-2xl border bg-gradient-to-br shadow-lg ${getStatusGradient(analysis.status)}`}>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full bg-white/60 dark:bg-gray-800/60 ring-4 ${getStatusRingColor(analysis.status)}`}>
                <StatusIcon status={analysis.status} />
              </div>
              <div className="flex-grow">
                <h2 className="text-2xl lg:text-3xl font-bold">{analysis.productName}</h2>
                <p className="text-3xl lg:text-4xl font-extrabold">{analysis.status}</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
             <AccordionItem
                title="قائمة المكونات"
                icon={<ClipboardList />}
                isOpen={openAccordion === 'ingredients'}
                onToggle={() => handleAccordionToggle('ingredients')}
             >
                <ul className="space-y-2">
                  {analysis.ingredients.map((ing, index) => (
                    <li key={index} className={`flex justify-between items-center p-3 rounded-lg ${getStatusColor(ing.status)}`}>
                      <span className="font-medium">{ing.name}</span>
                      <span className="font-bold px-2.5 py-1 text-xs rounded-full">{ing.status}</span>
                    </li>
                  ))}
                </ul>
             </AccordionItem>
             
             {(analysis.nutritionFacts && analysis.nutritionFacts.length > 0) || analysis.healthAdvice ? (
                <AccordionItem
                    title="الحقائق الغذائية والنصائح"
                    icon={<HeartPulse />}
                    isOpen={openAccordion === 'nutrition'}
                    onToggle={() => handleAccordionToggle('nutrition')}
                >
                    <div className="space-y-4">
                        {analysis.nutritionFacts && analysis.nutritionFacts.length > 0 && (
                            <div>
                                <h4 className="flex items-center gap-2 text-md font-bold text-gray-700 dark:text-gray-200 mb-2"><Calculator size={18}/><span>الحقائق الغذائية</span></h4>
                                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                                    {analysis.nutritionFacts.map((fact, index) => (
                                    <li key={index} className="flex items-center justify-between py-2">
                                        <span className="font-semibold text-gray-800 dark:text-gray-100">{fact.name}</span>
                                        <div className="text-right">
                                            <span className="font-mono text-gray-700 dark:text-gray-200">{fact.amount}</span>
                                            {fact.dailyValue && <span className="block text-xs font-mono text-gray-500 dark:text-gray-400">{fact.dailyValue}</span>}
                                        </div>
                                    </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {analysis.healthAdvice && (
                           <div>
                                <h4 className="flex items-center gap-2 text-md font-bold text-gray-700 dark:text-gray-200 mb-2"><HeartPulse size={18}/><span>نصيحة صحية</span></h4>
                                <p className="text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg">{analysis.healthAdvice}</p>
                           </div>
                        )}
                    </div>
                </AccordionItem>
             ) : null}

             {analysis.reasoning || analysis.evidence ? (
                <AccordionItem
                    title="أساس التحليل والأدلة"
                    icon={<BrainCircuit />}
                    isOpen={openAccordion === 'reasoning'}
                    onToggle={() => handleAccordionToggle('reasoning')}
                >
                    <div className="space-y-4">
                        {analysis.reasoning && (
                            <div>
                                <h4 className="flex items-center gap-2 text-md font-bold text-gray-700 dark:text-gray-200 mb-2"><BrainCircuit size={18}/><span>أساس التحليل</span></h4>
                                <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{analysis.reasoning}</p>
                            </div>
                        )}
                         {analysis.evidence && (
                           <div>
                                <h4 className="flex items-center gap-2 text-md font-bold text-gray-700 dark:text-gray-200 mb-2"><BookCheck size={18}/><span>الأدلة الشرعية</span></h4>
                                <p className="text-gray-600 dark:text-gray-300">{analysis.evidence}</p>
                           </div>
                        )}
                    </div>
                </AccordionItem>
             ): null}

          </div>
        </div>
      )}
    </div>
  );
};

export default ProductAnalyzer;
