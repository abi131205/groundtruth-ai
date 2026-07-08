"use client";

import React, { useEffect, useRef } from "react";

interface Clinic {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  statusDay1: string;
  statusDay14: string;
  doctors: number;
  nurses: number;
  amoxicillin: number;
}

interface MapComponentProps {
  clinics: Clinic[];
  selectedClinic: string | null;
  setSelectedClinic: (id: string | null) => void;
  selectedDay: number;
  getStatusColor: (status: string) => string;
}

export default function MapComponent({
  clinics,
  selectedClinic,
  setSelectedClinic,
  selectedDay,
  getStatusColor
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const LRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let active = true;

    // Dynamically inject Leaflet CSS to prevent build issues
    if (!document.getElementById("leaflet-cdn-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-cdn-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Dynamic import of Leaflet
    import("leaflet").then((L) => {
      if (!active) return;
      LRef.current = L;

      // Initialize map instance if it doesn't exist
      if (!mapInstanceRef.current && mapContainerRef.current) {
        const map = L.map(mapContainerRef.current).setView([19.0, 74.0], 9.5);
        
        L.tileLayer("https://{s}.tile.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          attribution: '© OpenStreetMap contributors © CARTO',
          maxZoom: 18
        }).addTo(map);

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;
      if (!map) return;

      // Clear existing markers
      Object.keys(markersRef.current).forEach((key) => {
        markersRef.current[key].remove();
      });
      markersRef.current = {};

      const markerGroup: any[] = [];

      clinics.forEach((clinic) => {
        const status = selectedDay === 1 ? clinic.statusDay1 : clinic.statusDay14;
        const color = getStatusColor(status);
        const isSelected = selectedClinic === clinic.id;

        // Circle markers look sleek and modern
        const marker = L.circleMarker([clinic.lat, clinic.lon], {
          radius: isSelected ? 15 : 10,
          fillColor: color,
          color: "#ffffff",
          weight: isSelected ? 3 : 2,
          opacity: 1,
          fillOpacity: 0.95
        }).addTo(map);

        // Tooltip displaying clinic name & status
        marker.bindTooltip(`
          <div style="font-family: var(--font-family-sans); font-size: 0.8rem; padding: 2px;">
            <strong>${clinic.name}</strong> (${clinic.type})<br/>
            Status: <span style="color: ${color}; font-weight: bold;">${status.toUpperCase()}</span>
          </div>
        `, {
          permanent: false,
          direction: "top",
          className: "custom-map-tooltip"
        });

        // Click handler to select clinic
        marker.on("click", () => {
          setSelectedClinic(clinic.id);
        });

        markersRef.current[clinic.id] = marker;
        markerGroup.push(marker);
      });

      // Fit map boundary to markers once on initialization
      if (markerGroup.length > 0 && !(map as any)._hasFitBounds) {
        const group = L.featureGroup(markerGroup);
        map.fitBounds(group.getBounds().pad(0.2));
        (map as any)._hasFitBounds = true;
      }
    });

    return () => {
      active = false;
      // Clean up map on component unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [clinics, getStatusColor]); // Only reinitialize if clinics or style rules change

  // Separate effect to handle day timeline and clinic selection updates
  useEffect(() => {
    const L = LRef.current;
    const map = mapInstanceRef.current;
    if (!L || !map) return;

    clinics.forEach((clinic) => {
      const marker = markersRef.current[clinic.id];
      if (marker) {
        const status = selectedDay === 1 ? clinic.statusDay1 : clinic.statusDay14;
        const color = getStatusColor(status);
        const isSelected = selectedClinic === clinic.id;

        marker.setStyle({
          radius: isSelected ? 15 : 10,
          fillColor: color,
          weight: isSelected ? 3 : 2
        });

        if (isSelected) {
          // Bring selected marker to front
          marker.bringToFront();
          
          // Pan to clinic if clicked/selected
          map.panTo([clinic.lat, clinic.lon], { animate: true });
        }
      }
    });
  }, [selectedClinic, selectedDay, clinics, getStatusColor]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ height: "100%", width: "100%", zIndex: 1 }} 
      className="leaflet-map-element"
    />
  );
}
