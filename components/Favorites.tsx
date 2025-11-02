import React from 'react';
import { Activity, StoreResult, Place, RoutePlace } from '../types';
import ActivityCard from './common/ActivityCard';
import StoreCard from './common/StoreCard';
import PlaceCard from './common/PlaceCard';
import RoutePlaceCard from './common/RoutePlaceCard';
import { HeartCrack, PartyPopper, Store, Utensils, Route as RouteIcon } from 'lucide-react';

interface FavoritesProps {
    favorites?: Activity[];
    onToggleFavorite?: (activity: Activity) => void;
    favoriteStores?: StoreResult[];
    onToggleFavoriteStore?: (store: StoreResult) => void;
    favoritePlaces?: Place[];
    onToggleFavoritePlace?: (place: Place) => void;
    favoriteRoutePlaces?: RoutePlace[];
    onToggleFavoriteRoutePlace?: (place: RoutePlace) => void;
}

const Favorites: React.FC<FavoritesProps> = ({
    favorites = [],
    onToggleFavorite = () => {},
    favoriteStores = [],
    onToggleFavoriteStore = () => {},
    favoritePlaces = [],
    onToggleFavoritePlace = () => {},
    favoriteRoutePlaces = [],
    onToggleFavoriteRoutePlace = () => {},
}) => {
    const allFavorites = [...favorites, ...favoriteStores, ...favoritePlaces, ...favoriteRoutePlaces];

    if (allFavorites.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                <HeartCrack className="w-20 h-20 text-gray-400 dark:text-gray-500 mb-4" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">لا يوجد شيء في المفضلة بعد</h2>
                <p className="text-gray-600 dark:text-gray-400">استكشف التطبيق وأضف الأماكن والأنشطة التي تعجبك!</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-8">
            {favoritePlaces.length > 0 && (
                <section>
                    <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                        <Utensils className="text-blue-500" />
                        الأماكن المفضلة
                    </h2>
                    <div className="space-y-4">
                        {favoritePlaces.map((place, index) => (
                            <PlaceCard
                                key={place.mapsLink || index}
                                place={place}
                                isFavorite={true}
                                onToggleFavorite={onToggleFavoritePlace}
                            />
                        ))}
                    </div>
                </section>
            )}

            {favoriteStores.length > 0 && (
                <section>
                    <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                        <Store className="text-purple-500" />
                        المتاجر المفضلة
                    </h2>
                    <div className="space-y-4">
                        {favoriteStores.map((store, index) => (
                             <StoreCard
                                key={store.mapsLink || index}
                                item={store}
                                isFavorite={true}
                                onToggleFavorite={onToggleFavoriteStore}
                            />
                        ))}
                    </div>
                </section>
            )}

             {favorites.length > 0 && (
                <section>
                    <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                        <PartyPopper className="text-pink-500" />
                        الأنشطة المفضلة
                    </h2>
                    <div className="space-y-4">
                        {favorites.map((activity, index) => (
                            <ActivityCard
                                key={activity.mapsLink || index}
                                activity={activity}
                                isFavorite={true}
                                onToggleFavorite={onToggleFavorite}
                            />
                        ))}
                    </div>
                </section>
            )}

            {favoriteRoutePlaces.length > 0 && (
                <section>
                    <h2 className="flex items-center gap-3 text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                        <RouteIcon className="text-orange-500" />
                        محطات التوقف المفضلة
                    </h2>
                    <div className="space-y-4">
                        {favoriteRoutePlaces.map((place, index) => (
                            <RoutePlaceCard
                                key={place.mapsLink || index}
                                place={place}
                                isFavorite={true}
                                onToggleFavorite={onToggleFavoriteRoutePlace}
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default Favorites;
