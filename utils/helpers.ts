

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
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const canvas = document.createElement('canvas');
    const url = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };

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

    const onError = (e: Event | string) => {
      cleanup();
      const errorMsg = (e instanceof Event && e.target) ? (e.target as HTMLVideoElement).error?.message : e.toString();
      reject(new Error(`Error loading video for thumbnail: ${errorMsg}`));
    };

    const onLoadedMetadata = () => {
      video.currentTime = Math.min(seekToTime, video.duration || 0);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    // Set src AFTER attaching listeners to prevent race conditions
    video.src = url;
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

export const trimVideoBlob = (videoBlob: Blob, maxDurationSeconds: number): Promise<{ blob: Blob, wasTrimmed: boolean }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    video.style.display = 'none';
    canvas.style.display = 'none';
    const url = URL.createObjectURL(videoBlob);
    
    video.muted = true;
    video.playsInline = true;

    let animationFrameId: number;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (video.parentElement) document.body.removeChild(video);
      if (canvas.parentElement) document.body.removeChild(canvas);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };

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

        // FIX: Check for canvas.captureStream support
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

    video.onerror = (e) => {
      cleanup();
      reject(new Error(`Error loading video for trimming: ${e}`));
    };
    
    // Set src AFTER attaching listeners to prevent race conditions
    video.src = url;
    document.body.appendChild(video);
    document.body.appendChild(canvas);
  });
};

export const removeAudioFromVideo = async (base64: string, mimeType: string): Promise<{ base64: string, mimeType: string }> => {
    return new Promise(async (resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        video.style.display = 'none';
        canvas.style.display = 'none';

        let animationFrameId: number;

        const cleanup = () => {
            if (video.src) URL.revokeObjectURL(video.src);
            if (video.parentElement) video.parentElement.removeChild(video);
            if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };

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

                    // FIX: Check for canvas.captureStream support
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
            
            video.onerror = () => {
                 cleanup();
                 reject(new Error("Error loading video for processing."));
            };

            // Set src AFTER attaching listeners to prevent race conditions
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