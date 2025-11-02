import React, { useState, useRef } from 'react';
import { Mic, MicOff, AlertTriangle } from 'lucide-react';

interface AudioRecorderProps {
    onRecordingComplete: (audioBlob: Blob) => void;
    disabled?: boolean;
    className?: string;
}

const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, disabled, className }) => {
    const [isRecording, setIsRecording] = useState(false);
    const [permissionError, setPermissionError] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        setPermissionError(false);
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                // Use a common MIME type if available, otherwise let the browser decide.
                const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                  ? { mimeType: 'audio/webm;codecs=opus' }
                  : {};
                mediaRecorderRef.current = new MediaRecorder(stream, options);
                audioChunksRef.current = [];

                mediaRecorderRef.current.ondataavailable = (event) => {
                    audioChunksRef.current.push(event.data);
                };

                mediaRecorderRef.current.onstop = () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType ?? 'audio/webm' });
                    onRecordingComplete(audioBlob);
                    stream.getTracks().forEach(track => track.stop()); // Stop the microphone track
                };

                mediaRecorderRef.current.start();
                setIsRecording(true);
            } catch (err) {
                console.error("Error accessing microphone:", err);
                setPermissionError(true);
            }
        } else {
            console.error("getUserMedia not supported");
            setPermissionError(true);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleToggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };
    
    if (permissionError) {
         return (
            <div className="flex items-center gap-2 text-red-500 text-sm p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
                <AlertTriangle size={16} />
                <span>خطأ في الميكروفون</span>
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={handleToggleRecording}
            disabled={disabled}
            className={`p-3 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${
                isRecording 
                    ? 'bg-red-500 text-white animate-pulse ring-red-300' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-600 focus:ring-primary'
            } disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
            aria-label={isRecording ? 'إيقاف التسجيل' : 'بدء التسجيل الصوتي'}
        >
            {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
    );
};

export default AudioRecorder;
