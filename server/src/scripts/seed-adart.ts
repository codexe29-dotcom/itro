/**
 * Seed the ADART provider with its real equipment (30 instruments) and
 * test catalogue (75 tests → Services), with pricing from the ADART DTI
 * Test Catalogue and business plan. Idempotent: safe to re-run.
 *
 * Source: adart.in/testing.html + ADART_DTI_Test_Catalogue_Final.xlsx +
 *         ADART_Business_Plan_240426.docx.
 * Pricing: catalogue "Cost / Test (INR Lakhs)" → priceIndustry (× 100,000).
 *          Academic = 85%, Internal = 65% (tiered defaults).
 */
import { prisma } from "../db";
import { Prisma } from "@prisma/client";

const SLUG = "adart";

// ---- 30 equipment items (instruments) ----------------------------------
// [name, category(domain), make/model note, short description]
const EQUIPMENT: { name: string; category: string; desc: string; weightEnvelope?: boolean; dims?: [number, number, number] }[] = [
  { name: "CG Measuring Setup", category: "Mass Properties", desc: "Determines centre of gravity, mass distribution and moment of inertia of UAS airframes and payloads.", weightEnvelope: true },
  { name: "Gust and Laminar Flow Wind Chamber", category: "Aerodynamics", desc: "Generates controlled gust and laminar flow profiles for crosswind, hover-stability and gust-recovery testing.", weightEnvelope: true },
  { name: "Industrial Fan", category: "Airflow", desc: "High-volume forced-air rig for cooling-performance and propulsion-downwash airflow evaluation." },
  { name: "Optical 3D Scanner", category: "Metrology", desc: "Structured-light 3D scanner for surface profiling, as-built-vs-CAD deviation and warpage inspection." },
  { name: "Load Testing Machine", category: "Structural", desc: "Universal load frame for proof, tensile, compression and landing-gear ultimate-load testing.", weightEnvelope: true },
  { name: "Rain Setup", category: "Environmental", desc: "Rain-ingress and driving/blowing-rain rig for IPX3/IPX4 and MIL-STD-810H water tests.", weightEnvelope: true },
  { name: "Wind Tunnel", category: "Aerodynamics", desc: "Subsonic wind tunnel for lift/drag, airfoil mapping, propeller thrust and stability testing.", dims: [1800, 1200, 2000], weightEnvelope: true },
  { name: "LCR Meter", category: "Electrical", desc: "Precision inductance/capacitance/resistance and component-impedance characterisation." },
  { name: "Digital Oscilloscope", category: "Electrical", desc: "High-bandwidth scope for signal integrity, power-rail ripple and ESC/PWM verification." },
  { name: "Spectrum Analyser", category: "EMI/EMC", desc: "RF spectrum analyser for radiated/conducted emissions and harmonics (MIL-STD-461)." },
  { name: "Charging Stations", category: "Power", desc: "Programmable charge/discharge stations for battery cycle, efficiency and thermal testing." },
  { name: "Environment Chamber", category: "Environmental", desc: "Temperature-humidity-altitude chamber for combined environmental conditioning (MIL-STD-810H).", weightEnvelope: true },
  { name: "Water Chamber", category: "Environmental", desc: "Immersion tank for IPX7 immersion and IPX8 continuous-submersion / leak testing.", weightEnvelope: true },
  { name: "PTTR", category: "RF/Comms", desc: "Portable telemetry & data-link test range for range, latency and link-integrity testing." },
  { name: "Specialized Environmental Chamber", category: "Environmental", desc: "Thermal-shock, ESS and solar-radiation chamber for accelerated environmental screening.", weightEnvelope: true },
  { name: "Temperature Chamber", category: "Environmental", desc: "High/low-temperature operating and storage-soak chamber (MIL-STD-810H 501/502).", weightEnvelope: true },
  { name: "Dust Chamber", category: "Environmental", desc: "Dust/sand ingress chamber for IP5X, IP6X and blowing-dust testing.", weightEnvelope: true },
  { name: "Cath Chamber", category: "Corrosion", desc: "Salt-fog / cathodic-corrosion chamber (MIL-STD-810H 509 / ASTM B117)." },
  { name: "Coordinate Measuring Machine (CMM)", category: "Metrology", desc: "GD&T dimensional inspection and high-precision coordinate measurement." },
  { name: "Multi-axis Testing Facility", category: "Structural", desc: "Multi-axis rig for fatigue, combined bending+torsion and flight-load-spectrum endurance.", weightEnvelope: true },
  { name: "Torque Sensor", category: "Mechanical", desc: "Rotary torque measurement for motor/rotor torque and drive-shaft endurance." },
  { name: "Sound Meter", category: "Acoustic", desc: "Class-1 sound level meter for acoustic noise and propeller noise-signature testing (IEC 61672)." },
  { name: "Scanning Electron Microscope", category: "Failure Analysis", desc: "SEM for fracture-surface, microstructure and material composition failure analysis." },
  { name: "Launch and Recovery Systems", category: "Dynamic Flight", desc: "Catapult/pneumatic launch and net/arrested-recovery test system." },
  { name: "High Speed Cameras", category: "Dynamic Flight", desc: "High-speed motion capture for deployment, flight-dynamics and trajectory analysis." },
  { name: "2D/Doppler Radars", category: "RF/Comms", desc: "2D/Doppler radar for tracking, position accuracy and velocity/Doppler-signature testing." },
  { name: "Electro-Optics Tracking Systems", category: "Dynamic Flight", desc: "EO/IR tracking systems for target tracking and optical trajectory analysis." },
  { name: "Vibration Table", category: "Mechanical", desc: "Electrodynamic shaker for random-vibration, sine-dwell and mechanical-shock (MIL-STD-810H 514/516).", weightEnvelope: true },
  { name: "Anechoic Chamber", category: "EMI/EMC", desc: "RF anechoic chamber for antenna-pattern, radiated-immunity and shielding-effectiveness testing.", weightEnvelope: true },
  { name: "Test Fixtures", category: "General Support", desc: "Custom test fixturing and mounting-validation support for bespoke test setups." },
];

