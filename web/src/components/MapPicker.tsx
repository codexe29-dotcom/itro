import { useEffect, useRef } from "react";
import L from "leaflet";
import { configureLeafletIcon } from "./leafletIcon";

interface MapPickerProps {
  lat?: number;
  lng?: number;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}

// India centroid - sensible default when no coordinates are set yet.
const DEFAULT_CENTER: [number, number] = [22.35, 78.66];
const DEFAULT_ZOOM = 4;
const SET_ZOOM = 13;

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export default function MapPicker({ lat, lng, onChange, height = 320 }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // Keep a live ref to onChange so the map's event handlers always call the
  // latest callback without needing to rebind the map.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const hasCoords =
    typeof lat === "number" && !Number.isNaN(lat) &&
    typeof lng === "number" && !Number.isNaN(lng);

  // Initialize the map once.
  useEffect(() => {
    configureLeafletIcon();
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] = hasCoords ? [lat!, lng!] : DEFAULT_CENTER;
    const zoom = hasCoords ? SET_ZOOM : DEFAULT_ZOOM;

    const map = L.map(containerRef.current).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    if (hasCoords) {
      markerRef.current = L.marker([lat!, lng!], { draggable: true }).addTo(map);
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLatLng();
        onChangeRef.current(round(p.lat), round(p.lng));
      });
    }

    map.on("click", (e: L.LeafletMouseEvent) => {
      const { lat: clat, lng: clng } = e.latlng;
      onChangeRef.current(round(clat), round(clng));
    });

    mapRef.current = map;

    // Ensure tiles size correctly if rendered inside a card that just laid out.
    setTimeout(() => map.invalidateSize(), 0);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync marker + view when lat/lng change from outside (e.g. manual inputs).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (hasCoords) {
      const pos: [number, number] = [lat!, lng!];
      if (markerRef.current) {
        markerRef.current.setLatLng(pos);
      } else {
        markerRef.current = L.marker(pos, { draggable: true }).addTo(map);
        markerRef.current.on("dragend", () => {
          const p = markerRef.current!.getLatLng();
          onChangeRef.current(round(p.lat), round(p.lng));
        });
      }
      map.setView(pos, Math.max(map.getZoom(), SET_ZOOM));
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="w-full overflow-hidden rounded-lg border border-surface-border"
    />
  );
}
