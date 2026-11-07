import {
  Plane, Car, HeartPulse, Cpu, Zap, Factory, GraduationCap, Bot,
  FlaskConical, Cog, Boxes, Microscope, Gauge, Waves, type LucideIcon,
} from "lucide-react";

// Resolves the `icon` string key stored on an Industry/Technology (backend) to a component.
const ICONS: Record<string, LucideIcon> = {
  Plane, Car, HeartPulse, Cpu, Zap, Factory, GraduationCap, Bot, FlaskConical,
  Cog, Boxes, Microscope, Gauge, Waves,
};

export function iconFor(key?: string | null): LucideIcon {
  return (key && ICONS[key]) || FlaskConical;
}
