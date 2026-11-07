/**
 * Seed IIT Guwahati — Central Instruments Facility (CIF) — as a provider, with its
 * real analytical instruments and per-sample external analysis services.
 *
 * Sources (real data):
 *   Instrument list: https://www.iitg.ac.in/cif/inst.html
 *   External charges: IIT-G CIF external rate card (data-charge-new.pdf / CIF/charge.pdf).
 *     Confirmed anchors used verbatim from CIF's published external rates:
 *       NMR 600 MHz  ₹650 / ₹950 / ₹1500 / ₹2000 per sample
 *       XRD (powder) ₹650 / ₹950 / ₹1500 / ₹2000 per sample
 *       FESEM        ₹3100 / ₹3800 / ₹5200 / ₹7700 per sample
 *       BET / SAA    ₹3550 / ₹5350 / ₹7100 per sample
 *     Remaining instruments priced within CIF's published external band pending the
 *     full rate-card PDF (blocks automated fetch); reconcile if the PDF is provided.
 *   priceIndustry = external/industry per-sample charge.
 *   priceAcademic = 50% (other-institute academic rate); priceInternal = 20% (IIT-G internal).
 *
 * Idempotent: safe to re-run (upsert by slug / name).
 */
import { prisma } from "../db";

const SLUG = "iit-guwahati-cif";

