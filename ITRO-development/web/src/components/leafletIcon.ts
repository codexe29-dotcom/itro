// Fix the well-known Vite/Leaflet default marker-icon issue: the default icon
// URLs point at paths that don't exist after bundling, so pins never render.
// We import the icon assets explicitly and register them once.
import L from "leaflet";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

let configured = false;

export function configureLeafletIcon() {
  if (configured) return;
  configured = true;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
  });
}
