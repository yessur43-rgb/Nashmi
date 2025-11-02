import { Trip, AccommodationInfo, Activity, StoreResult, Place, RoutePlace, ParkingInfo } from '../types';

const DB_NAME = 'ZadDB';
const DB_VERSION = 1;

// Store names
const TRIPS_STORE = 'trips';
const ACCOMMODATIONS_STORE = 'accommodations';
const PARKING_STORE = 'parking';
const FAV_ACTIVITIES_STORE = 'favorite_activities';
const FAV_STORES_STORE = 'favorite_stores';
const FAV_PLACES_STORE = 'favorite_places';
const FAV_ROUTE_PLACES_STORE = 'favorite_route_places';
const SETTINGS_STORE = 'settings';

let db: IDBDatabase | null = null;

const getDb = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            return resolve(db);
        }
        
        console.log("Attempting to open IndexedDB connection...");
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Database open error:', request.error);
            reject(new Error(`Failed to open database. Error: ${request.error?.name}`));
        };

        request.onsuccess = () => {
            console.log("Database connection successful.");
            db = request.result;

            db.onversionchange = () => {
                console.warn('Database version change detected. Closing connection to allow upgrade.');
                if (db) {
                    db.close();
                }
                db = null;
            };

            db.onclose = () => {
                console.warn('Database connection closed.');
                db = null;
            };
            
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            console.log("Database upgrade required.");
            const upgradeDb = (event.target as IDBOpenDBRequest).result;
            
            if (!upgradeDb.objectStoreNames.contains(TRIPS_STORE)) {
                 console.log(`Creating object store: ${TRIPS_STORE}`);
                upgradeDb.createObjectStore(TRIPS_STORE, { keyPath: 'id' });
            }
            if (!upgradeDb.objectStoreNames.contains(ACCOMMODATIONS_STORE)) {
                console.log(`Creating object store: ${ACCOMMODATIONS_STORE}`);
                upgradeDb.createObjectStore(ACCOMMODATIONS_STORE, { keyPath: 'id' });
            }
            if (!upgradeDb.objectStoreNames.contains(PARKING_STORE)) {
                 console.log(`Creating object store: ${PARKING_STORE}`);
                upgradeDb.createObjectStore(PARKING_STORE);
            }
            if (!upgradeDb.objectStoreNames.contains(FAV_ACTIVITIES_STORE)) {
                console.log(`Creating object store: ${FAV_ACTIVITIES_STORE}`);
                upgradeDb.createObjectStore(FAV_ACTIVITIES_STORE, { keyPath: 'mapsLink' });
            }
            if (!upgradeDb.objectStoreNames.contains(FAV_STORES_STORE)) {
                console.log(`Creating object store: ${FAV_STORES_STORE}`);
                upgradeDb.createObjectStore(FAV_STORES_STORE, { keyPath: 'mapsLink' });
            }
            if (!upgradeDb.objectStoreNames.contains(FAV_PLACES_STORE)) {
                console.log(`Creating object store: ${FAV_PLACES_STORE}`);
                upgradeDb.createObjectStore(FAV_PLACES_STORE, { keyPath: 'mapsLink' });
            }
            if (!upgradeDb.objectStoreNames.contains(FAV_ROUTE_PLACES_STORE)) {
                console.log(`Creating object store: ${FAV_ROUTE_PLACES_STORE}`);
                upgradeDb.createObjectStore(FAV_ROUTE_PLACES_STORE, { keyPath: 'mapsLink' });
            }
            if (!upgradeDb.objectStoreNames.contains(SETTINGS_STORE)) {
                console.log(`Creating object store: ${SETTINGS_STORE}`);
                upgradeDb.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
            }
        };
    });
};

const getStore = async (storeName: string, mode: IDBTransactionMode) => {
    const db = await getDb();
    const tx = db.transaction(storeName, mode);
    return tx.objectStore(storeName);
};

// Generic CRUD
const getAll = async <T>(storeName: string): Promise<T[]> => {
    const store = await getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const put = async <T>(storeName: string, item: T): Promise<IDBValidKey> => {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve(request.result);
        request.onerror = (event) => reject(request.error);
    });
};

