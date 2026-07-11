'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { OrderDocument } from '@/lib/types';

// Unassigned / Ready Icon (Grey)
const unassignedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Assigned / Dispatched Icon (Blue)
const assignedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom icon for selected orders
const selectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapComponentProps {
  orders: OrderDocument[];
  selectedOrderIds: Set<string>;
  onToggleSelection: (orderId: string) => void;
  center?: [number, number];
}

function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
    // Force a size recalculation to prevent gray map bug when container size changes/mounts
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
    setTimeout(() => {
      map.invalidateSize();
    }, 500);
  }, [center, map]);
  return null;
}

export default function MapComponent({ orders, selectedOrderIds, onToggleSelection, center = [28.3639, 75.5869] }: MapComponentProps) {
  
  // Calculate center based on orders if available
  const mapCenter = orders.length > 0 && orders[0].delivery_coordinates
    ? [orders[0].delivery_coordinates.lat, orders[0].delivery_coordinates.lng] as [number, number]
    : center;

  return (
    <div className="w-full h-[300px] rounded-2xl overflow-hidden border-2 border-[#302117] relative z-0">
      <MapContainer center={mapCenter} zoom={15} style={{ height: '100%', width: '100%' }}>
        <MapController center={mapCenter} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
        />
        {orders.map(order => {
          if (!order.delivery_coordinates) return null;
          const isSelected = selectedOrderIds.has(order.order_id);
          const isReady = order.status === 'ready';
          
          let icon = assignedIcon;
          if (isSelected) icon = selectedIcon;
          else if (isReady) icon = unassignedIcon;
          
          return (
            <Marker 
              key={order.order_id} 
              position={[order.delivery_coordinates.lat, order.delivery_coordinates.lng]}
              icon={icon}
              eventHandlers={{
                click: () => onToggleSelection(order.order_id)
              }}
            >
              <Popup className="font-mono text-xs text-black">
                <strong>#{order.order_id}</strong><br/>
                {order.items.length} Items<br/>
                {isReady ? 'Available (Suggest to Manager)' : isSelected ? 'Selected for route' : 'Assigned to you (Tap to select)'}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
