import {
  Cog, Boxes, Microscope, Gauge, FlaskConical, Waves,
  Plane, Car, HeartPulse, Cpu, Zap, Factory, GraduationCap, Bot,
  type LucideIcon,
} from "lucide-react";

// Technology areas - group the fine-grained instrument categories into
// buyer-facing "technologies" (Xometry-style). `categories` map to exchange filters.
export interface TechArea { key: string; slug: string; title: string; icon: LucideIcon; blurb: string; categories: string[]; }

export const TECH_AREAS: TechArea[] = [
  { key: "machining", slug: "precision-machining", title: "Precision Machining", icon: Cog,
    blurb: "3, 4 & 5-axis CNC milling, turning and prototyping.", categories: ["CNC"] },
  { key: "additive", slug: "additive-manufacturing", title: "Additive Manufacturing", icon: Boxes,
    blurb: "Metal & polymer 3D printing, DMLS/SLM parts.", categories: ["3D Metal Printer"] },
  { key: "microscopy", slug: "microscopy-imaging", title: "Microscopy & Imaging", icon: Microscope,
    blurb: "SEM, TEM, EDS and nanoscale characterization.", categories: ["SEM", "TEM"] },
  { key: "materials", slug: "materials-characterization", title: "Materials Characterization", icon: FlaskConical,
    blurb: "XRD phase analysis, FTIR, thermal & structural.", categories: ["XRD", "FTIR"] },
  { key: "mechanical", slug: "mechanical-testing", title: "Mechanical Testing", icon: Gauge,
    blurb: "Tensile, hardness, fatigue and failure analysis.", categories: ["UTM", "Fatigue"] },
  { key: "chemical", slug: "chemical-molecular", title: "Chemical & Molecular", icon: Waves,
    blurb: "NMR, GC-MS, spectroscopy and compound ID.", categories: ["NMR", "GC-MS", "Rheometer"] },
];

// Industry domains served (Xometry-style "industries"). `slug` links to the
// dedicated /industries/:slug landing page (content served from /api/industries).
export interface Industry { slug: string; title: string; icon: LucideIcon; blurb: string; }
export const INDUSTRIES: Industry[] = [
  { slug: "aerospace-defense", title: "Aerospace & Defense", icon: Plane, blurb: "Alloy qualification, NDT, fatigue & failure analysis." },
  { slug: "automotive-ev", title: "Automotive & EV", icon: Car, blurb: "Component testing, materials, battery & durability." },
  { slug: "medical-life-sciences", title: "Medical & Life Sciences", icon: HeartPulse, blurb: "Biocompatibility, imaging and analytical services." },
  { slug: "electronics-semiconductors", title: "Electronics & Semiconductors", icon: Cpu, blurb: "Failure analysis, cross-section, surface metrology." },
  { slug: "energy-power", title: "Energy & Power", icon: Zap, blurb: "Coatings, corrosion, materials for harsh environments." },
  { slug: "industrial-manufacturing", title: "Industrial & Manufacturing", icon: Factory, blurb: "QA/QC, prototyping, tolerance & dimensional checks." },
  { slug: "academia-research", title: "Academia & Research", icon: GraduationCap, blurb: "Shared access to advanced instrumentation." },
  { slug: "robotics-drones", title: "Robotics & Drones", icon: Bot, blurb: "Lightweighting, additive parts, structural testing." },
];
