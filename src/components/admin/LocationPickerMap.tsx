'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-geosearch/dist/geosearch.css';
import L from 'leaflet';
import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';

// Fix Leaflet default icon issue in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number, address?: string) => void;
}

function LocationMarker({ lat, lng, onChange }: Props) {
  const map = useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    }
  });

  useEffect(() => {
    map.flyTo([lat, lng], 17, {
      animate: true,
      duration: 1.5
    });
  }, [lat, lng, map]);

  return <Marker position={[lat, lng]} />;
}

function SearchField({ onChange }: { onChange: (lat: number, lng: number, address?: string) => void }) {
  const map = useMap();

  useEffect(() => {
    const provider = new OpenStreetMapProvider({
      params: {
        countrycodes: 'in', // Limit results to India
        addressdetails: 1,
      },
    });

    const searchControl = GeoSearchControl({
      provider: provider,
      style: 'bar',
      showMarker: false,
      showPopup: false,
      autoClose: true,
      retainZoomLevel: false,
      animateZoom: true,
      keepResult: true,
      searchLabel: 'Search places in India...',
      updateMap: true,
    });

    map.addControl(searchControl);
    
    // Type any because leaflet-geosearch types don't officially expose the exact event args here
    map.on('geosearch/showlocation', (result: any) => {
      if (result && result.location) {
        onChange(result.location.y, result.location.x, result.location.label);
      }
    });

    return () => {
      map.removeControl(searchControl);
    };
  }, [map, onChange]);

  return null;
}

export default function LocationPickerMap({ lat, lng, onChange }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Force leaflet to recalculate its container size after a short delay
    // to fix the grey tile issue where tiles don't load initially in Next.js
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 500);
  }, []);

  if (!mounted) return <div className="h-[250px] w-full bg-[#070402] border border-[#302117] rounded-xl flex items-center justify-center text-xs text-[#d4c4b0]/50 font-mono">Loading Map...</div>;

  return (
    <div className="h-[250px] w-full rounded-xl overflow-hidden border border-[#302117] z-10 relative">
      <MapContainer 
        center={[lat, lng]} 
        zoom={13} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LocationMarker lat={lat} lng={lng} onChange={onChange} />
        <SearchField onChange={onChange} />
      </MapContainer>
    </div>
  );
}
