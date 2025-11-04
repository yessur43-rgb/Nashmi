import React, { useState } from 'react';
import { Key, X, Loader2 } from 'lucide-react';
import * as geminiService from '../../services/geminiService';

interface ApiKeyModalProps {
    onSetApiKey: (key: string) => void;
    onClose: () => void;
    isClosable?: boolean;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSetApiKey, onClose, isClosable = true }) => {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);

    const handleSave = async () => {
        if (!key.trim()) {
            setError('الرجاء إدخال مفتاح API صالح.');
            return;
        }

        setIsVerifying(true);
        setError('');

        const validationResult = await geminiService.verifyApiKey(key.trim());

        setIsVerifying(false);

        if (validationResult.success) {
            onSetApiKey(key.trim());
        } else {
            setError(validationResult.message || 'مفتاح API غير صالح أو غير صحيح. يرجى التحقق مرة أخرى.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 relative">
                {isClosable && (
                    <button onClick={onClose} className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full">
                        <X />
                    </button>
                )}
                <div className="text-center">
                    <Key className="mx-auto w-12 h-12 text-primary dark:text-primary-light mb-2" />
                    <h2 className="text-2xl font-bold">إعداد مفتاح Gemini API</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2">
                        لاستخدام التطبيق، تحتاج إلى مفتاح API الخاص بك من Google AI Studio.
                    </p>
                </div>

                <div>
                    <input
                        type="password"
                        value={key}
                        onChange={(e) => {
                            setKey(e.target.value);
                            if (error) setError('');
                        }}
                        placeholder="أدخل مفتاح API الخاص بك هنا"
                        className={`w-full p-3 border-2 rounded-lg dark:bg-gray-700 dark:border-gray-600 ${error ? 'border-red-500' : 'border-gray-300'}`}
                    />
                    {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                </div>

                <div className="space-y-2">
                     <button
                        onClick={handleSave}
                        disabled={isVerifying}
                        className="w-full flex items-center justify-center p-3 bg-primary text-white rounded-lg font-semibold shadow-md hover:bg-primary-dark transition-colors disabled:opacity-50"
                    >
                        {isVerifying ? <Loader2 className="animate-spin" /> : 'حفظ واستخدام المفتاح'}
                    </button>
                    <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-center w-full p-2 text-primary dark:text-primary-light hover:underline rounded-lg"
                    >
                        الحصول على مفتاح API
                    </a>
                </div>
            </div>
        </div>
    );
};

export default ApiKeyModal;