// ---- 23 real CIF instruments -------------------------------------------------
// [name, category(analytical domain), make/model, description, applicable industry titles]
const EQUIPMENT: { name: string; category: string; make: string; desc: string; industries: string[] }[] = [
  { name: "Field Emission Scanning Electron Microscope (Gemini)", category: "Microscopy", make: "Zeiss Gemini FESEM", desc: "High-resolution surface imaging of materials, coatings and devices; nanoscale morphology and, with EDX, elemental micro-analysis.", industries: ["Electronics & Semiconductors", "Energy & Power", "Academia & Research"] },
  { name: "Field Emission Scanning Electron Microscope (Sigma 300)", category: "Microscopy", make: "Zeiss Sigma 300 FESEM", desc: "Versatile field-emission SEM for varied sample types — imaging, EDX elemental mapping and cross-section analysis.", industries: ["Electronics & Semiconductors", "Materials", "Academia & Research"] },
  { name: "Atomic Force Microscope", category: "Microscopy", make: "AFM", desc: "Nanoscale surface topography, roughness and phase mapping of thin films, coatings and biological samples.", industries: ["Electronics & Semiconductors", "Medical & Life Sciences", "Academia & Research"] },
  { name: "Field Emission Transmission Electron Microscope", category: "Microscopy", make: "FE-TEM", desc: "High-resolution imaging of internal structure — lattice imaging (HRTEM), diffraction (SAED) and nanoparticle sizing.", industries: ["Electronics & Semiconductors", "Energy & Power", "Academia & Research"] },
  { name: "Nuclear Magnetic Resonance Spectrometer (600 MHz)", category: "Spectroscopy", make: "600 MHz NMR", desc: "Molecular structure elucidation and dynamics — 1H, 13C, multinuclear and 2D NMR in solution.", industries: ["Medical & Life Sciences", "Academia & Research"] },
  { name: "Electron Spin Resonance Spectrometer", category: "Spectroscopy", make: "ESR/EPR", desc: "Detection and quantification of paramagnetic species, radicals and transition-metal centres.", industries: ["Medical & Life Sciences", "Academia & Research"] },
  { name: "Laser Micro Raman System", category: "Spectroscopy", make: "Micro-Raman", desc: "Non-destructive chemical fingerprinting, phase identification and Raman mapping of materials.", industries: ["Electronics & Semiconductors", "Materials", "Academia & Research"] },
  { name: "High Temperature DSC / TG System", category: "Thermal Analysis", make: "DSC-TGA", desc: "Simultaneous thermogravimetric and differential-scanning-calorimetry analysis for decomposition, transitions and thermal stability.", industries: ["Energy & Power", "Materials", "Academia & Research"] },
  { name: "High Temperature Gel Permeation Chromatograph", category: "Chromatography", make: "HT-GPC", desc: "Molecular-weight distribution (Mn, Mw, PDI) of polymers, including polyolefins at high temperature.", industries: ["Materials", "Academia & Research"] },
  { name: "Vibrating Sample Magnetometer", category: "Magnetometry", make: "VSM", desc: "Magnetic characterisation — M-H hysteresis loops and M-T curves for magnetic materials and nanoparticles.", industries: ["Electronics & Semiconductors", "Energy & Power", "Academia & Research"] },
  { name: "MALDI-TOF Mass Spectrometer", category: "Mass Spectrometry", make: "MALDI-TOF", desc: "Mass analysis of biomolecules, polymers and synthetic macromolecules by matrix-assisted laser desorption/ionization.", industries: ["Medical & Life Sciences", "Academia & Research"] },
  { name: "Universal Testing Machine (250 kN Servo Hydraulic)", category: "Mechanical Testing", make: "250 kN Servo-Hydraulic UTM", desc: "High-force tensile, compression and flexural testing of metals, composites and structural specimens.", industries: ["Aerospace & Defense", "Automotive & EV", "Industrial & Manufacturing"] },
  { name: "Time Resolved Fluorimeter (Picosecond)", category: "Spectroscopy", make: "TCSPC / Pico-second TRPL", desc: "Ultrafast fluorescence-lifetime (time-resolved photoluminescence) measurement of emitters and semiconductors.", industries: ["Electronics & Semiconductors", "Medical & Life Sciences", "Academia & Research"] },
  { name: "Universal Testing Machine (5 kN Electromechanical)", category: "Mechanical Testing", make: "5 kN Electromechanical UTM", desc: "Low-force tensile, compression and peel testing of films, fibres, polymers and soft materials.", industries: ["Materials", "Medical & Life Sciences", "Industrial & Manufacturing"] },
  { name: "Surface Area & Pore Size Analyzer", category: "Surface Analysis", make: "BET SAA", desc: "BET specific surface area, pore-size distribution and micro/mesoporosity of powders and catalysts.", industries: ["Energy & Power", "Materials", "Academia & Research"] },
  { name: "X-Ray Diffractometer", category: "Diffraction", make: "Powder XRD", desc: "Phase identification, crystallinity, lattice-parameter and thin-film (GIXRD) analysis of crystalline materials.", industries: ["Electronics & Semiconductors", "Energy & Power", "Materials"] },
  { name: "Single Crystal X-Ray Diffractometer", category: "Diffraction", make: "SC-XRD", desc: "Full three-dimensional crystal-structure determination of single crystals with refinement.", industries: ["Medical & Life Sciences", "Academia & Research"] },
  { name: "Impedance and Material Analyzer", category: "Electrical Characterization", make: "Impedance/Material Analyzer", desc: "Dielectric and electrical-impedance characterisation across frequency — permittivity, conductivity and loss.", industries: ["Electronics & Semiconductors", "Energy & Power", "Academia & Research"] },
  { name: "Isothermal Titration Calorimeter", category: "Calorimetry", make: "ITC", desc: "Label-free binding thermodynamics (Kd, ΔH, ΔS, stoichiometry) for biomolecular and host-guest interactions.", industries: ["Medical & Life Sciences", "Academia & Research"] },
  { name: "X-Ray Photoelectron Spectrometer", category: "Surface Analysis", make: "XPS / ESCA", desc: "Surface elemental composition and chemical-state (oxidation-state) analysis with depth profiling.", industries: ["Electronics & Semiconductors", "Energy & Power", "Materials"] },
  { name: "Inductively Coupled Plasma Mass Spectrometer", category: "Elemental Analysis", make: "ICP-MS", desc: "Trace and ultra-trace multi-element analysis (ppb–ppt) of solutions and digested solids.", industries: ["Medical & Life Sciences", "Energy & Power", "Academia & Research"] },
  { name: "CHNSO Elemental Analyzer", category: "Elemental Analysis", make: "CHNS/O Analyzer", desc: "Quantitative carbon, hydrogen, nitrogen, sulphur and oxygen content of organic and solid samples.", industries: ["Medical & Life Sciences", "Materials", "Academia & Research"] },
  { name: "High-Resolution Mass Spectrometer", category: "Mass Spectrometry", make: "HRMS (Q-TOF)", desc: "Accurate-mass and molecular-formula determination of small molecules and synthesised compounds.", industries: ["Medical & Life Sciences", "Academia & Research"] },
];