// ---- 75 tests -> Services ----------------------------------------------
// [name, equipment, testCategory, referenceStandard(''=none), costLakhs]
const T = (name: string, equip: string, cat: string, std: string, lakhs: number) => ({ name, equip, cat, std, lakhs });
const TESTS = [
  T("Centre of Gravity (CG) Determination", "CG Measuring Setup", "Mass Properties", "", 2),
  T("Mass & Mass-Distribution Measurement", "CG Measuring Setup", "Mass Properties", "", 2),
  T("Moment of Inertia Measurement", "CG Measuring Setup", "Mass Properties", "", 2),
  T("Gust Response & Recovery Test", "Gust and Laminar Flow Wind Chamber", "Aerodynamics", "MIL-STD-810H 514", 3.5),
  T("Laminar Flow Profile Characterization", "Gust and Laminar Flow Wind Chamber", "Aerodynamics", "", 3.5),
  T("Crosswind Hover Stability Test", "Gust and Laminar Flow Wind Chamber", "Aerodynamics", "", 3.5),
  T("Forced-Air Cooling Performance Test", "Industrial Fan", "Thermal", "", 1.5),
  T("Propulsion Downwash Airflow Test", "Industrial Fan", "Aerodynamics", "", 1.5),
  T("Surface Profile & Geometry Inspection", "Optical 3D Scanner", "Metrology", "", 2.5),
  T("As-Built vs CAD Deviation Mapping", "Optical 3D Scanner", "Metrology", "", 2.5),
  T("Structural Deformation / Warpage Scan", "Optical 3D Scanner", "Metrology", "", 2.5),
  T("Static Proof Load Test", "Load Testing Machine", "Structural", "", 2.2),
  T("Tensile Strength Test", "Load Testing Machine", "Structural", "ASTM E8", 2.2),
  T("Compression Load Test", "Load Testing Machine", "Structural", "ASTM E9", 2.2),
  T("Landing Gear Ultimate Load Test", "Load Testing Machine", "Structural", "", 2.2),
  T("Rain Ingress Protection Test (IPX3/IPX4)", "Rain Setup", "Environmental", "IEC 60529", 3),
  T("Driving / Blowing Rain Test", "Rain Setup", "Environmental", "MIL-STD-810H 506", 3),
  T("Lift & Drag Coefficient Measurement", "Wind Tunnel", "Aerodynamics", "", 4),
  T("Airfoil / Wing Performance Mapping", "Wind Tunnel", "Aerodynamics", "", 4),
  T("Propeller Thrust & Efficiency Test", "Wind Tunnel", "Aerodynamics", "", 4),
  T("Aerodynamic Stability & Control Test", "Wind Tunnel", "Aerodynamics", "", 4),
  T("Inductance / Capacitance / Resistance Measurement", "LCR Meter", "Electrical", "", 2.5),
  T("Component Impedance Characterization", "LCR Meter", "Electrical", "", 2.5),
  T("Signal Integrity Analysis", "Digital Oscilloscope", "Electrical", "", 2.5),
  T("Power-Rail Ripple & Noise Test", "Digital Oscilloscope", "Electrical", "", 2.5),
  T("ESC / PWM Signal Verification", "Digital Oscilloscope", "Electrical", "", 2.5),
  T("Radiated Emissions Test", "Spectrum Analyser", "EMI/EMC", "MIL-STD-461 RE102", 4.2),
  T("Conducted Emissions Test", "Spectrum Analyser", "EMI/EMC", "MIL-STD-461 CE102", 4.2),
  T("RF Spectrum Occupancy & Harmonics Test", "Spectrum Analyser", "EMI/EMC", "", 4.2),
  T("Battery Charge / Discharge Cycle Test", "Charging Stations", "Power", "", 3),
  T("Charging Efficiency & Thermal Test", "Charging Stations", "Power", "", 3),
  T("Temperature-Humidity Combined Test", "Environment Chamber", "Environmental", "MIL-STD-810H 507", 3.2),
  T("Altitude / Low-Pressure Simulation Test", "Environment Chamber", "Environmental", "MIL-STD-810H 500", 3.2),
  T("Operational Humidity Test", "Environment Chamber", "Environmental", "", 3.2),
  T("Water Immersion Test (IPX7)", "Water Chamber", "Environmental", "IEC 60529", 3),
  T("Continuous Submersion / Leak Test (IPX8)", "Water Chamber", "Environmental", "IEC 60529", 3),
  T("Telemetry & Data-Link Range Test", "PTTR", "RF/Comms", "", 3.5),
  T("RF Link Latency & Integrity Test", "PTTR", "RF/Comms", "", 3.5),
  T("Thermal Shock Test", "Specialized Environmental Chamber", "Environmental", "MIL-STD-810H 503", 4),
  T("Combined Environmental Stress Screening (ESS)", "Specialized Environmental Chamber", "Environmental", "", 4),
  T("Solar Radiation (Solar Heating) Test", "Specialized Environmental Chamber", "Environmental", "MIL-STD-810H 505", 4),
  T("High-Temperature Operating Test", "Temperature Chamber", "Environmental", "MIL-STD-810H 501", 3.2),
  T("Low-Temperature Operating Test", "Temperature Chamber", "Environmental", "MIL-STD-810H 502", 3.2),
  T("Temperature Storage / Soak Test", "Temperature Chamber", "Environmental", "", 3.2),
  T("Dust Ingress Protection Test (IP5X)", "Dust Chamber", "Environmental", "IEC 60529", 2.5),
  T("Dust-Tight Test (IP6X)", "Dust Chamber", "Environmental", "IEC 60529", 2.5),
  T("Blowing Dust & Sand Test", "Dust Chamber", "Environmental", "MIL-STD-810H 510", 2.5),
  T("Salt Fog / Salt Spray Corrosion Test", "Cath Chamber", "Corrosion", "MIL-STD-810H 509 / ASTM B117", 3),
  T("Cathodic / Galvanic Corrosion Test", "Cath Chamber", "Corrosion", "", 3),
  T("GD&T Dimensional Inspection", "Coordinate Measuring Machine (CMM)", "Metrology", "", 2.2),
  T("Coordinate Precision Measurement", "Coordinate Measuring Machine (CMM)", "Metrology", "", 2.2),
  T("Multi-Axis Fatigue Test", "Multi-axis Testing Facility", "Structural", "", 2.8),
  T("Combined Load (Bending + Torsion) Test", "Multi-axis Testing Facility", "Structural", "", 2.8),
  T("Flight-Load Spectrum Endurance Test", "Multi-axis Testing Facility", "Structural", "", 2.8),
  T("Motor / Rotor Torque Measurement", "Torque Sensor", "Mechanical", "", 2),
  T("Drive-Shaft Torque Endurance Test", "Torque Sensor", "Mechanical", "", 2),
  T("Acoustic Noise Level Measurement", "Sound Meter", "Acoustic", "IEC 61672", 1.8),
  T("Propeller Noise Signature Test", "Sound Meter", "Acoustic", "", 1.8),
  T("Fracture Surface / Failure Analysis", "Scanning Electron Microscope", "Failure Analysis", "", 3.5),
  T("Material Microstructure & Composition Analysis", "Scanning Electron Microscope", "Failure Analysis", "", 3.5),
  T("Catapult / Pneumatic Launch Test", "Launch and Recovery Systems", "Dynamic Flight", "", 4.5),
  T("Net / Arrested Recovery Test", "Launch and Recovery Systems", "Dynamic Flight", "", 4.5),
  T("High-Speed Motion Capture (Deployment)", "High Speed Cameras", "Dynamic Flight", "", 4),
  T("Flight Dynamics & Trajectory Analysis", "High Speed Cameras", "Dynamic Flight", "", 4),
  T("Radar Tracking & Position Accuracy Test", "2D/Doppler Radars", "RF/Comms", "", 5),
  T("Velocity / Doppler Signature Test", "2D/Doppler Radars", "RF/Comms", "", 5),
  T("EO/IR Target Tracking Test", "Electro-Optics Tracking Systems", "Dynamic Flight", "", 4.5),
  T("Optical Trajectory Tracking Test", "Electro-Optics Tracking Systems", "Dynamic Flight", "", 4.5),
  T("Random Vibration Test", "Vibration Table", "Mechanical", "MIL-STD-810H 514", 2.3),
  T("Sine / Resonance Dwell Test", "Vibration Table", "Mechanical", "", 2.3),
  T("Mechanical Shock Test", "Vibration Table", "Mechanical", "MIL-STD-810H 516", 2.3),
  T("Antenna Radiation Pattern Test", "Anechoic Chamber", "EMI/EMC", "", 4.5),
  T("EMC Radiated Immunity Test", "Anechoic Chamber", "EMI/EMC", "MIL-STD-461 RS103", 4.5),
  T("RF Shielding Effectiveness Test", "Anechoic Chamber", "EMI/EMC", "", 4.5),
  T("Custom Test Setup & Mounting Validation", "Test Fixtures", "General Support", "", 1.5),
];

