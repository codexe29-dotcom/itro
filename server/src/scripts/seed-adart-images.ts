/**
 * Assign relevant, verified imagery to ADART's equipment and tests.
 * Each of the 30 equipment items gets a subject-appropriate Unsplash photo
 * (all verified to return HTTP 200); every test inherits its equipment's image.
 * Idempotent.
 */
import { prisma } from "../db";

const url = (id: string, w = 1200) => `https://images.unsplash.com/photo-${id}?w=${w}&q=75&auto=format&fit=crop`;

// Equipment name -> Unsplash photo id (subject-matched).
const IMG: Record<string, string> = {
  "CG Measuring Setup": "1581094794329-c8112a89af12",              // engineering / measurement
  "Gust and Laminar Flow Wind Chamber": "1517976487492-5750f3195933", // sky / wind
  "Industrial Fan": "1558618666-fcd25c85cd64",                     // industrial fan
  "Optical 3D Scanner": "1581093588401-fbb62a02f120",              // lab scanning
  "Load Testing Machine": "1454779132693-e5cd0a216ed3",            // steel structure
  "Rain Setup": "1428592953211-077101b2021b",                     // rain
  "Wind Tunnel": "1436491865332-7a61a109cc05",                    // aircraft wing / aero
  "LCR Meter": "1550751827-4bd374c3f58b",                         // circuit board
  "Digital Oscilloscope": "1591370874773-6702e8f12fd8",           // oscilloscope
  "Spectrum Analyser": "1518770660439-4636190af475",              // EMI / circuitry
  "Charging Stations": "1620714223084-8fcacc6dfd8d",              // battery
  "Environment Chamber": "1581091226825-a6a2a5aee158",            // lab chamber
  "Water Chamber": "1527482797697-8795b05a13fe",                  // water immersion
  "PTTR": "1451187580459-43490279c0fa",                          // RF / telemetry
  "Specialized Environmental Chamber": "1610552050890-fe99536c2615", // thermal
  "Temperature Chamber": "1610552050890-fe99536c2615",            // thermal
  "Dust Chamber": "1509316785289-025f5b846b35",                  // dust / sand
  "Cath Chamber": "1610375461246-83df859d849d",                  // corrosion / rust
  "Coordinate Measuring Machine (CMM)": "1581092160562-40aa08e78837", // metrology
  "Multi-axis Testing Facility": "1581092918056-0c4c3acd3789",    // structural rig
  "Torque Sensor": "1537462715879-360eeb61a0ad",                 // mechanical / engine
  "Sound Meter": "1516280440614-37939bbacd81",                   // acoustic
  "Scanning Electron Microscope": "1576086213369-97a306d36557",   // microscope
  "Launch and Recovery Systems": "1508614589041-895b88991e3e",    // drone launch
  "High Speed Cameras": "1516035069371-29a1b244cc32",            // camera
  "2D/Doppler Radars": "1451187580459-43490279c0fa",             // radar
  "Electro-Optics Tracking Systems": "1473968512647-3e447244af8f", // drone / optics
  "Vibration Table": "1565891741441-64926e441838",               // materials / metal
  "Anechoic Chamber": "1518770660439-4636190af475",              // EMI / RF
  "Test Fixtures": "1518186285589-2f7649de83e0",                 // workshop tools
};
const FALLBACK = "1581091226825-a6a2a5aee158";

async function main() {
  const inst = await prisma.institution.findUnique({ where: { slug: "adart" } });
  if (!inst) throw new Error("ADART not found");

  // 1) Equipment images
  const instruments = await prisma.instrument.findMany({ where: { facility: { institutionId: inst.id } }, select: { id: true, name: true } });
  let instCount = 0;
  for (const i of instruments) {
    await prisma.instrument.update({ where: { id: i.id }, data: { images: [url(IMG[i.name] ?? FALLBACK)], imageUrl: url(IMG[i.name] ?? FALLBACK) } });
    instCount++;
  }

  // 2) Test (service) images — inherit the mapped equipment's photo.
  const services = await prisma.service.findMany({ where: { institutionId: inst.id }, select: { id: true, name: true, instrument: { select: { name: true } } } });
  let svcCount = 0;
  for (const s of services) {
    const id = IMG[s.instrument?.name ?? ""] ?? FALLBACK;
    await prisma.service.update({ where: { id: s.id }, data: { images: [url(id)] } });
    svcCount++;
  }

  const distinct = new Set(Object.values(IMG)).size;
  console.log(`ADART imagery updated: ${instCount} instruments, ${svcCount} tests, ${distinct} distinct photos.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
