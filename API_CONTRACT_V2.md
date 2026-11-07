# RIX API Contract v2 — Rich Service Detail + AI Exchange

Extends v1. All public unless noted. Real Prisma data only.

## Schema change
Add to `Institution`: `latitude Float?`, `longitude Float?`. Seed real coords:
Pune 18.5204,73.8567 · Bengaluru 12.9716,77.5946 · Hyderabad 17.3850,78.4867.
Add optional `uptimePct Float?` to `Instrument` (default via seed ~0.9–0.99) and ensure `lastCalibratedAt`/`nextCalibrationAt` are seeded for every instrument.

## 1. GET /services/:id  (ENRICH existing)
Return the service PLUS:
```jsonc
{
  ...serviceFields,
  "institution": { "id","name","slug","city","state","country","accreditations":[],"themeColor","currency","latitude","longitude" },
  "instrument": { "id","name","category","make","model","specs":{},"status","hourlyRate","description",
                  "lastCalibratedAt","nextCalibrationAt","uptimePct",
                  "facility": { "name","department","location" } },
  "condition": { "status","healthLabel":"Excellent|Good|Due for calibration|Under maintenance",
                 "lastCalibratedAt","nextCalibrationAt","calibrationDueSoon":bool,"utilizationPct":number,"uptimePct":number },
  "rating": { "avg":number, "count":number },
  "certifications": ["ISO 17025","NABL", ...]  // service.accreditation ∪ institution.accreditations, unique
}
```
`condition.utilizationPct` = booked hours / available hours over trailing 30d (0..1). If no instrument, condition/instrument null.

## 2. GET /services/:id/availability?days=10
Compute from real Bookings (APPROVED+PENDING) on the linked instrument, working hours 09:00–17:00, 1h slots, skip Sundays.
```jsonc
{ "instrumentId":string|null, "nextAvailable":ISO|null,
  "days":[ { "date":"2026-07-13", "weekday":"Mon", "slots":[ {"start":"09:00","end":"10:00","available":true}, ... ] } ] }
```
If MAINTENANCE/OFFLINE → all slots unavailable, nextAvailable null.

## 3. GET /services/:id/similar?lat=&lng=
Same `category`, active, published+onExchange institutions, INCLUDING the current service (flag it).
```jsonc
[ { "id","name","category","priceIndustry","priceAcademic","turnaroundDays","accreditation",
    "rating":{"avg","count"},
    "institution":{ "id","name","slug","city","state","latitude","longitude" },
    "distanceKm": number|null,   // Haversine if lat&lng provided
    "isCurrent": bool } ]
```
Sort: current first? No — sort by distanceKm asc (nulls last), then priceIndustry asc. Cap 8.

## 4. GET /services/:id/recommended
Other active services at the SAME institution (exclude self), cap 4:
`[ { "id","name","category","priceIndustry","turnaroundDays","accreditation" } ]`

## 5. GET /services/:id/reviews
Reviews via orders→review for THIS service:
```jsonc
{ "avg":number, "count":number,
  "distribution": { "5":n,"4":n,"3":n,"2":n,"1":n },
  "items":[ { "id","rating","comment","author":"orgName|Verified buyer","date":ISO,"orderCode" } ] }
```

## 6. POST /exchange/ai-search
Body: `{ "requirement":string, "lat"?:number, "lng"?:number, "maxPrice"?:number, "maxTurnaround"?:number }`
Deterministic NL matcher (no external LLM needed): tokenize requirement, map to categories via a synonym map
(cnc/machining/milling/turning→CNC; microscope/imaging/microstructure/fractography→SEM,TEM; tensile/strength/yield/mechanical→UTM;
fatigue/cyclic/s-n→Fatigue; phase/crystalline/xrd/diffraction→XRD; ftir/infrared/functional group→FTIR; nmr/structure elucidation→NMR;
gc-ms/volatile/compound id/chromatography→GC-MS; rheology/viscosity/viscoelastic→Rheometer; 3d print/additive/dmls/slm→3D Metal Printer).
Score each active/published service 0–100: category hit (+50), keyword hits in name/description/specs (+ up to 25), rating (+ up to 10),
proximity if lat/lng (+ up to 10), mild price/turnaround preference (+/-5). Return:
```jsonc
{ "requirement", "interpreted": { "categories":[], "keywords":[] },
  "results": [ { ...serviceCardFields, "institution":{...,latitude,longitude}, "rating":{"avg","count"},
                 "distanceKm":number|null, "matchScore":number, "matchReasons":[string] } ] }  // top 12, score desc
```

## Seed additions (so the features have data)
- Add lat/lng to the 3 institutions; add lastCalibratedAt(now-45d)/nextCalibrationAt(now+300d) + uptimePct to all instruments; make the MAINTENANCE one's nextCalibration due soon.
- Add a CNC provider at ALL THREE institutions (so the CNC comparison table shows ≥3 rows): keep Vertex "5-Axis CNC Prototyping"; add "3-Axis CNC Machining" (Northgate, priceIndustry 12000, 6 days) + "Precision CNC Milling" (Meridian, priceIndustry 14500, 7 days) with matching CNC instruments.
- Seed a COMPLETED order + review for each CNC service (ratings 5,4,5 with realistic comments) so ratings differ across the comparison.
- Add 1–2 more reviews to SEM/UTM/NMR services for variety.
