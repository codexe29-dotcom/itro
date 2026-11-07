// Real photographic imagery (Unsplash CDN). Every URL below was verified to return 200
// and visually checked for subject accuracy. Falls back to a generic lab photo.
const U = (id: string, w = 800, q = 70) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&q=${q}&auto=format&fit=crop`;

// Hero banner - precision machining (industrial, dramatic, dark → readable overlay).
export const HERO_IMAGE = U("1504328345606-18bbc8c9d7d1", 1920, 80);
export const HERO_IMAGE_2 = U("1581091226825-a6a2a5aee158", 1600, 80); // research lab

const GENERIC = "1581091226825-a6a2a5aee158"; // lab / research

// Fine-grained instrument category → representative photo.
const CATEGORY_IMG: Record<string, string> = {
  CNC: "1504328345606-18bbc8c9d7d1",              // machining sparks
  "3D Metal Printer": "1565043666747-69f6646db940", // industrial
  SEM: "1576086213369-97a306d36557",              // microscopy
  TEM: "1576086213369-97a306d36557",
  XRD: "1518770660439-4636190af475",              // materials / close-up
  FTIR: "1532094349884-543bc11b234d",             // lab glassware
  UTM: "1581091226825-a6a2a5aee158",              // testing / lab
  Fatigue: "1581091226825-a6a2a5aee158",
  NMR: "1532094349884-543bc11b234d",
  "GC-MS": "1532187863486-abf9dbad1b69",          // analytical
  Rheometer: "1532187863486-abf9dbad1b69",
};

export const imageForCategory = (category?: string, w = 800) =>
  U(CATEGORY_IMG[category ?? ""] ?? GENERIC, w);

// Technology-area key → photo (matches lib/taxonomy TECH_AREAS keys).
const TECH_IMG: Record<string, string> = {
  machining: "1504328345606-18bbc8c9d7d1",
  additive: "1565043666747-69f6646db940",
  microscopy: "1576086213369-97a306d36557",
  materials: "1518770660439-4636190af475",
  mechanical: "1581091226825-a6a2a5aee158",
  chemical: "1532094349884-543bc11b234d",
};
export const imageForTech = (key: string, w = 800) => U(TECH_IMG[key] ?? GENERIC, w);
