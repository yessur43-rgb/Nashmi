

import React, { useState } from 'react';
import { Mic, Check, Loader2 } from 'lucide-react';
import AudioRecorder from './AudioRecorder';
import * as geminiService from '../../services/geminiService';
import { blobToBase64 } from '../../utils/helpers';

interface QuickAudioModalProps {
    onClose: () => void;
    onAudioAnalyzed: (analysis: any) => Promise<void>;
}

const QuickAudioModal: React.FC<QuickAudioModalProps> = ({ onClose, onAudioAnalyzed }) => {
    const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'done'>('idle');

    const handleRecordingComplete = async (audioBlob: Blob) => {
        setStatus('processing');
        try {
            const base64 = await blobToBase64(audioBlob);
            const mimeType = audioBlob.type || 'audio/webm';
            const analysis = await geminiService.analyzeAudioForJournal(base64, mimeType);

            if (analysis) {
                await onAudioAnalyzed(analysis);
                setStatus('done');
                setTimeout(() => onClose(), 1500); // Close after showing success message
            } else {
                // Handle analysis failure
                setStatus('idle');
                alert('لم نتمكن من تحليل التسجيل الصوتي.');
            }
        } catch (error) {
            console.error("Error in audio processing pipeline:", error);
            setStatus('idle');
            alert('حدث خطأ أثناء معالجة الصوت.');
        }
    };
    
    let content;
    switch (status) {
        case 'processing':
            content = (
                <>
                    <Loader2 className="w-16 h-16 text-primary animate-spin" />
                    <h3 className="text-xl font-bold mt-4">جاري تحليل الصوت...</h3>
                </>
            );
            break;
        case 'done':
            content = (
                <>
                    <Check className="w-16 h-16 text-green-500" />
                    <h3 className="text-xl font-bold mt-4">تم الحفظ بنجاح!</h3>
                </>
            );
            break;
        default:
            content = (
                <>
                    <Mic className="w-16 h-16 text-primary" />
                    <h3 className="text-xl font-bold mt-4">سجل ملاحظة أو مصروف</h3>
                    <p className="text-gray-400 text-center mt-2">
                        قل "اشتريت قهوة بـ 5 فرنك" لتسجيل مصروف، أو تحدث بحرية لتسجيل ملاحظة.
                    </p>
                    <div className="mt-8">
                        <AudioRecorder onRecordingComplete={handleRecordingComplete} />
                    </div>
                </>
            );
    }


    return (
        <div 
            className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4 animate-fade-in"
            onClick={onClose}
        >
            <div 
                className="bg-gray-800 text-white rounded-2xl shadow-xl w-full max-w-sm p-8 flex flex-col items-center justify-center"
                onClick={e => e.stopPropagation()}
            >
                {content}
            </div>
        </div>
    );
};

export default QuickAudioModal;