const deleteByKey = async (storeName: string, key: string): Promise<void> => {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

const getByKey = async <T>(storeName: string, key: string): Promise<T | undefined> => {
    const store = await getStore(storeName, 'readonly');
    return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const putKeyValue = async (storeName: string, key: any, value: any): Promise<void> => {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
        const request = store.put(value, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

// Trips
export const getAllTrips = () => getAll<Trip>(TRIPS_STORE).then(trips => trips.sort((a,b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()));
export const putTrip = (trip: Trip) => put<Trip>(TRIPS_STORE, trip);
export const deleteTrip = (tripId: string) => deleteByKey(TRIPS_STORE, tripId);

// Accommodations
export const getAllAccommodations = () => getAll<AccommodationInfo>(ACCOMMODATIONS_STORE);
export const putAccommodation = (accommodation: AccommodationInfo) => put<AccommodationInfo>(ACCOMMODATIONS_STORE, accommodation);
export const deleteAccommodation = (accommodationId: string) => deleteByKey(ACCOMMODATIONS_STORE, accommodationId);

// Parking
const PARKING_INFO_KEY = 'currentParking';
export const getParkingInfo = () => getByKey<ParkingInfo>(PARKING_STORE, PARKING_INFO_KEY);
export const putParkingInfo = (info: ParkingInfo) => putKeyValue(PARKING_STORE, PARKING_INFO_KEY, info);
export const deleteParkingInfo = () => deleteByKey(PARKING_STORE, PARKING_INFO_KEY);


// Favorites
export const getAllFavoriteActivities = () => getAll<Activity>(FAV_ACTIVITIES_STORE);
export const putFavoriteActivity = (activity: Activity) => put<Activity>(FAV_ACTIVITIES_STORE, activity);
export const deleteFavoriteActivity = (mapsLink: string) => deleteByKey(FAV_ACTIVITIES_STORE, mapsLink);

export const getAllFavoriteStores = () => getAll<StoreResult>(FAV_STORES_STORE);
export const putFavoriteStore = (store: StoreResult) => put<StoreResult>(FAV_STORES_STORE, store);
export const deleteFavoriteStore = (mapsLink: string) => deleteByKey(FAV_STORES_STORE, mapsLink);

export const getAllFavoritePlaces = () => getAll<Place>(FAV_PLACES_STORE);
export const putFavoritePlace = (place: Place) => put<Place>(FAV_PLACES_STORE, place);
export const deleteFavoritePlace = (mapsLink: string) => deleteByKey(FAV_PLACES_STORE, mapsLink);

export const getAllFavoriteRoutePlaces = () => getAll<RoutePlace>(FAV_ROUTE_PLACES_STORE);
export const putFavoriteRoutePlace = (place: RoutePlace) => put<RoutePlace>(FAV_ROUTE_PLACES_STORE, place);
export const deleteFavoriteRoutePlace = (mapsLink: string) => deleteByKey(FAV_ROUTE_PLACES_STORE, mapsLink);

// Settings
interface Setting { key: string; value: any; }
export const getSetting = (key: string) => getByKey<Setting>(SETTINGS_STORE, key);
export const putSetting = (setting: Setting) => put<Setting>(SETTINGS_STORE, setting);

// Data Management
export const exportData = async (): Promise<Record<string, any>> => {
    const data: Record<string, any> = {};
    const db = await getDb();
    const storeNames = Array.from(db.objectStoreNames);

    for (const storeName of storeNames) {
        if (storeName === PARKING_STORE) {
            data[storeName] = await getParkingInfo();
        } else {
            data[storeName] = await getAll(storeName);
        }
    }
    return data;
};

export const importData = async (data: Record<string, any>): Promise<void> => {
    const db = await getDb();
    const storeNames = Array.from(db.objectStoreNames);
    const tx = db.transaction(storeNames, 'readwrite');

    return new Promise((resolve, reject) => {
         tx.oncomplete = () => resolve();
         tx.onerror = () => reject(tx.error);

         storeNames.forEach(storeName => {
            if (data.hasOwnProperty(storeName)) {
                const store = tx.objectStore(storeName);
                store.clear();
                
                if (storeName === PARKING_STORE) {
                    if (data[storeName]) {
                        store.put(data[storeName], PARKING_INFO_KEY);
                    }
                } else if (Array.isArray(data[storeName])) {
                    data[storeName].forEach((item: any) => {
                        store.put(item);
                    });
                }
            }
         });
    });
};

// Initialize DB on script load to be ready for app
getDb();