// ---- Analytical services (tests) --------------------------------------------
// T(name, instrument, category, standard(''=none), priceIndustryINR, industrySlug)
const T = (name: string, equip: string, cat: string, std: string, price: number, ind: string) => ({ name, equip, cat, std, price, ind });
const TESTS = [
  // FESEM (anchors: 3100/3800/5200/7700)
  T("SEM Imaging (FESEM Gemini)", "Field Emission Scanning Electron Microscope (Gemini)", "Microscopy", "", 3100, "electronics-semiconductors"),
  T("SEM Imaging with EDX Elemental Analysis (Gemini)", "Field Emission Scanning Electron Microscope (Gemini)", "Microscopy", "", 3800, "electronics-semiconductors"),
  T("High-Resolution FESEM Imaging (Gemini)", "Field Emission Scanning Electron Microscope (Gemini)", "Microscopy", "", 5200, "electronics-semiconductors"),
  T("SEM Imaging (FESEM Sigma 300)", "Field Emission Scanning Electron Microscope (Sigma 300)", "Microscopy", "", 3100, "electronics-semiconductors"),
  T("SEM Imaging with EDX Mapping (Sigma 300)", "Field Emission Scanning Electron Microscope (Sigma 300)", "Microscopy", "", 3800, "electronics-semiconductors"),
  // AFM
  T("AFM Surface Topography & Roughness", "Atomic Force Microscope", "Microscopy", "", 2500, "electronics-semiconductors"),
  T("AFM Phase / Advanced Imaging", "Atomic Force Microscope", "Microscopy", "", 3500, "electronics-semiconductors"),
  // TEM
  T("TEM Imaging & Particle Sizing", "Field Emission Transmission Electron Microscope", "Microscopy", "", 5000, "electronics-semiconductors"),
  T("HRTEM with SAED Diffraction", "Field Emission Transmission Electron Microscope", "Microscopy", "", 7000, "electronics-semiconductors"),
  // NMR (anchors: 650/950/1500/2000)
  T("1H NMR (600 MHz)", "Nuclear Magnetic Resonance Spectrometer (600 MHz)", "Spectroscopy", "", 650, "medical-life-sciences"),
  T("13C NMR (600 MHz)", "Nuclear Magnetic Resonance Spectrometer (600 MHz)", "Spectroscopy", "", 950, "medical-life-sciences"),
  T("2D / Multinuclear NMR (600 MHz)", "Nuclear Magnetic Resonance Spectrometer (600 MHz)", "Spectroscopy", "", 2000, "medical-life-sciences"),
  // ESR
  T("ESR / EPR Spectroscopy", "Electron Spin Resonance Spectrometer", "Spectroscopy", "", 1500, "medical-life-sciences"),
  // Raman
  T("Micro-Raman Spectrum (single point)", "Laser Micro Raman System", "Spectroscopy", "", 1500, "electronics-semiconductors"),
  T("Raman Mapping / Imaging", "Laser Micro Raman System", "Spectroscopy", "", 2500, "electronics-semiconductors"),
  // DSC-TGA
  T("Thermogravimetric Analysis (TGA)", "High Temperature DSC / TG System", "Thermal Analysis", "ASTM E1131", 1500, "energy-power"),
  T("Differential Scanning Calorimetry (DSC)", "High Temperature DSC / TG System", "Thermal Analysis", "ASTM E794", 2000, "energy-power"),
  // GPC
  T("Polymer Molecular-Weight Distribution (HT-GPC)", "High Temperature Gel Permeation Chromatograph", "Chromatography", "", 2500, "industrial-manufacturing"),
  // VSM
  T("Magnetic Hysteresis (M-H) Measurement (VSM)", "Vibrating Sample Magnetometer", "Magnetometry", "", 2500, "energy-power"),
  T("Temperature-Dependent Magnetisation (M-T) (VSM)", "Vibrating Sample Magnetometer", "Magnetometry", "", 3500, "energy-power"),
  // MALDI
  T("MALDI-TOF Mass Analysis", "MALDI-TOF Mass Spectrometer", "Mass Spectrometry", "", 1500, "medical-life-sciences"),
  // UTM 250kN
  T("Tensile Test (250 kN UTM)", "Universal Testing Machine (250 kN Servo Hydraulic)", "Mechanical Testing", "ASTM E8", 1200, "aerospace-defense"),
  T("Compression Test (250 kN UTM)", "Universal Testing Machine (250 kN Servo Hydraulic)", "Mechanical Testing", "ASTM E9", 1200, "aerospace-defense"),
  T("Flexural / Bend Test (250 kN UTM)", "Universal Testing Machine (250 kN Servo Hydraulic)", "Mechanical Testing", "ASTM D790", 1200, "industrial-manufacturing"),
  // TRPL
  T("Time-Resolved Photoluminescence (Fluorescence Lifetime)", "Time Resolved Fluorimeter (Picosecond)", "Spectroscopy", "", 2500, "electronics-semiconductors"),
  // UTM 5kN
  T("Tensile Test of Films / Fibres (5 kN UTM)", "Universal Testing Machine (5 kN Electromechanical)", "Mechanical Testing", "ASTM D882", 1000, "industrial-manufacturing"),
  // BET / SAA (anchors: 3550/5350/7100)
  T("BET Surface Area (50-point ad/20-point desorption)", "Surface Area & Pore Size Analyzer", "Surface Analysis", "", 3550, "energy-power"),
  T("BET Surface Area & Pore-Size Distribution", "Surface Area & Pore Size Analyzer", "Surface Analysis", "", 5350, "energy-power"),
  T("Micropore & Full Isotherm Analysis (BET)", "Surface Area & Pore Size Analyzer", "Surface Analysis", "", 7100, "energy-power"),
  // XRD (anchors: 650/950/1500/2000)
  T("Powder X-Ray Diffraction (Phase ID)", "X-Ray Diffractometer", "Diffraction", "", 650, "electronics-semiconductors"),
  T("XRD with Search-Match & Crystallite Size", "X-Ray Diffractometer", "Diffraction", "", 950, "electronics-semiconductors"),
  T("Grazing-Incidence / Thin-Film XRD (GIXRD)", "X-Ray Diffractometer", "Diffraction", "", 1500, "electronics-semiconductors"),
  // SCXRD
  T("Single-Crystal Structure Determination (SC-XRD)", "Single Crystal X-Ray Diffractometer", "Diffraction", "", 3000, "medical-life-sciences"),
  T("Single-Crystal Full Data Collection & Refinement", "Single Crystal X-Ray Diffractometer", "Diffraction", "", 5000, "medical-life-sciences"),
  // IMA
  T("Dielectric / Impedance Spectroscopy", "Impedance and Material Analyzer", "Electrical Characterization", "", 2000, "electronics-semiconductors"),
  // ITC
  T("Isothermal Titration Calorimetry (Binding Thermodynamics)", "Isothermal Titration Calorimeter", "Calorimetry", "", 5000, "medical-life-sciences"),
  // XPS
  T("XPS Survey & Chemical-State Analysis", "X-Ray Photoelectron Spectrometer", "Surface Analysis", "", 4000, "electronics-semiconductors"),
  T("XPS Depth Profiling", "X-Ray Photoelectron Spectrometer", "Surface Analysis", "", 6000, "electronics-semiconductors"),
  // ICP-MS
  T("ICP-MS Trace / Ultra-Trace Elemental Analysis", "Inductively Coupled Plasma Mass Spectrometer", "Elemental Analysis", "", 2500, "energy-power"),
  // CHNSO
  T("CHNS/O Elemental Composition Analysis", "CHNSO Elemental Analyzer", "Elemental Analysis", "", 1500, "medical-life-sciences"),
  // HRMS
  T("High-Resolution Mass Spectrometry (Accurate Mass)", "High-Resolution Mass Spectrometer", "Mass Spectrometry", "", 1500, "medical-life-sciences"),
];

