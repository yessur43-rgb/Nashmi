import React, { useRef, useState, useEffect } from 'react';
import { Camera, ImageUp, ScanBarcode, X, AlertTriangle } from 'lucide-react';

interface ImageInputProps {
  onImageSelect: (file: File) => void;
  onBarcodeScan?: (barcode: string) => void;
  disabled?: boolean;
  showBarcodeScanner?: boolean;
}

const ImageInput: React.FC<ImageInputProps> = ({ onImageSelect, onBarcodeScan, disabled, showBarcodeScanner = true }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isScanningRef = useRef(false);

  useEffect(() => {
    // Cleanup function to stop camera when component unmounts
    return () => {
        if (isScanningRef.current && videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setScannerError(null); // Clear any scanner error when a new image is selected
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);
      onImageSelect(file);
    }
     // Reset the input value to allow selecting the same file again
    event.target.value = '';
  };

  const startScanning = async () => {
    setScannerError(null); // Reset error on new attempt

    if (!('BarcodeDetector' in window)) {
      setScannerError('متصفحك لا يدعم ميزة مسح الباركود.');
      return;
    }

    isScanningRef.current = true;
    setIsScanning(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const barcodeDetector = new BarcodeDetector({ formats: ['ean_13', 'upc_a', 'qr_code', 'code_128', 'itf'] });

        const detectBarcode = async () => {
          if (!isScanningRef.current || !videoRef.current || videoRef.current.readyState < 2) return;

          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              stopScanning(barcodes[0].rawValue);
            } else {
              requestAnimationFrame(detectBarcode);
            }
          } catch (e) {
            console.error('Barcode detection failed:', e);
            requestAnimationFrame(detectBarcode);
          }
        };
        requestAnimationFrame(detectBarcode);
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setScannerError('تم رفض الوصول إلى الكاميرا. يرجى تمكين الإذن في إعدادات المتصفح.');
      } else {
          setScannerError('لا يمكن الوصول إلى الكاميرا. قد تكون قيد الاستخدام أو لا توجد كاميرا.');
      }
      stopScanning();
    }
  };

  const stopScanning = (barcodeValue?: string) => {
    isScanningRef.current = false;
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    if (barcodeValue && onBarcodeScan) {
      onBarcodeScan(barcodeValue);
    }
  };


  const gridColsClass = showBarcodeScanner ? 'sm:grid-cols-3' : 'sm:grid-cols-2';

  return (
    <div className="w-full space-y-4">
      {isScanning && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-50 p-4 animate-fade-in">
          <video ref={videoRef} className="w-full max-w-2xl h-auto rounded-lg shadow-2xl" playsInline></video>
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-center">
            <p className="text-white text-lg font-semibold bg-black/50 px-4 py-2 rounded-full">وجّه الكاميرا نحو الباركود</p>
          </div>
          <button 
            onClick={() => stopScanning()} 
            className="mt-6 flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-full font-bold shadow-lg hover:bg-red-700 transition-transform transform hover:scale-105"
            aria-label="إلغاء المسح"
          >
            <X size={20} />
            <span>إلغاء</span>
          </button>
        </div>
      )}
      
      {preview ? (
        <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600">
          <img src={preview} alt="معاينة" className="w-full h-full object-contain" />
        </div>
      ) : (
        <div className="flex items-center justify-center w-full aspect-video bg-gray-100 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
            <p className="text-gray-500 dark:text-gray-400">اختر صورة للتحليل</p>
        </div>
      )}

      <div className={`grid grid-cols-1 ${gridColsClass} gap-3`}>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <input
          type="file"
          accept="image/*"
          capture="environment"
          ref={cameraInputRef}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-white rounded-lg font-semibold shadow-md hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ImageUp size={20} />
          <span>رفع صورة</span>
        </button>
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-secondary text-gray-900 rounded-lg font-semibold shadow-md hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Camera size={20} />
          <span>التقاط صورة</span>
        </button>
        {showBarcodeScanner && (
         <button
          onClick={startScanning}
          disabled={disabled || !onBarcodeScan}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-500 text-white rounded-lg font-semibold shadow-md hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ScanBarcode size={20} />
          <span>مسح باركود</span>
        </button>
        )}
      </div>
       {scannerError && (
        <div className="p-3 mt-2 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 rounded-lg text-center text-sm flex items-center justify-center gap-2">
            <AlertTriangle size={18} />
            <span>{scannerError}</span>
        </div>
      )}
    </div>
  );
};

export default ImageInput;