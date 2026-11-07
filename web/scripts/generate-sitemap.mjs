import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleBuildStepError, loadBuildEnv, requireApiBase } from "./build-env.mjs";

const webDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = path.join(webDirectory, "public");
const distDirectory = path.join(webDirectory, "dist");
const staticPaths = [
  "/",
  "/exchange",
  "/packages",
  "/providers",
  "/experts",
  "/equipment",
  "/events",
];

function xmlEscape(value) {
  return value.replace(/[<>&'"]/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "'": "&apos;",
    '"': "&quot;",
  })[character]);
}

function itemsFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.data)) return payload.data;
  throw new Error("Expected an array or a paginated { data } response from the public API.");
}

async function fetchJson(apiBase, route) {
  const url = new URL(route.replace(/^\//, ""), `${apiBase.replace(/\/+$/, "")}/`);
  let response;
  try {
    response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new Error(`Public API request ${route} failed (${url.origin}): ${error.message}`);
  }
  if (!response.ok) throw new Error(`Public API ${route} returned HTTP ${response.status}.`);
  return response.json();
}

async function fetchAll(apiBase, route) {
  const items = [];
  let page = 1;
  while (page <= 1000) {
    const separator = route.includes("?") ? "&" : "?";
    const result = await fetchJson(apiBase, `${route}${separator}page=${page}&pageSize=100`);
    const batch = itemsFrom(result);
    items.push(...batch);
    if (Array.isArray(result) || batch.length < 100 || items.length >= result.total) break;
    page += 1;
  }
  if (page > 1000) throw new Error(`Pagination limit exceeded for ${route}.`);
  return items;
}

function addPath(paths, pathname) {
  if (typeof pathname === "string" && pathname.startsWith("/") && !pathname.includes("?")) {
    paths.add(pathname);
  }
}

async function main() {
  try {
    const env = await loadBuildEnv(webDirectory);
    const siteUrl = (env.get("VITE_SITE_URL") || env.get("SEO_SITE_URL") || "https://itro.co.in").replace(/\/+$/, "");
    const apiBase = requireApiBase(env.get("VITE_API_URL"), "SEO sitemap generation");
    if (!apiBase) {
      await updateRobotsFile(siteUrl);
      return;
    }

    const paths = new Set(staticPaths);
    const [industries, technologies, packages, events, institutions, services, bundles] = await Promise.all([
      fetchAll(apiBase, "/industries"),
      fetchAll(apiBase, "/technologies"),
      fetchAll(apiBase, "/packages"),
      fetchAll(apiBase, "/events"),
      fetchAll(apiBase, "/institutions"),
      fetchAll(apiBase, "/exchange/services"),
      fetchJson(apiBase, "/bundles/browse"),
    ]);

    for (const item of industries) if (item.slug) addPath(paths, `/industries/${encodeURIComponent(item.slug)}`);
    for (const item of technologies) if (item.slug) addPath(paths, `/technologies/${encodeURIComponent(item.slug)}`);
    for (const item of packages) if (item.slug) addPath(paths, `/packages/${encodeURIComponent(item.slug)}`);
    for (const item of events) if (item.slug) addPath(paths, `/events/${encodeURIComponent(item.slug)}`);
    for (const item of institutions) {
      if (item.slug) addPath(paths, `/institutions/${encodeURIComponent(item.slug)}`);
      for (const facility of item.facilities ?? []) {
        if (facility.id) addPath(paths, `/facilities/${encodeURIComponent(facility.id)}`);
      }
    }
    for (const item of services) if (item.id) addPath(paths, `/services/${encodeURIComponent(item.id)}`);
    for (const item of bundlesFrom(bundles)) if (item.slug) addPath(paths, `/bundles/${encodeURIComponent(item.slug)}`);

    const technologyDetails = await Promise.all(technologies
      .filter((technology) => technology.slug)
      .map((technology) => fetchJson(apiBase, `/technologies/${encodeURIComponent(technology.slug)}`)));
    for (const detail of technologyDetails) {
      for (const test of detail.tests ?? []) {
        if (test.slug) addPath(paths, `/tests/${encodeURIComponent(test.slug)}`);
      }
      for (const instrument of detail.instruments ?? []) {
        if (instrument.id) addPath(paths, `/instruments/${encodeURIComponent(instrument.id)}`);
      }
      for (const facility of detail.facilities ?? []) {
        if (facility.id) addPath(paths, `/facilities/${encodeURIComponent(facility.id)}`);
      }
    }

    const industryDetails = await Promise.all(industries
      .filter((industry) => industry.slug)
      .map((industry) => fetchJson(apiBase, `/industries/${encodeURIComponent(industry.slug)}`)));
    for (const detail of industryDetails) {
      for (const test of detail.tests ?? []) {
        if (test.slug) addPath(paths, `/tests/${encodeURIComponent(test.slug)}`);
      }
    }

    const urls = [...paths].sort();
    if (urls.length > 50_000) throw new Error(`Sitemap has ${urls.length} URLs; the sitemap limit is 50,000.`);
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...urls.map((pathname) => `  <url><loc>${xmlEscape(new URL(pathname, siteUrl).href)}</loc></url>`),
      "</urlset>",
      "",
    ].join("\n");
    await updateRobotsFile(siteUrl);
    await writeOutput("sitemap.xml", xml);
    console.log(`Generated sitemap with ${urls.length} public URLs.`);
  } catch (error) {
    handleBuildStepError("SEO sitemap generation", error);
  }
}

async function updateRobotsFile(siteUrl) {
  const robots = await readFile(path.join(publicDirectory, "robots.txt"), "utf8");
  const updated = robots.replace(/^Sitemap:\s*.+$/m, `Sitemap: ${siteUrl}/sitemap.xml`);
  if (!/^Sitemap:/m.test(updated)) throw new Error("robots.txt is missing its Sitemap directive.");
  await writeOutput("robots.txt", updated);
}

async function writeOutput(filename, contents) {
  await writeFile(path.join(publicDirectory, filename), contents, "utf8");
  try {
    await access(distDirectory);
    await writeFile(path.join(distDirectory, filename), contents, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function bundlesFrom(payload) {
  return itemsFrom(payload);
}

main().catch((error) => {
  console.error(`SEO sitemap generation failed: ${error.message}`);
  process.exitCode = 1;
});
