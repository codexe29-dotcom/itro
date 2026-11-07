/**
 * Assign relevant, verified imagery to IIT Guwahati CIF's instruments and services.
 * Each instrument gets a subject-matched Unsplash photo (all verified HTTP 200);
 * every service inherits its instrument's photo. Idempotent.
 */
import { prisma } from "../db";

const url = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;

// Instrument name -> Unsplash photo id (subject-matched; all verified 200).
const IMG: Record<string, string> = {
  "Field Emission Scanning Electron Microscope (Gemini)": "1576086213369-97a306d36557", // microscope
  "Field Emission Scanning Electron Microscope (Sigma 300)": "1567427017947-545c5f8d16ad", // science / imaging
  "Atomic Force Microscope": "1567427017947-545c5f8d16ad",                     // nano science
  "Field Emission Transmission Electron Microscope": "1576086213369-97a306d36557", // microscope
  "Nuclear Magnetic Resonance Spectrometer (600 MHz)": "1581091226825-a6a2a5aee158", // lab instrument
  "Electron Spin Resonance Spectrometer": "1554475901-4538ddfbccc2",           // spectroscopy lab
  "Laser Micro Raman System": "1567427017947-545c5f8d16ad",                    // laser / optics science
  "High Temperature DSC / TG System": "1581091226825-a6a2a5aee158",            // thermal analysis lab
  "High Temperature Gel Permeation Chromatograph": "1582719478250-c89cae4dc85b", // chromatography / tubes
  "Vibrating Sample Magnetometer": "1565891741441-64926e441838",               // materials / magnetism
  "MALDI-TOF Mass Spectrometer": "1532094349884-543bc11b234d",                 // mass spec / pipette lab
  "Universal Testing Machine (250 kN Servo Hydraulic)": "1454779132693-e5cd0a216ed3", // steel / mechanical
  "Time Resolved Fluorimeter (Picosecond)": "1567427017947-545c5f8d16ad",      // optics / laser science
  "Universal Testing Machine (5 kN Electromechanical)": "1565891741441-64926e441838", // materials testing
  "Surface Area & Pore Size Analyzer": "1567427017947-545c5f8d16ad",           // powders / porosity science
  "X-Ray Diffractometer": "1581092160562-40aa08e78837",                        // diffraction / precision
  "Single Crystal X-Ray Diffractometer": "1581092160562-40aa08e78837",         // crystallography
  "Impedance and Material Analyzer": "1518770660439-4636190af475",             // electronics / impedance
  "Isothermal Titration Calorimeter": "1532094349884-543bc11b234d",            // calorimetry / biochem lab
  "X-Ray Photoelectron Spectrometer": "1550751827-4bd374c3f58b",               // surface / electronics
  "Inductively Coupled Plasma Mass Spectrometer": "1582719478250-c89cae4dc85b", // elemental / solutions
  "CHNSO Elemental Analyzer": "1554475901-4538ddfbccc2",                        // elemental chemistry
  "High-Resolution Mass Spectrometer": "1532094349884-543bc11b234d",           // mass spec lab
};
const FALLBACK = "1581091226825-a6a2a5aee158";

async function main() {
  const inst = await prisma.institution.findUnique({ where: { slug: "iit-guwahati-cif" } });
  if (!inst) throw new Error("IIT Guwahati CIF not found — run seed-iitg first.");

  const instruments = await prisma.instrument.findMany({ where: { facility: { institutionId: inst.id } }, select: { id: true, name: true } });
  let instCount = 0;
  for (const i of instruments) {
    const id = IMG[i.name] ?? FALLBACK;
    await prisma.instrument.update({ where: { id: i.id }, data: { images: [url(id)], imageUrl: url(id) } });
    instCount++;
  }

  const services = await prisma.service.findMany({ where: { institutionId: inst.id }, select: { id: true, instrument: { select: { name: true } } } });
  let svcCount = 0;
  for (const s of services) {
    const id = IMG[s.instrument?.name ?? ""] ?? FALLBACK;
    await prisma.service.update({ where: { id: s.id }, data: { images: [url(id)] } });
    svcCount++;
  }

  const distinct = new Set(Object.values(IMG)).size;
  console.log(`IIT Guwahati CIF imagery updated: ${instCount} instruments, ${svcCount} services, ${distinct} distinct photos.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
