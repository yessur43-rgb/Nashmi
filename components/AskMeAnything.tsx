import React, { useState, useEffect, useRef } from 'react';
import LoadingSpinner from './common/LoadingSpinner';
import * as geminiService from '../services/geminiService';
import { compressImageAndConvertToBase64 } from '../utils/helpers';
import { BrainCircuit, Send, AlertTriangle, Camera, ImageUp, X, Mic, RefreshCw, User, Sparkles } from 'lucide-react';
import { Chat, GenerateContentResponse } from '@google/genai';

interface AskMeAnythingProps {
    initialState?: { query?: string };
}

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    imagePreview?: string;
}

// A simple component to render text with Markdown-like features
const MarkdownRenderer: React.FC<{ text: string }> = ({ text }) => {
    const lines = text.split('\n');
    return (
        <div className="prose prose-lg dark:prose-invert max-w-none text-right">
            {lines.map((line, index) => {
                if (line.startsWith('### ')) {
                    return <h3 key={index} className="font-bold text-xl mt-4 mb-2">{line.substring(4)}</h3>;
                }
                if (line.startsWith('## ')) {
                    return <h2 key={index} className="font-bold text-2xl mt-6 mb-3 border-b pb-2">{line.substring(3)}</h2>;
                }
                if (line.startsWith('# ')) {
                    return <h1 key={index} className="font-bold text-3xl mt-8 mb-4 border-b pb-3">{line.substring(2)}</h1>;
                }
                 if (line.startsWith('* ')) {
                     // Check for bold within list item
                    const parts = line.substring(2).split('**');
                    return (
                        <li key={index} className="my-1">
                            {parts.map((part, i) =>
                                i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                            )}
                        </li>
                    );
                }
                if (line.match(/^\d+\.\s/)) {
                     return <li key={index} className="my-1">{line}</li>;
                }
                if (line.trim() === '') {
                    return <br key={index} />;
                }
                // Handle bold text with **
                const parts = line.split('**');
                return (
                    <p key={index} className="my-2 leading-relaxed">
                        {parts.map((part, i) =>
                            i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                        )}
                    </p>
                );
            })}
        </div>
    );
};


