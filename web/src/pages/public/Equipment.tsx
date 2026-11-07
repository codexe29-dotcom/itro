import Catalog from "@/pages/public/Exchange";

// /equipment is an alias into the unified Catalog, opened on the Equipment tab.
export default function Equipment() {
  return <Catalog defaultTab="equipment" />;
}
