// Lightweight city → coordinates map for the "near me" location filter.
// Used to pass lat/lng to distance-aware endpoints (similar services, AI search).
export interface City { name: string; lat: number; lng: number; }

export const CITIES: City[] = [
  { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  { name: "Coimbatore", lat: 11.0168, lng: 76.9558 },
  { name: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  { name: "Pune", lat: 18.5204, lng: 73.8567 },
];

export const findCity = (name?: string) => CITIES.find((c) => c.name === name);

export function formatDistance(km: number | null | undefined): string {
  if (km == null) return "-";
  if (km < 1) return "<1 km";
  if (km < 100) return `${Math.round(km)} km`;
  return `${Math.round(km / 10) * 10} km`;
}

/** Great-circle distance (km) between two lat/lng points, or null if any is missing. */
export function haversineKm(
  lat1?: number | null, lng1?: number | null,
  lat2?: number | null, lng2?: number | null,
): number | null {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null;
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
