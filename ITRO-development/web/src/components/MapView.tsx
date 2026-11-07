import { useEffect, useRef } from "react";
import L from "leaflet";
import { configureLeafletIcon } from "./leafletIcon";

interface MapViewProps {
  lat: number;
  lng: number;
  label?: string;
  height?: number;
}

// Read-only Leaflet map with a single marker + optional popup label.
export default function MapView({ lat, lng, label, height = 280 }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    configureLeafletIcon();
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      scrollWheelZoom: false,
    }).setView([lat, lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([lat, lng]).addTo(map);
    if (label) marker.bindPopup(label);

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recenter if coordinates change.
  useEffect(() => {
    if (mapRef.current) mapRef.current.setView([lat, lng], mapRef.current.getZoom());
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full overflow-hidden rounded-lg border border-surface-border"
    />
  );
}