// Turnaround (working days) estimate per category.
const TURNAROUND: Record<string, number> = {
  "Mass Properties": 4, Aerodynamics: 7, Thermal: 5, Metrology: 5, Structural: 7,
  Environmental: 10, Electrical: 4, "EMI/EMC": 7, Power: 7, "RF/Comms": 7,
  Corrosion: 12, Mechanical: 7, Acoustic: 4, "Failure Analysis": 10, "Dynamic Flight": 12,
  "General Support": 3, Airflow: 4,
};
// Exact taxonomy titles (web/src/lib/taxonomy.tsx) so equipment "Applicable industries" link & filter.
const INDUSTRIES = ["Aerospace & Defense", "Robotics & Drones", "Automotive & EV", "Electronics & Semiconductors", "Energy & Power"];

// Which global-catalog industry each test category belongs to (slugs must exist in DB).
const TEST_INDUSTRY: Record<string, string> = {
  "Mass Properties": "robotics-drones", Aerodynamics: "robotics-drones", "Dynamic Flight": "robotics-drones",
  Electrical: "electronics-semiconductors", "EMI/EMC": "electronics-semiconductors", Power: "electronics-semiconductors", "RF/Comms": "electronics-semiconductors",
  Thermal: "aerospace-defense", Metrology: "aerospace-defense", Structural: "aerospace-defense", Environmental: "aerospace-defense",
  Corrosion: "aerospace-defense", Mechanical: "aerospace-defense", Acoustic: "aerospace-defense", "Failure Analysis": "aerospace-defense", "General Support": "aerospace-defense",
};
const kebab = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  const inst = await prisma.institution.findUnique({ where: { slug: SLUG } });
  if (!inst) throw new Error(`Institution '${SLUG}' not found`);

  // 1) Institution profile
  await prisma.institution.update({
    where: { id: inst.id },
    data: {
      name: "ADART",
      type: "PRIVATE_RND",
      city: "Chennai", state: "Tamil Nadu", country: "India",
      addressLine1: "Vallam Vadagal SIPCOT", addressLine2: "Tamil Nadu Defence Industrial Corridor",
      latitude: 12.9516, longitude: 79.9426,
      accreditations: ["NABL", "ISO/IEC 17025", "DGCA (empanelment)", "MIL-STD-810", "MIL-STD-461", "CEMILAC / DDP-MAS"],
      about:
        "Association for Drone Avionics Research and Testing (ADART) — India's first end-to-end DGCA " +
        "type-certification testing hub for UAS/drones, at Vallam Vadagal SIPCOT under the Tamil Nadu " +
        "Defence Industrial Corridor. 30 specialised test setups spanning environmental, EMI/EMC, mechanical, " +
        "electrical, RF, aerodynamic and dynamic-flight testing for UAS up to 400 kg. Testing to Drone Rules 2021, " +
        "MIL-STD-810H and MIL-STD-461. Applicable to aviation, defence, aerospace and automotive programmes.",
      isPublished: true, onExchange: true,
    },
  });

  // 2) Facility
  const facilityName = "ADART Drone Testing Infrastructure (DTI)";
  let facility = await prisma.facility.findFirst({ where: { institutionId: inst.id, name: facilityName } });
  if (!facility) {
    facility = await prisma.facility.create({
      data: {
        institutionId: inst.id, name: facilityName, department: "UAS Testing & Certification",
        description: "55,000 sqft facility (Hangar + Equipment Facility) with a 750 m road-cum-runway at Vallam Vadagal SIPCOT.",
        location: "Vallam Vadagal SIPCOT, Chennai, Tamil Nadu", timezone: "Asia/Kolkata",
      },
    });
  }

  // 3) Instruments (equipment) — idempotent by (facility, name)
  const instrByName = new Map<string, string>();
  let instCreated = 0, instUpdated = 0;
  for (const e of EQUIPMENT) {
    const spec: Prisma.InputJsonValue | undefined = e.weightEnvelope || e.dims
      ? {
          ...(e.dims ? { maxLengthMm: e.dims[0], maxWidthMm: e.dims[1], maxHeightMm: e.dims[2] } : {}),
          maxWeightKg: 400,
          notes: e.dims ? "Scaled or full UAS airframes; up to 400 kg" : "UAS / components up to 400 kg",
        }
      : undefined;
    const data = {
      category: e.category, description: e.desc, status: "AVAILABLE" as const,
      industries: INDUSTRIES, accreditation: "NABL", trainingRequired: true,
      ...(spec ? { maxSampleSpec: spec } : {}),
    };
    const existing = await prisma.instrument.findFirst({ where: { facilityId: facility.id, name: e.name } });
    if (existing) {
      await prisma.instrument.update({ where: { id: existing.id }, data });
      instrByName.set(e.name, existing.id); instUpdated++;
    } else {
      const created = await prisma.instrument.create({ data: { facilityId: facility.id, name: e.name, ...data } });
      instrByName.set(e.name, created.id); instCreated++;
    }
  }

  // 4) Services (tests) — idempotent by (institution, name)
  let svcCreated = 0, svcUpdated = 0;
  const serviceIdByTest = new Map<string, string>();
  for (const t of TESTS) {
    const industry = Math.round(t.lakhs * 100_000);
    const academic = Math.round(industry * 0.85);
    const internal = Math.round(industry * 0.65);
    const turnaround = TURNAROUND[t.cat] ?? 7;
    const stdClause = t.std ? ` Conducted to ${t.std}.` : "";
    const description =
      `${t.name} for UAS/drone airframes, subsystems and components (up to 400 kg), performed on the ${t.equip}.` +
      `${stdClause} Applicable to aerospace, defence, aviation and automotive programmes.`;
    const deliverable = t.std
      ? `Standard-conformance test report (PDF) to ${t.std}, with measured data`
      : "Test report (PDF) with measured data";
    const data = {
      category: t.cat, description, deliverable,
      priceIndustry: industry, priceAcademic: academic, priceInternal: internal,
      pricingMethod: "PER_TEST", unitLabel: "per test", pricingMode: "FIXED" as const,
      turnaroundDays: turnaround, rushDays: Math.max(1, Math.round(turnaround / 2)), rushSurchargePct: 40,
      accreditation: "NABL", isActive: true,
      instrumentId: instrByName.get(t.equip) ?? null,
    };
    const existing = await prisma.service.findFirst({ where: { institutionId: inst.id, name: t.name } });
    if (existing) { await prisma.service.update({ where: { id: existing.id }, data }); serviceIdByTest.set(t.name, existing.id); svcUpdated++; }
    else { const c = await prisma.service.create({ data: { institutionId: inst.id, name: t.name, ...data } }); serviceIdByTest.set(t.name, c.id); svcCreated++; }
  }

  // 4b) Catalog enrolment: a global TestDefinition per test + TestProvider linking ADART's service.
  //     Completes the "Enrol your services against catalog tests" onboarding step and makes tests
  //     browsable by industry + shown as an instrument's performable tests.
  const industryIdBySlug = new Map<string, string>();
  for (const slug of new Set(Object.values(TEST_INDUSTRY))) {
    const ind = await prisma.industry.findUnique({ where: { slug } });
    if (ind) industryIdBySlug.set(slug, ind.id);
  }
  async function uniqueSlug(base: string): Promise<string> {
    let s = base || "test";
    for (let i = 2; ; i++) { if (!(await prisma.testDefinition.findUnique({ where: { slug: s } }))) return s; s = `${base}-${i}`; }
  }
  let tdCreated = 0, tdReused = 0, tpCreated = 0;
  for (const t of TESTS) {
    const serviceId = serviceIdByTest.get(t.name);
    if (!serviceId) continue;
    const industryId = industryIdBySlug.get(TEST_INDUSTRY[t.cat] ?? "aerospace-defense");
    if (!industryId) continue;

    let td = await prisma.testDefinition.findFirst({ where: { name: t.name } });
    if (!td) {
      td = await prisma.testDefinition.create({
        data: {
          slug: await uniqueSlug(kebab(t.name)), industryId, name: t.name, category: t.cat,
          summary: `${t.name} for UAS/drone, aerospace and defence hardware.`,
          purpose: `Qualifies UAS/drone airframes, subsystems and components (up to 400 kg)${t.std ? ` to ${t.std}` : ""}.`,
          standardCodes: t.std ? t.std.split(" / ").map((x) => x.trim()) : [],
          samplesRequired: 1, deliverables: t.std ? [`Test report (PDF) to ${t.std}`, "Raw data"] : ["Test report (PDF)", "Raw data"],
          turnaroundDays: TURNAROUND[t.cat] ?? 7, accreditation: "NABL",
        },
      });
      tdCreated++;
    } else { tdReused++; }

    const link = await prisma.testProvider.findUnique({ where: { testId_serviceId: { testId: td.id, serviceId } } });
    if (!link) { await prisma.testProvider.create({ data: { testId: td.id, serviceId, isPreferred: true } }); tpCreated++; }
  }
  console.log(`  Catalog: +${tdCreated} test definitions created, ${tdReused} reused; +${tpCreated} provider enrolments.`);

  // 5) Remove leftover SAMPLE data — anything on ADART not in the real catalogue.
  const realSvc = new Set(TESTS.map((t) => t.name));
  const realInst = new Set(EQUIPMENT.map((e) => e.name));
  let svcRemoved = 0, instRemoved = 0, facRemoved = 0;

  const sampleServices = await prisma.service.findMany({ where: { institutionId: inst.id, name: { notIn: [...realSvc] } }, select: { id: true, name: true } });
  for (const s of sampleServices) {
    const orders = await prisma.serviceOrder.findMany({ where: { serviceId: s.id }, select: { id: true } });
    for (const o of orders) {
      const invs = await prisma.invoice.findMany({ where: { orderId: o.id }, select: { id: true } });
      for (const iv of invs) await prisma.payment.deleteMany({ where: { invoiceId: iv.id } });
      await prisma.invoice.deleteMany({ where: { orderId: o.id } });
      await prisma.review.deleteMany({ where: { orderId: o.id } });
      await prisma.orderEvent.deleteMany({ where: { orderId: o.id } });
      await prisma.settlement.deleteMany({ where: { orderId: o.id } });
      await prisma.capacityReservation.deleteMany({ where: { serviceOrderId: o.id } });
      await prisma.serviceOrder.delete({ where: { id: o.id } }); // cascades documents + messages
    }
    await prisma.service.delete({ where: { id: s.id } });
    svcRemoved++;
    console.log(`  removed sample service "${s.name}" (+${orders.length} order(s))`);
  }

  const sampleInstruments = await prisma.instrument.findMany({
    where: { facility: { institutionId: inst.id }, name: { notIn: [...realInst] } }, select: { id: true, name: true },
  });
  for (const i of sampleInstruments) {
    await prisma.capacityReservation.deleteMany({ where: { instrumentId: i.id } });
    await prisma.training.deleteMany({ where: { instrumentId: i.id } });
    await prisma.maintenanceLog.deleteMany({ where: { instrumentId: i.id } });
    await prisma.booking.deleteMany({ where: { instrumentId: i.id } });
    await prisma.instrument.delete({ where: { id: i.id } }); // cascades documents + maintenanceWindows
    instRemoved++;
    console.log(`  removed sample instrument "${i.name}"`);
  }

  // Remove now-empty facilities other than the DTI facility.
  const facs = await prisma.facility.findMany({ where: { institutionId: inst.id }, include: { _count: { select: { instruments: true } } } });
  for (const f of facs) {
    if (f.id !== facility.id && f._count.instruments === 0) { await prisma.facility.delete({ where: { id: f.id } }); facRemoved++; console.log(`  removed empty facility "${f.name}"`); }
  }

  console.log(`\nADART updated.`);
  console.log(`  Instruments: +${instCreated} created, ${instUpdated} updated, -${instRemoved} sample removed (of ${EQUIPMENT.length})`);
  console.log(`  Services:    +${svcCreated} created, ${svcUpdated} updated, -${svcRemoved} sample removed (of ${TESTS.length})`);
  console.log(`  Facilities:  -${facRemoved} empty removed`);
  const total = TESTS.reduce((s, t) => s + t.lakhs, 0);
  console.log(`  Catalogue value: ₹${total.toFixed(1)} Lakhs across ${TESTS.length} tests.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
