import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { branches, isKosherClosedForShabat } from '../data/branches';
import logoImg from '../images/logo supermarket.webp';

export default function BranchMap({ activeBranchId, onSelectBranch }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Center coordinates for Buenos Aires
    const defaultCenter = [-34.595, -58.435];
    const defaultZoom = 12;

    // 1. Initialize Map
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: defaultZoom,
      scrollWheelZoom: true, // Enables zoom with mouse scroll wheel
    });

    // 2. Add Tile Layer (Google Maps Roadmap - includes standard colors and street direction arrows)
    L.tileLayer('https://{s}.google.com/vt/lyrs=m&hl=es&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps'
    }).addTo(map);

    mapInstanceRef.current = map;

    // 3. Add Custom Markers
    branches.forEach((branch) => {
      const isClosedForShabat = branch.isKosher && isKosherClosedForShabat();

      // Custom HTML Marker: Pulsing ring and store logo image circular crop with bottom pointed tip
      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div class="marker-pulse-wrapper ${isClosedForShabat ? 'shabat-marker' : ''}">
            <div class="marker-pulse-ring ${isClosedForShabat ? 'shabat-ring' : ''}"></div>
            <div class="marker-pin-inner ${isClosedForShabat ? 'shabat-pin' : ''}">
              <img src="${logoImg}" alt="${branch.nombre}" class="marker-logo-img" />
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 38],
        popupAnchor: [0, -38]
      });

      const marker = L.marker([branch.coordenadas.lat, branch.coordenadas.lng], { icon: customIcon })
        .addTo(map);

      // Store marker references to trigger view changes programmatically
      markersRef.current[branch.id] = marker;

      // Handle marker click to sync list selection
      marker.on('click', () => {
        onSelectBranch(branch.id);
      });
    });

    // Cleanup map on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markersRef.current = {};
    };
  }, [onSelectBranch]);

  // 4. Update Map view on active branch change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !activeBranchId) return;

    const branch = branches.find((b) => b.id === activeBranchId);
    if (!branch) return;

    // Fly to coordinates with moderate zoom
    map.setView([branch.coordenadas.lat, branch.coordenadas.lng], 15, {
      animate: true,
      duration: 1.2
    });

    // Centering complete, no popup opened as requested
  }, [activeBranchId]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainerRef} className="leaflet-map-container" />
    </div>
  );
}
