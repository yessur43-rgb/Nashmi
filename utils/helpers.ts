

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

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = () => {
      const result = reader.result as string;
      const parts = result.split(',');
      if (parts.length < 2) {
        return reject(new Error("Invalid data URL."));
      }
      resolve(parts[1]);
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

export const generateThumbnail = (base64: string, maxDimension: number = 200): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${base64}`;
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
      // Use lower quality for thumbnail
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = (e) => reject(e);
  });
};

export const generateVideoThumbnail = (file: File, seekToTime: number = 0.5): Promise<string> => {
  return new Promise((resolve, reject) => {
    const TIMEOUT_MS = 30000; // زيادة من 10 إلى 30 ثانية لدعم فيديوهات أكبر
    let timer: number | null = null;
    
    const video = document.createElement('video');
    video.style.display = 'none';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement('canvas');
    canvas.style.display = 'none';
    const url = URL.createObjectURL(file);

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      if (video.parentElement) document.body.removeChild(video);
      if (canvas.parentElement) document.body.removeChild(canvas);
    };

    timer = window.setTimeout(() => {
        onError(`Video thumbnail generation timed out after ${TIMEOUT_MS / 1000}s.`);
    }, TIMEOUT_MS);
    
    const onSeeked = () => {
      try {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Could not get canvas context');
        }
        
        const maxDimension = 200;
        let { videoWidth, videoHeight } = video;
        if (videoWidth === 0 || videoHeight === 0) {
          cleanup();
          return reject(new Error('Video has no dimensions'));
        }
        
        let width = videoWidth;
        let height = videoHeight;
        
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
        
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        cleanup();
        resolve(dataUrl.split(',')[1]);
      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    // FIX: Replaced implementation to add explicit type guarding block to resolve TypeScript error on line 359.
    const onError = (e: Event | string) => {
      cleanup();
      if (typeof e === 'string') {
        reject(new Error(`Error loading video for thumbnail: ${e}`));
        return;
      }
      const errorMsg = (e.target as HTMLVideoElement)?.error?.message || 'Unknown video error';
      reject(new Error(`Error loading video for thumbnail: ${errorMsg}`));
    };

    const onLoadedMetadata = () => {
      video.currentTime = Math.min(seekToTime, video.duration || 0);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    video.src = url;
    document.body.appendChild(video);
    document.body.appendChild(canvas);
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

export const getSupportedVideoMimeType = () => {
    const mimeTypes = [
        'video/mp4;codecs=avc1',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8,opus',
        'video/webm',
    ];
    for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
            return { mimeType };
        }
    }
    return {};
};

export const isQuotaExceededError = (error: unknown): boolean => {
    if (!error) return false;

    if (error instanceof DOMException) {
        if (error.name === 'QuotaExceededError') {
            return true;
        }
        if (error.name === 'UnknownError' && /quota|storage|disk/i.test(error.message)) {
            return true;
        }
        if (typeof (error as any).code === 'number' && (error as any).code === 22) {
            return true;
        }
    }

    if (typeof error === 'object' && error !== null) {
        const name = (error as any).name as string | undefined;
        const code = (error as any).code as number | undefined;
        const message = (error as any).message as string | undefined;

        if (name === 'QuotaExceededError') {
            return true;
        }
        if (typeof code === 'number' && code === 22) {
            return true;
        }
        if (message && /quota|storage|disk/i.test(message)) {
            return true;
        }
    }

    if (typeof error === 'string' && /quota|storage|disk/i.test(error)) {
        return true;
    }

    return false;
};

export const trimVideoBlob = (videoBlob: Blob, maxDurationSeconds: number): Promise<{ blob: Blob, wasTrimmed: boolean }> => {
  return new Promise((resolve, reject) => {
    let timer: number | null = null;
    const TIMEOUT_MS = 60000; // زيادة من 20 إلى 60 ثانية لدعم فيديوهات أكبر

    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    video.style.display = 'none';
    canvas.style.display = 'none';
    const url = URL.createObjectURL(videoBlob);
    
    video.muted = true;
    video.playsInline = true;

    let animationFrameId: number;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      URL.revokeObjectURL(url);
      if (video.parentElement) document.body.removeChild(video);
      if (canvas.parentElement) document.body.removeChild(canvas);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
    
    timer = window.setTimeout(() => {
        cleanup();
        reject(new Error(`Video trimming timed out after ${TIMEOUT_MS / 1000}s.`));
    }, TIMEOUT_MS);

    video.onloadedmetadata = () => {
      if (video.duration <= maxDurationSeconds) {
        cleanup();
        return resolve({ blob: videoBlob, wasTrimmed: false });
      }

      try {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            cleanup();
            return reject(new Error('Could not get canvas context.'));
        }

        if (typeof (canvas as any).captureStream !== 'function') {
            cleanup();
            return reject(new Error('canvas.captureStream() is not supported by this browser.'));
        }

        const stream = (canvas as any).captureStream();
        const options = getSupportedVideoMimeType();
        const finalMimeType = options.mimeType || 'video/webm';

        const recorder = new MediaRecorder(stream, options);
        const chunks: Blob[] = [];
        recorder.ondataavailable = e => chunks.push(e.data);

        recorder.onstop = () => {
          cleanup();
          const trimmedBlob = new Blob(chunks, { type: finalMimeType });
           if (trimmedBlob.size === 0) {
              return reject(new Error("Trimming resulted in an empty video file."));
          }
          resolve({ blob: trimmedBlob, wasTrimmed: true });
        };

        recorder.onerror = (e) => {
          cleanup();
          reject(e);
        };
        
        const drawFrame = () => {
            if (!video.paused && !video.ended) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                animationFrameId = requestAnimationFrame(drawFrame);
            }
        };

        recorder.start();
        video.play().then(() => {
            drawFrame();
        }).catch(playError => {
            cleanup();
            reject(playError);
        });

        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
          if (!video.paused) {
            video.pause();
          }
        }, maxDurationSeconds * 1000);

      } catch (e) {
        cleanup();
        reject(e);
      }
    };

    // FIX: Added explicit type guarding block to resolve TypeScript error on line 476.
    video.onerror = (e: Event | string) => {
      cleanup();
      if (typeof e === 'string') {
        reject(new Error(`Error loading video for trimming: ${e}`));
        return;
      }
      const errorMessage = (e.target as HTMLVideoElement)?.error?.message || 'Unknown error';
      reject(new Error(`Error loading video for trimming: ${errorMessage}`));
    };
    
    video.src = url;
    document.body.appendChild(video);
    document.body.appendChild(canvas);
  });
};

export const removeAudioFromVideo = async (base64: string, mimeType: string): Promise<{ base64: string, mimeType: string }> => {
    return new Promise(async (resolve, reject) => {
        let timer: number | null = null;
        const TIMEOUT_MS = 60000; // 60s, can be long for large videos.

        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        video.style.display = 'none';
        canvas.style.display = 'none';

        let animationFrameId: number;

        const cleanup = () => {
            if (timer) clearTimeout(timer);
            if (video.src) URL.revokeObjectURL(video.src);
            if (video.parentElement) video.parentElement.removeChild(video);
            if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };

        timer = window.setTimeout(() => {
            cleanup();
            reject(new Error(`Removing audio timed out after ${TIMEOUT_MS / 1000}s.`));
        }, TIMEOUT_MS);

        try {
            const response = await fetch(`data:${mimeType};base64,${base64}`);
            const videoBlob = await response.blob();
            
            video.muted = true;
            video.playsInline = true;

            video.onloadedmetadata = () => {
                try {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        cleanup();
                        return reject(new Error('Could not get canvas context.'));
                    }

                    if (typeof (canvas as any).captureStream !== 'function') {
                        cleanup();
                        return reject(new Error('canvas.captureStream() is not supported by this browser.'));
                    }
                    
                    const stream = (canvas as any).captureStream();
                    const options = getSupportedVideoMimeType();
                    const recorder = new MediaRecorder(stream, options);
                    const finalMimeType = options.mimeType || 'video/webm';
                    
                    const chunks: Blob[] = [];
                    recorder.ondataavailable = e => chunks.push(e.data);
                    
                    recorder.onstop = async () => {
                        cleanup();
                        try {
                            const mutedBlob = new Blob(chunks, { type: finalMimeType });
                            if (mutedBlob.size === 0) {
                                return reject(new Error("Processing resulted in an empty video file."));
                            }
                            const mutedBase64 = await blobToBase64(mutedBlob);
                            resolve({ base64: mutedBase64, mimeType: finalMimeType });
                        } catch (e) {
                            reject(e);
                        }
                    };
                    
                    recorder.onerror = (e) => {
                        cleanup();
                        reject(new Error(`MediaRecorder encountered an error during processing.`));
                    };

                    const drawFrame = () => {
                        if (!video.paused && !video.ended) {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            animationFrameId = requestAnimationFrame(drawFrame);
                        }
                    };

                    recorder.start();
                    video.play().then(() => {
                        drawFrame();
                    }).catch(playError => {
                        cleanup();
                        reject(playError);
                    });

                    // Stop recording after the video's full duration has passed.
                    const durationMs = (video.duration * 1000) + 250;
                    setTimeout(() => {
                        if (recorder.state === 'recording') {
                            recorder.stop();
                        }
                        if (!video.paused) {
                            video.pause();
                        }
                    }, durationMs);

                } catch (e) {
                    cleanup();
                    reject(e instanceof Error ? e : new Error(String(e)));
                }
            };
            
            video.onerror = (e) => {
                 cleanup();
                 reject(new Error(`Error loading video for processing: ${(e.target as HTMLVideoElement)?.error?.message || 'Unknown error'}`));
            };

            video.src = URL.createObjectURL(videoBlob);
            document.body.appendChild(video);
            document.body.appendChild(canvas);

        } catch (error: any) {
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
};

export interface VideoCompressionOptions {
    maxWidth?: number;      // الحد الأقصى للعرض (default: 1280)
    maxHeight?: number;     // الحد الأقصى للارتفاع (default: 720)
    quality?: number;       // جودة الفيديو 0-1 (default: 0.7)
    bitrate?: number;       // bitrate بالـ bps (optional)
}

/**
 * ضغط الفيديو عن طريق تقليل الدقة وإعادة الترميز
 */
export const compressVideo = async (
    videoBlob: Blob,
    options: VideoCompressionOptions = {}
): Promise<{ blob: Blob; originalSize: number; compressedSize: number; compressionRatio: number }> => {
    return new Promise((resolve, reject) => {
        const {
            maxWidth = 1280,
            maxHeight = 720,
            quality = 0.7
        } = options;

        let timer: number | null = null;
        const TIMEOUT_MS = 120000; // 2 دقيقة للضغط

        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        video.style.display = 'none';
        canvas.style.display = 'none';

        let animationFrameId: number;
        const originalSize = videoBlob.size;

        const cleanup = () => {
            if (timer) clearTimeout(timer);
            if (video.src) URL.revokeObjectURL(video.src);
            if (video.parentElement) video.parentElement.removeChild(video);
            if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };

        timer = window.setTimeout(() => {
            cleanup();
            reject(new Error(`انتهى وقت ضغط الفيديو بعد ${TIMEOUT_MS / 1000} ثانية.`));
        }, TIMEOUT_MS);

        try {
            video.muted = true;
            video.playsInline = true;

            video.onloadedmetadata = () => {
                try {
                    // حساب الأبعاد الجديدة مع الحفاظ على نسبة العرض للارتفاع
                    let newWidth = video.videoWidth;
                    let newHeight = video.videoHeight;

                    if (newWidth > maxWidth || newHeight > maxHeight) {
                        const aspectRatio = newWidth / newHeight;

                        if (newWidth > newHeight) {
                            newWidth = Math.min(newWidth, maxWidth);
                            newHeight = Math.round(newWidth / aspectRatio);
                        } else {
                            newHeight = Math.min(newHeight, maxHeight);
                            newWidth = Math.round(newHeight * aspectRatio);
                        }

                        // تأكد من أن الأرقام زوجية (مطلوب لبعض codecs)
                        newWidth = Math.floor(newWidth / 2) * 2;
                        newHeight = Math.floor(newHeight / 2) * 2;
                    }

                    canvas.width = newWidth;
                    canvas.height = newHeight;

                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        cleanup();
                        return reject(new Error('تعذر الحصول على سياق Canvas.'));
                    }

                    if (typeof (canvas as any).captureStream !== 'function') {
                        cleanup();
                        return reject(new Error('متصفحك لا يدعم ضغط الفيديو.'));
                    }

                    const stream = (canvas as any).captureStream(25); // 25 fps
                    const options = getSupportedVideoMimeType();
                    const finalMimeType = options.mimeType || 'video/webm';

                    // حساب bitrate بناءً على الدقة والجودة
                    const pixelCount = newWidth * newHeight;
                    const baseBitrate = pixelCount * 0.1 * quality; // قاعدة تقريبية

                    const recorderOptions: any = {
                        ...options,
                        videoBitsPerSecond: baseBitrate
                    };

                    const recorder = new MediaRecorder(stream, recorderOptions);
                    const chunks: Blob[] = [];

                    recorder.ondataavailable = e => chunks.push(e.data);

                    recorder.onstop = () => {
                        cleanup();
                        const compressedBlob = new Blob(chunks, { type: finalMimeType });

                        if (compressedBlob.size === 0) {
                            return reject(new Error("الضغط أنتج ملف فيديو فارغ."));
                        }

                        const compressionRatio = ((originalSize - compressedBlob.size) / originalSize * 100);

                        resolve({
                            blob: compressedBlob,
                            originalSize,
                            compressedSize: compressedBlob.size,
                            compressionRatio
                        });
                    };

                    recorder.onerror = (e) => {
                        cleanup();
                        reject(new Error('حدث خطأ أثناء ضغط الفيديو.'));
                    };

                    const drawFrame = () => {
                        if (!video.paused && !video.ended) {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            animationFrameId = requestAnimationFrame(drawFrame);
                        }
                    };

                    recorder.start();
                    video.play().then(() => {
                        drawFrame();
                    }).catch(playError => {
                        cleanup();
                        reject(playError);
                    });

                    video.onended = () => {
                        if (recorder.state === 'recording') {
                            recorder.stop();
                        }
                    };

                } catch (e) {
                    cleanup();
                    reject(e instanceof Error ? e : new Error(String(e)));
                }
            };

            video.onerror = (e) => {
                cleanup();
                reject(new Error(`خطأ في تحميل الفيديو للضغط: ${(e.target as HTMLVideoElement)?.error?.message || 'خطأ غير معروف'}`));
            };

            video.src = URL.createObjectURL(videoBlob);
            document.body.appendChild(video);
            document.body.appendChild(canvas);

        } catch (error: any) {
            cleanup();
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
};

export const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};