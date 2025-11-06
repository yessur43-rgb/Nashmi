import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export const isNativePlatform = () => {
  return Capacitor.isNativePlatform();
};

export const getPlatform = () => {
  return Capacitor.getPlatform();
};

// Camera helper - works on both web and native
export const takePicture = async (source: 'camera' | 'gallery' = 'camera') => {
  if (isNativePlatform()) {
    // Use Capacitor Camera on native platforms
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
    });
    return image.dataUrl || '';
  } else {
    // Fallback to web API
    return new Promise<string>((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (source === 'camera') {
        input.capture = 'environment';
      }
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        } else {
          reject(new Error('No file selected'));
        }
      };
      input.click();
    });
  }
};

// Geolocation helper - works on both web and native
export const getCurrentPosition = async () => {
  if (isNativePlatform()) {
    // Use Capacitor Geolocation on native platforms
    const coordinates = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    return {
      latitude: coordinates.coords.latitude,
      longitude: coordinates.coords.longitude,
      accuracy: coordinates.coords.accuracy,
      altitude: coordinates.coords.altitude,
      altitudeAccuracy: coordinates.coords.altitudeAccuracy,
      heading: coordinates.coords.heading,
      speed: coordinates.coords.speed,
    };
  } else {
    // Fallback to web API
    return new Promise<GeolocationCoordinates>((resolve, reject) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position.coords),
          reject,
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0,
          }
        );
      } else {
        reject(new Error('Geolocation is not supported'));
      }
    });
  }
};

// Check permissions
export const checkCameraPermission = async () => {
  if (isNativePlatform()) {
    const status = await Camera.checkPermissions();
    return status.camera === 'granted';
  }
  return true; // Web doesn't need pre-check
};

export const requestCameraPermission = async () => {
  if (isNativePlatform()) {
    const status = await Camera.requestPermissions();
    return status.camera === 'granted';
  }
  return true;
};

export const checkLocationPermission = async () => {
  if (isNativePlatform()) {
    const status = await Geolocation.checkPermissions();
    return status.location === 'granted';
  }
  return true;
};

export const requestLocationPermission = async () => {
  if (isNativePlatform()) {
    const status = await Geolocation.requestPermissions();
    return status.location === 'granted';
  }
  return true;
};