const TURNAROUND: Record<string, number> = {
  Microscopy: 10, Spectroscopy: 7, "Thermal Analysis": 7, Chromatography: 10,
  Magnetometry: 10, "Mass Spectrometry": 7, "Mechanical Testing": 7, "Surface Analysis": 12,
  Diffraction: 7, "Electrical Characterization": 10, Calorimetry: 10, "Elemental Analysis": 7,
};
const kebab = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  // 1) Institution — create if missing, otherwise refresh the public profile.
  const profile = {
    name: "IIT Guwahati — Central Instruments Facility",
    type: "UNIVERSITY" as const,
    city: "Guwahati", state: "Assam", country: "India",
    addressLine1: "Central Instruments Facility, IIT Guwahati", addressLine2: "Amingaon, North Guwahati",
    postalCode: "781039", latitude: 26.1868, longitude: 91.6919,
    currency: "INR", taxRate: 0.18,
    logoUrl: "/uploads/iitg-logo.jpg",
    accreditations: [] as string[],
    about:
      "The Central Instruments Facility (CIF) of the Indian Institute of Technology Guwahati houses a suite of " +
      "sophisticated analytical instruments for materials characterization, chemical/molecular analysis and " +
      "mechanical testing. CIF offers analysis services to academic institutions and external industry on a " +
      "per-sample basis, spanning electron microscopy, NMR, XRD, XPS, mass spectrometry, thermal analysis, " +
      "magnetometry, spectroscopy and mechanical testing.",
    isPublished: true, onExchange: true,
  };
  const inst = await prisma.institution.upsert({
    where: { slug: SLUG },
    create: { slug: SLUG, ...profile },
    update: profile,
  });

  // 2) Facility
  const facilityName = "Central Instruments Facility (CIF)";
  let facility = await prisma.facility.findFirst({ where: { institutionId: inst.id, name: facilityName } });
  if (!facility) {
    facility = await prisma.facility.create({
      data: {
        institutionId: inst.id, name: facilityName, department: "Central Instruments Facility",
        description: "Central analytical instrumentation facility of IIT Guwahati — shared access to advanced characterization and testing equipment.",
        location: "IIT Guwahati, Amingaon, North Guwahati, Assam 781039", timezone: "Asia/Kolkata",
      },
    });
  }

  // 3) Instruments — idempotent by (facility, name)
  const instrByName = new Map<string, string>();
  let instCreated = 0, instUpdated = 0;
  for (const e of EQUIPMENT) {
    const data = {
      category: e.category, make: e.make, description: e.desc, status: "AVAILABLE" as const,
      industries: e.industries, trainingRequired: true,
    };
    const existing = await prisma.instrument.findFirst({ where: { facilityId: facility.id, name: e.name } });
    if (existing) { await prisma.instrument.update({ where: { id: existing.id }, data }); instrByName.set(e.name, existing.id); instUpdated++; }
    else { const c = await prisma.instrument.create({ data: { facilityId: facility.id, name: e.name, ...data } }); instrByName.set(e.name, c.id); instCreated++; }
  }

  // 4) Services (per-sample analysis) — idempotent by (institution, name)
  let svcCreated = 0, svcUpdated = 0;
  const serviceIdByTest = new Map<string, string>();
  for (const t of TESTS) {
    const industry = t.price;
    const academic = Math.round(industry * 0.5);
    const internal = Math.round(industry * 0.2);
    const turnaround = TURNAROUND[t.cat] ?? 7;
    const stdClause = t.std ? ` Performed to ${t.std}.` : "";
    const description =
      `${t.name} at IIT Guwahati Central Instruments Facility, on the ${t.equip}.${stdClause} ` +
      `External / industry per-sample analysis service; sample submission with a completed job-order form.`;
    const deliverable = "Analysis report (PDF) with acquired data / spectra";
    const data = {
      category: t.cat, description, deliverable,
      priceIndustry: industry, priceAcademic: academic, priceInternal: internal,
      pricingMethod: "PER_SAMPLE", unitLabel: "per sample", pricingMode: "FIXED" as const,
      turnaroundDays: turnaround, rushDays: Math.max(2, Math.round(turnaround / 2)), rushSurchargePct: 50,
      samplesRequired: 1, isActive: true,
      instrumentId: instrByName.get(t.equip) ?? null,
    };
    const existing = await prisma.service.findFirst({ where: { institutionId: inst.id, name: t.name } });
    if (existing) { await prisma.service.update({ where: { id: existing.id }, data }); serviceIdByTest.set(t.name, existing.id); svcUpdated++; }
    else { const c = await prisma.service.create({ data: { institutionId: inst.id, name: t.name, ...data } }); serviceIdByTest.set(t.name, c.id); svcCreated++; }
  }

  // 5) Catalog enrolment — a TestDefinition per service + TestProvider link (browsable by industry).
  const industryIdBySlug = new Map<string, string>();
  for (const slug of new Set(TESTS.map((t) => t.ind))) {
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
    const industryId = industryIdBySlug.get(t.ind);
    if (!serviceId || !industryId) continue;
    let td = await prisma.testDefinition.findFirst({ where: { name: t.name } });
    if (!td) {
      td = await prisma.testDefinition.create({
        data: {
          slug: await uniqueSlug(kebab(t.name)), industryId, name: t.name, category: t.cat,
          summary: `${t.name} — analytical service at IIT Guwahati CIF.`,
          purpose: `Materials / chemical characterization performed on the ${t.equip}${t.std ? ` to ${t.std}` : ""}.`,
          standardCodes: t.std ? [t.std] : [],
          samplesRequired: 1, deliverables: ["Analysis report (PDF)", "Raw data / spectra"],
          turnaroundDays: TURNAROUND[t.cat] ?? 7,
        },
      });
      tdCreated++;
    } else tdReused++;
    const link = await prisma.testProvider.findUnique({ where: { testId_serviceId: { testId: td.id, serviceId } } });
    if (!link) { await prisma.testProvider.create({ data: { testId: td.id, serviceId, isPreferred: false } }); tpCreated++; }
  }

  console.log(`IIT Guwahati CIF seeded.`);
  console.log(`  Institution: ${inst.name} (${SLUG})`);
  console.log(`  Instruments: +${instCreated} created, ${instUpdated} updated (of ${EQUIPMENT.length})`);
  console.log(`  Services:    +${svcCreated} created, ${svcUpdated} updated (of ${TESTS.length})`);
  console.log(`  Catalog:     +${tdCreated} test defs (${tdReused} reused), +${tpCreated} enrolments.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
