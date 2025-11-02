export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (e) => reject(e);
  });
};

export const blobToBase64 = (blob: Blob): Promise<{base64: string, mimeType: string}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const result = reader.result as string;
      const parts = result.split(',');
      if (parts.length < 2) {
        return reject(new Error("Invalid data URL."));
      }
      const mimeType = parts[0].split(':')[1].split(';')[0];
      const base64 = parts[1];
      resolve({ base64, mimeType });
    };
    reader.onerror = (e) => reject(e);
  });
};

export const compressImageAndConvertToBase64 = (file: File, maxDimension: number = 1280, quality: number = 0.85): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      if (!event.target?.result) {
        return reject(new Error("Failed to read file."));
      }
      const img = new Image();
      img.src = event.target.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
            if (width > height) {
                height = Math.round(height * (maxDimension / width));
                width = maxDimension;
            } else {
                width = Math.round(width * (maxDimension / height));
                height = maxDimension;
            }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

export const getStatusColor = (status: 'حلال' | 'حرام' | 'مشبوه') => {
    switch (status) {
        case 'حلال': return 'bg-green-100 text-green-800 border-green-400';
        case 'حرام': return 'bg-red-100 text-red-800 border-red-400';
        case 'مشبوه': return 'bg-yellow-100 text-yellow-800 border-yellow-400';
        default: return 'bg-gray-100 text-gray-800 border-gray-400';
    }
};

export const getStatusRingColor = (status: 'حلال' | 'حرام' | 'مشبوه') => {
    switch (status) {
        case 'حلال': return 'ring-green-500';
        case 'حرام': return 'ring-red-500';
        case 'مشبوه': return 'ring-yellow-500';
        default: return 'ring-gray-500';
    }
};

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): string => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance < 1 ? `${(distance * 1000).toFixed(0)} متر` : `${distance.toFixed(1)} كم`;
};

export const getStorageEstimate = async (): Promise<{ usedBytes: number, quotaBytes: number }> => {
    if (navigator.storage && navigator.storage.estimate) {
        try {
            const estimate = await navigator.storage.estimate();
            return {
                usedBytes: estimate.usage || 0,
                quotaBytes: estimate.quota || 10 * 1024 * 1024, // fallback quota 10MB
            };
        } catch (error) {
            console.error("Could not estimate storage:", error);
        }
    }
    // Fallback for older browsers or private mode issues
    return { usedBytes: 0, quotaBytes: 10 * 1024 * 1024 };
};

export const parseDistance = (distanceStr: string): number => {
    if (!distanceStr) return Infinity;
    const value = parseFloat(distanceStr.replace(/,/g, '.'));
    if (isNaN(value)) return Infinity;

    if (distanceStr.includes('كم') || distanceStr.includes('km')) {
        return value * 1000;
    }
    // Assume meters if no unit or 'متر'
    return value;
};