import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { handleBuildStepError, loadBuildEnv, requireApiBase } from "./build-env.mjs";

const webDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDirectory = path.join(webDirectory, "dist");
const previewUrl = "http://127.0.0.1:4173";

function xmlDecode(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function normalizeText(value) {
  return value?.replace(/\s+/g, " ").trim();
}

function routePathFromLocation(location, siteUrl) {
  const pageUrl = new URL(location);
  if (pageUrl.origin !== siteUrl) throw new Error(`Unexpected sitemap host: ${pageUrl.origin}.`);
  return decodeURIComponent(pageUrl.pathname);
}

function outputPathForRoute(routePath) {
  const segments = routePath.split("/").filter(Boolean);
  const outputPath = path.resolve(distDirectory, ...segments, "index.html");
  if (!outputPath.startsWith(`${distDirectory}${path.sep}`)) {
    throw new Error(`Refusing to write a route outside dist: ${routePath}`);
  }
  return outputPath;
}

function validateSavedHead(html, routePath, canonicalUrl) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1];
  if (!head) throw new Error(`${routePath} has no serialized <head> element.`);

  const title = head.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  if (!title) throw new Error(`${routePath} has no serialized title.`);

  const tags = [...head.matchAll(/<(meta|link)\b[^>]*>/gi)].map(([tag]) => tag);
  const attributes = (tag) => Object.fromEntries(
    [...tag.matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
      .map(([, name, doubleQuoted, singleQuoted]) => [name.toLowerCase(), doubleQuoted ?? singleQuoted]),
  );
  const metas = tags.map(attributes).filter((tag) => tag.name || tag.property);
  const hasMeta = (key, value) => metas.some((tag) =>
    (tag.name === key || tag.property === key) && Boolean(tag.content?.trim()) &&
    (value === undefined || tag.content === value)
  );
  if (!hasMeta("description")) throw new Error(`${routePath} has no serialized meta description.`);
  for (const property of ["og:title", "og:description", "og:url", "og:image"]) {
    if (!hasMeta(property)) throw new Error(`${routePath} has no serialized ${property} tag.`);
  }
  const canonical = tags.map(attributes).find((tag) => tag.rel === "canonical");
  if (canonical?.href !== canonicalUrl) throw new Error(`${routePath} has no matching serialized canonical link.`);

  const jsonLdBlocks = [...head.matchAll(/<script\b(?=[^>]*\bdata-seo=["']managed["'])[^>]*>([\s\S]*?)<\/script>/gi)];
  if (jsonLdBlocks.length === 0) throw new Error(`${routePath} has no serialized managed JSON-LD schema.`);
  const schemas = jsonLdBlocks.map(([, json]) => {
    try {
      return JSON.parse(json);
    } catch {
      throw new Error(`${routePath} contains invalid serialized JSON-LD.`);
    }
  });
  if (!schemas.some((schema) => schema["@context"] === "https://schema.org" && schema["@type"] === "WebPage")) {
    throw new Error(`${routePath} is missing its WebPage JSON-LD schema.`);
  }
}

async function waitForPreview(server) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Vite preview exited with code ${server.exitCode}.`);
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      await delay(500);
    }
  }
  throw new Error("Vite preview did not become available within 30 seconds.");
}

async function main() {
  const env = await loadBuildEnv(webDirectory);
  const apiBase = requireApiBase(env.get("VITE_API_URL"), "Public route pre-rendering");
  if (!apiBase) return;

  const siteUrl = (env.get("VITE_SITE_URL") || env.get("SEO_SITE_URL") || "https://itro.co.in").replace(/\/+$/, "");
  const sitemap = await readFile(path.join(distDirectory, "sitemap.xml"), "utf8");
  const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => xmlDecode(match[1]));
  if (locations.length === 0) throw new Error("Cannot pre-render public routes: the built sitemap is empty.");
  const routes = [...new Set(locations.map((location) => routePathFromLocation(location, siteUrl)))];

  const server = spawn(process.execPath, [
    path.resolve(webDirectory, "..", "node_modules", "vite", "bin", "vite.js"),
    "preview",
    "--host", "127.0.0.1",
    "--port", "4173",
    "--strictPort",
  ], { cwd: webDirectory, stdio: "inherit", windowsHide: true });

  let browser;
  try {
    await waitForPreview(server);
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const apiUrl = new URL(apiBase);
    const apiPath = apiUrl.pathname.replace(/\/+$/, "");
    const apiRoot = `${apiUrl.origin}${apiPath}`;
    const apiPattern = new RegExp(`^${apiRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:/|\\?|$)`);
    const apiFetchErrors = new Map();
    const isApiRequest = (requestUrl) => {
      const url = new URL(requestUrl);
      return url.origin === apiUrl.origin && (url.pathname === apiPath || url.pathname.startsWith(`${apiPath}/`));
    };
    let homepageSnapshot;

    await context.route(apiPattern, async (route) => {
      let response;
      try {
        response = await route.fetch({
          headers: { ...route.request().headers(), origin: siteUrl },
        });
      } catch (error) {
        apiFetchErrors.set(route.request().url(), error.message);
        await route.abort();
        return;
      }
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          "access-control-allow-origin": previewUrl,
        },
      });
    });
    async function renderRoute(routePath) {
      const page = await context.newPage();
      const pageErrors = [];
      const apiFailures = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      page.on("requestfailed", (request) => {
        if (isApiRequest(request.url())) {
          apiFailures.push(`${request.url()} (${apiFetchErrors.get(request.url()) ?? request.failure()?.errorText ?? "request failed"})`);
        }
      });
      page.on("response", (response) => {
        const responseUrl = new URL(response.url());
        const anonymousSessionCheck = response.status() === 401 &&
          responseUrl.pathname === `${apiPath}/auth/me`;
        if (isApiRequest(response.url()) && !response.ok() && !anonymousSessionCheck) {
          apiFailures.push(`${response.url()} (HTTP ${response.status()})`);
        }
      });

      try {
        const response = await page.goto(`${previewUrl}${encodeURI(routePath)}`, {
          waitUntil: "domcontentloaded",
          timeout: 60_000,
        });
        if (!response?.ok()) throw new Error(`${routePath} returned HTTP ${response?.status() ?? "no response"}.`);
        if (new URL(page.url()).pathname !== routePath) {
          throw new Error(`${routePath} redirected to ${new URL(page.url()).pathname} instead of rendering the requested route.`);
        }
        await page.locator("h1").waitFor({ state: "visible", timeout: 60_000 });
        await page.waitForLoadState("networkidle", { timeout: 30_000 });
        const canonicalUrl = new URL(routePath, siteUrl).href;
        await page.waitForFunction((expectedCanonical) => {
          const title = document.title;
          const meta = (selector) => document.querySelector(selector)?.getAttribute("content");
          return Boolean(
            title &&
            meta('meta[name="description"]') &&
            meta('meta[property="og:title"]') &&
            meta('meta[property="og:description"]') &&
            meta('meta[property="og:url"]') === expectedCanonical &&
            document.querySelector('link[rel="canonical"]')?.getAttribute("href") === expectedCanonical &&
            document.querySelector('script[type="application/ld+json"][data-seo="managed"]')
          );
        }, canonicalUrl, { timeout: 15_000 });

        const pageData = await page.evaluate(() => ({
          title: document.title,
          description: document.querySelector('meta[name="description"]')?.getAttribute("content"),
          canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"),
          openGraphTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
          openGraphDescription: document.querySelector('meta[property="og:description"]')?.getAttribute("content"),
          openGraphUrl: document.querySelector('meta[property="og:url"]')?.getAttribute("content"),
          openGraphImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content"),
          heading: document.querySelector("h1")?.textContent?.trim(),
          managedSchemas: [...document.querySelectorAll('script[type="application/ld+json"][data-seo="managed"]')]
            .map((script) => JSON.parse(script.textContent ?? "")),
        }));
        const missingMetadata = [
          !pageData.title && "title",
          !pageData.description && "description",
          !pageData.heading && "H1",
          !pageData.openGraphTitle && "Open Graph title",
          !pageData.openGraphDescription && "Open Graph description",
          !pageData.openGraphImage && "Open Graph image",
          normalizeText(pageData.openGraphTitle) !== normalizeText(pageData.title) && "Open Graph title does not match title",
          normalizeText(pageData.openGraphDescription) !== normalizeText(pageData.description) && "Open Graph description does not match description",
          pageData.canonical !== canonicalUrl && "canonical URL",
          pageData.openGraphUrl !== canonicalUrl && "Open Graph URL",
          !pageData.managedSchemas.some((schema) =>
            schema["@context"] === "https://schema.org" && schema["@type"] === "WebPage"
          ) && "WebPage JSON-LD",
        ].filter(Boolean);
        if (missingMetadata.length > 0) {
          throw new Error(
            `${routePath} has invalid rendered metadata: ${missingMetadata.join(", ")}. ` +
            `title=${JSON.stringify(pageData.title)}, og:title=${JSON.stringify(pageData.openGraphTitle)}.`,
          );
        }
        if (pageErrors.length > 0) {
          throw new Error(`${routePath} raised a browser error: ${pageErrors[0]}`);
        }
        if (apiFailures.length > 0) {
          throw new Error(`${routePath} had a failed API request: ${apiFailures[0]}`);
        }
        if (/^(Test|Package|Bundle|Technology|Industry|Research Institution|Research Event|Research Expert|Laboratory Instrument|Research Facility|Testing Service) \| ITRO$/i.test(pageData.title)) {
          throw new Error(`${routePath} rendered fallback metadata instead of published page content.`);
        }

        const html = await page.content();
        validateSavedHead(html, routePath, canonicalUrl);
        return { routePath, html };
      } finally {
        await page.close();
      }
    }

    for (let index = 0; index < routes.length; index += 4) {
      const batch = await Promise.all(routes.slice(index, index + 4).map(renderRoute));
      for (const { routePath, html } of batch) {
        if (routePath === "/") {
          homepageSnapshot = html;
        } else {
          const outputPath = outputPathForRoute(routePath);
          await mkdir(path.dirname(outputPath), { recursive: true });
          await writeFile(outputPath, html, "utf8");
        }
        console.log(`Pre-rendered ${routePath}`);
      }
    }
    if (homepageSnapshot) await writeFile(path.join(distDirectory, "index.html"), homepageSnapshot, "utf8");
    await context.close();
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch((error) => {
  handleBuildStepError("Public route pre-rendering", error);
});