const AskMeAnything: React.FC<AskMeAnythingProps> = ({ initialState }) => {
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    
    // Voice input state
    const [isListening, setIsListening] = useState(false);
    const [interimTranscript, setInterimTranscript] = useState('');
    const speechRecognitionRef = useRef<any>(null);

    // Chat state
    const [chat, setChat] = useState<Chat | null>(null);
    const [conversation, setConversation] = useState<Message[]>([]);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setChat(geminiService.startChatSession());
        if (initialState?.query) {
            handleAsk(initialState.query);
        }
    }, [initialState]);
    
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversation, isLoading]);

    const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
            setImageFile(file);
            const objectUrl = URL.createObjectURL(file);
            setImagePreview(objectUrl);
        }
        event.target.value = '';
    };

    const handleRemoveImage = () => {
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImageFile(null);
        setImagePreview(null);
    };

    useEffect(() => {
        return () => {
            if (imagePreview) URL.revokeObjectURL(imagePreview);
        };
    }, [imagePreview]);
    
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            speechRecognitionRef.current = new SpeechRecognition();
            const recognition = speechRecognitionRef.current;
            recognition.continuous = false;
            recognition.lang = 'ar-SA';
            recognition.interimResults = true;

            recognition.onresult = (event: any) => {
                let interim = '';
                let final = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) final += event.results[i][0].transcript;
                    else interim += event.results[i][0].transcript;
                }
                setInterimTranscript(interim);
                if (final) {
                    setQuery(final.trim());
                    handleAsk(final.trim());
                }
            };

            recognition.onend = () => setIsListening(false);
            recognition.onerror = (event: any) => {
                console.error('Speech recognition error:', event.error);
                if (event.error !== 'no-speech') setError('حدث خطأ في التعرف على الصوت.');
                setIsListening(false);
            };
        }
    }, []);

    const handleAsk = async (askQuery: string) => {
        if ((!askQuery.trim() && !imageFile) || !chat) return;

        setIsLoading(true);
        setError(null);

        const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', text: askQuery };
        if (imagePreview) userMessage.imagePreview = imagePreview;
        
        const modelMessageId = `model-${Date.now()}`;
        setConversation(prev => [...prev, userMessage, { id: modelMessageId, role: 'model', text: '' }]);

        const currentImageFile = imageFile;
        setQuery('');
        setImageFile(null);
        setImagePreview(null); // The preview URL is now stored in the message

        try {
            const contentParts: any[] = [];
            if (currentImageFile) {
                const imageBase64 = await compressImageAndConvertToBase64(currentImageFile);
                contentParts.push({ inlineData: { mimeType: 'image/jpeg', data: imageBase64 } });
            }
            contentParts.push({ text: askQuery || "انظر إلى هذه الصورة واشرحها." });

            const stream = await chat.sendMessageStream({ message: contentParts });
            setIsLoading(false);

            let accumulatedText = '';
            for await (const chunk of stream) {
                accumulatedText += chunk.text;
                setConversation(prev => prev.map(msg => 
                    msg.id === modelMessageId ? { ...msg, text: accumulatedText } : msg
                ));
            }

        } catch (err) {
            setError('حدث خطأ. حاول مرة أخرى.');
             setConversation(prev => prev.map(msg => 
                msg.id === modelMessageId ? { ...msg, text: 'عذراً، حدث خطأ أثناء محاولة الحصول على إجابة.' } : msg
            ));
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleAsk(query);
    };

    const handleToggleListening = () => {
        if (!speechRecognitionRef.current) {
            setError('ميزة الصوت غير مدعومة في هذا المتصفح.');
            return;
        }
        if (isListening) speechRecognitionRef.current?.stop();
        else {
            setQuery('');
            handleRemoveImage();
            setInterimTranscript('');
            speechRecognitionRef.current.start();
            setIsListening(true);
        }
    };

    const handleNewConversation = () => {
        setConversation([]);
        setChat(geminiService.startChatSession());
        setError(null);
        handleRemoveImage();
        setQuery('');
    };

    return (
        <div className="p-4 md:p-6 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="text-indigo-500" size={28} />
                    <h2 className="text-xl font-bold">اسألني أي شيء</h2>
                </div>
                <button
                    onClick={handleNewConversation}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-indigo-600 bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-300 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors"
                    aria-label="بدء محادثة جديدة"
                >
                    <RefreshCw size={16} />
                    <span>محادثة جديدة</span>
                </button>
            </div>
            
            <div className="flex-grow bg-white dark:bg-gray-800 rounded-xl shadow-inner overflow-y-auto p-4 space-y-4">
                {conversation.map((msg, index) => (
                    <div key={msg.id} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'model' && <div className="flex-shrink-0 w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center text-white"><Sparkles size={18} /></div>}
                        <div className={`max-w-xl p-3 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-bl-none'}`}>
                            {msg.imagePreview && <img src={msg.imagePreview} alt="معاينة المستخدم" className="w-full max-w-xs rounded-lg mb-2" />}
                            {msg.text ? <MarkdownRenderer text={msg.text} /> : (
                                 <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></span>
                                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-150"></span>
                                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-300"></span>
                                </div>
                            )}
                        </div>
                        {msg.role === 'user' && <div className="flex-shrink-0 w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center"><User size={18} /></div>}
                    </div>
                ))}
                {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-center flex items-center justify-center gap-2"><AlertTriangle size={18}/> {error}</div>}
                <div ref={chatEndRef} />
            </div>

            <div className="pt-4">
                {imagePreview && (
                    <div className="relative w-40 mx-auto mb-2 rounded-lg overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600">
                        <img src={imagePreview} alt="معاينة" className="w-full h-full object-contain" />
                        <button onClick={handleRemoveImage} className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"><X size={16} /></button>
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="relative">
                        <textarea
                            value={isListening ? interimTranscript : query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={isListening ? "استمع الآن..." : "اكتب سؤالك هنا..."}
                            className="w-full p-3 pl-14 pr-24 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary dark:bg-gray-700 shadow-sm resize-none"
                            rows={2}
                            disabled={isLoading}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
                        />
                        <button type="button" onClick={handleToggleListening} disabled={isLoading} className={`absolute top-1/2 -translate-y-1/2 left-3 p-2 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-primary'}`}><Mic /></button>
                        <div className="absolute top-1/2 -translate-y-1/2 right-3 flex gap-1">
                             <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={isLoading} className="p-2 text-gray-500 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><Camera /></button>
                             <button type="button" onClick={() => imageInputRef.current?.click()} disabled={isLoading} className="p-2 text-gray-500 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><ImageUp /></button>
                        </div>
                    </div>
                    <input type="file" accept="image/*" ref={imageInputRef} onChange={handleImageSelect} className="hidden" />
                    <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageSelect} className="hidden" />
                    <button type="submit" className="w-full p-3 bg-primary text-white rounded-lg font-semibold shadow-md hover:bg-primary-dark disabled:opacity-50 flex items-center justify-center gap-2" disabled={isLoading || (!query.trim() && !imageFile)}><Send/><span>إرسال</span></button>
                </form>
            </div>
        </div>
    );
};

export default AskMeAnything;