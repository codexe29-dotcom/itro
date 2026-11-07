import {
  Microscope, Atom, Scan, Gauge, Zap, FlaskConical, Waves, Layers,
  Cog, Boxes, Cpu, TestTube, type LucideIcon,
} from "lucide-react";

// Maps an instrument/service category to an icon + short blurb for the marketing UI.
const MAP: Record<string, { icon: LucideIcon; blurb: string }> = {
  SEM: { icon: Microscope, blurb: "Surface imaging & EDS" },
  TEM: { icon: Atom, blurb: "Nanoscale imaging & diffraction" },
  XRD: { icon: Scan, blurb: "Crystalline phase analysis" },
  UTM: { icon: Gauge, blurb: "Tensile & mechanical testing" },
  Fatigue: { icon: Waves, blurb: "Cyclic & fatigue life" },
  NMR: { icon: Atom, blurb: "Structure elucidation" },
  "GC-MS": { icon: TestTube, blurb: "Compound identification" },
  FTIR: { icon: Zap, blurb: "Functional-group analysis" },
  Rheometer: { icon: Waves, blurb: "Viscosity & rheology" },
  CNC: { icon: Cog, blurb: "Precision machining" },
  "3D Metal Printer": { icon: Boxes, blurb: "Metal additive manufacturing" },
};

export function categoryMeta(category: string) {
  return MAP[category] ?? { icon: Layers, blurb: "Testing & analysis" };
}

export const fallbackIcons = [Microscope, Cog, FlaskConical, Cpu, Boxes, Scan];
