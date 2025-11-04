import React from 'react';

interface MapViewProps {
  query: string;
  location: { lat: number; lon: number };
}

const MapView: React.FC<MapViewProps> = ({ query, location }) => {
  const encodedQuery = encodeURIComponent(query);
  // By adding "+near+lat,lon" to the query and keeping the ll parameter,
  // we instruct Google Maps to center on the user's location while showing the search pins.
  const mapSrc = `https://maps.google.com/maps?q=${encodedQuery}+near+${location.lat},${location.lon}&ll=${location.lat},${location.lon}&z=13&output=embed&t=m`;

  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg border-2 border-gray-200 dark:border-gray-700">
      <iframe
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={mapSrc}
        title={`Map for ${query}`}
      ></iframe>
    </div>
  );
};

export default MapView;
