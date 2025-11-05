
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CapturedPhoto } from './CaptureScreen';
import * as geminiService from '../services/geminiService';
import { Loader2, X, Save, Brush, Check, RotateCcw, AlertTriangle, Type } from 'lucide-react';

interface ImageEditorProps {
    media: CapturedPhoto;
    onSave: (newBase64: string | null) => void;
    onCancel: () => void;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ media, onSave, onCancel }) => {
    const [originalImage, setOriginalImage] = useState(media.base64);
    const [currentImage, setCurrentImage] = useState(media.base64);
    const [history, setHistory] = useState<string[]>([media.base64]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [activeTool, setActiveTool] = useState<'none' | 'remove' | 'text'>('none');
    const [prompt, setPrompt] = useState('');
    const [showOriginal, setShowOriginal] = useState(false);

    const imageRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);

    const updateHistory = (newImage: string) => {
        setHistory(prev => [...prev, newImage]);
        setCurrentImage(newImage);
    };

    const handleUndo = () => {
        if (history.length > 1) {
            const newHistory = history.slice(0, -1);
            setHistory(newHistory);
            setCurrentImage(newHistory[newHistory.length - 1]);
        }
    };
    
    // Canvas setup
    const setupCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (canvas && image) {
            canvas.width = image.clientWidth;
            canvas.height = image.clientHeight;
        }
    }, []);

    useEffect(() => {
        window.addEventListener('resize', setupCanvas);
        return () => window.removeEventListener('resize', setupCanvas);
    }, [setupCanvas]);

    // Drawing logic
    const getCoords = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e) {
            if (e.touches.length === 0) return null;
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        if (activeTool !== 'remove') return;
        isDrawing.current = true;
        draw(e.nativeEvent);
    };

    const stopDrawing = () => {
        isDrawing.current = false;
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) ctx.beginPath(); // Reset the path
    };

    const draw = (e: MouseEvent | TouchEvent) => {
        if (!isDrawing.current) return;
        const coords = getCoords(e);
        if (!coords) return;

        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        
        ctx.lineWidth = 30;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)'; // Semi-transparent red
        
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
    };
    
    const clearCanvas = () => {
        const canvas = canvasRef.current;
        if(canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    const applyMask = async () => {
        const canvas = canvasRef.current;
        const image = imageRef.current;
        if (!canvas || !image) return;

        setIsProcessing(true);
        setError(null);
        setActiveTool('none');

        try {
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = image.naturalWidth;
            maskCanvas.height = image.naturalHeight;
            const maskCtx = maskCanvas.getContext('2d');
            if (!maskCtx) throw new Error("Could not create mask context");

            maskCtx.fillStyle = 'black';
            maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
            
            maskCtx.save();
            maskCtx.scale(image.naturalWidth / image.clientWidth, image.naturalHeight / image.clientHeight);
            maskCtx.globalCompositeOperation = 'destination-out';
            maskCtx.drawImage(canvas, 0, 0);
            maskCtx.restore();
            
            const maskBase64 = maskCanvas.toDataURL('image/png').split(',')[1];
            
            const removePrompt = "In the first image provided, remove the object or area indicated by the white region in the second image (the mask). Fill the space intelligently to match the surrounding background. The output should be only the edited image.";
            
            const result = await geminiService.editImage(currentImage, removePrompt, maskBase64);

            if (result) {
                updateHistory(result);
            } else {
                throw new Error("فشل تحرير الصورة. حاول مرة أخرى.");
            }
        } catch (err: any) {
            console.error("Error applying mask:", err);
            setError(err.message || "حدث خطأ غير متوقع.");
        } finally {
            setIsProcessing(false);
            clearCanvas();
        }
    };
    
    const handleTextEdit = async () => {
        if (!prompt.trim()) return;
        setIsProcessing(true);
        setError(null);
        setActiveTool('none');

        try {
            const result = await geminiService.editImage(currentImage, prompt);
            if (result) {
                updateHistory(result);
            } else {
                throw new Error("فشل تحرير الصورة. حاول مرة أخرى.");
            }
        } catch (err: any) {
            setError(err.message || "حدث خطأ غير متوقع.");
        } finally {
            setIsProcessing(false);
            setPrompt('');
        }
    };

    const currentImageUrl = `data:image/jpeg;base64,${currentImage}`;
    const originalImageUrl = `data:image/jpeg;base64,${originalImage}`;
    
    return (
        <div className="absolute inset-0 bg-gray-900 z-30 flex flex-col animate-fade-in">
            {isProcessing && <div className="absolute inset-0 bg-black/70 z-50 flex flex-col items-center justify-center"><Loader2 className="animate-spin mb-4" size={48} /><p>جاري المعالجة بالذكاء الاصطناعي...</p></div>}
            
             <header className="flex-shrink-0 p-4 flex justify-between items-center bg-gray-900/50 backdrop-blur-sm z-10">
                <button onClick={onCancel} className="p-2 rounded-full hover:bg-white/10"><X /></button>
                <h2 className="text-xl font-bold">استوديو التحرير</h2>
                <button onClick={() => onSave(currentImage)} className="p-2 rounded-full hover:bg-white/10" disabled={isProcessing}><Save /></button>
            </header>
            
            {error && 
                <div className="p-3 m-4 bg-red-900/50 text-red-300 rounded-lg text-center flex items-center justify-center gap-2 z-10">
                    <AlertTriangle size={18}/> {error}
                </div>
            }

            <main className="flex-grow flex items-center justify-center min-h-0 p-4">
                 <div
                    className="relative w-full h-full"
                    onMouseDown={() => setShowOriginal(true)}
                    onMouseUp={() => setShowOriginal(false)}
                    onTouchStart={() => setShowOriginal(true)}
                    onTouchEnd={() => setShowOriginal(false)}
                >
                    <img
                        ref={imageRef}
                        src={showOriginal ? originalImageUrl : currentImageUrl}
                        alt="Image for editing"
                        className="w-full h-full object-contain"
                        onLoad={setupCanvas}
                    />
                    {activeTool === 'remove' && (
                         <canvas
                            ref={canvasRef}
                            className="absolute top-0 left-0 w-full h-full cursor-crosshair"
                            onMouseDown={startDrawing}
                            onMouseUp={stopDrawing}
                            onMouseOut={stopDrawing}
                            onMouseMove={(e) => draw(e.nativeEvent)}
                            onTouchStart={startDrawing}
                            onTouchEnd={stopDrawing}
                            onTouchMove={(e) => draw(e.nativeEvent)}
                        />
                    )}
                     <div className={`absolute inset-0 flex items-center justify-center text-white text-xl font-bold bg-black/50 transition-opacity duration-300 ${showOriginal ? 'opacity-100' : 'opacity-0'}`}>
                        الأصلية
                    </div>
                </div>
            </main>

            <footer className="flex-shrink-0 p-4 bg-gray-900/50 backdrop-blur-sm z-10">
                {activeTool === 'none' && (
                     <div className="flex justify-around items-center">
                         <button onClick={() => setActiveTool('remove')} className="flex flex-col items-center gap-1 text-white disabled:opacity-50" disabled={isProcessing}>
                            <Brush size={28}/>
                            <span>إزالة عنصر</span>
                         </button>
                         <button onClick={() => setActiveTool('text')} className="flex flex-col items-center gap-1 text-white disabled:opacity-50" disabled={isProcessing}>
                            <Type size={28}/>
                            <span>تعديل بالنص</span>
                         </button>
                         <button onClick={handleUndo} className="flex flex-col items-center gap-1 text-white disabled:opacity-50" disabled={isProcessing || history.length <= 1}>
                            <RotateCcw size={28}/>
                            <span>تراجع</span>
                        </button>
                    </div>
                )}
                {activeTool === 'remove' && (
                    <div className="flex justify-around items-center">
                        <button onClick={() => { setActiveTool('none'); clearCanvas(); }} className="flex flex-col items-center gap-1 text-white"><X size={28}/><span>إلغاء</span></button>
                        <button onClick={applyMask} className="flex flex-col items-center gap-1 text-teal-300"><Check size={28}/><span>تطبيق</span></button>
                    </div>
                )}
                {activeTool === 'text' && (
                    <div className="w-full flex flex-col gap-3">
                        <input 
                            type="text" 
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            placeholder="اكتب طلبك... (مثال: اجعل السماء زرقاء)"
                            className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-primary focus:border-transparent"
                            autoFocus
                        />
                        <div className="flex justify-around items-center">
                            <button onClick={() => { setActiveTool('none'); setPrompt(''); }} className="flex flex-col items-center gap-1 text-white"><X size={28}/><span>إلغاء</span></button>
                            <button onClick={handleTextEdit} disabled={!prompt.trim() || isProcessing} className="flex flex-col items-center gap-1 text-teal-300 disabled:opacity-50"><Check size={28}/><span>تطبيق</span></button>
                        </div>
                    </div>
                )}
            </footer>
        </div>
    );
};

export default ImageEditor;
