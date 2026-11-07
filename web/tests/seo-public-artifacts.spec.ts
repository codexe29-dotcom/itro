import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const publicDirectory = new URL("../public/", import.meta.url);

describe("public SEO artifacts", () => {
  it("publishes a unique sitemap of public ITRO routes", async () => {
    const sitemap = await readFile(new URL("sitemap.xml", publicDirectory), "utf8");
    const locations = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
    const paths = locations.map((location) => new URL(location).pathname);

    expect(sitemap).toContain("<urlset");
    expect(locations.length).toBeGreaterThan(0);
    expect(new Set(locations).size).toBe(locations.length);
    expect(locations.every((location) => new URL(location).origin === "https://itro.co.in")).toBe(true);
    expect(paths.some((pathname) => pathname === "/")).toBe(true);
    expect(paths.some((pathname) => /^\/(admin|app|operator|platform|login|register)(\/|$)/.test(pathname))).toBe(false);
    expect(paths.some((pathname) => pathname === "/cart" || pathname === "/search")).toBe(false);
  });

  it("points crawlers at the canonical sitemap and excludes private surfaces", async () => {
    const robots = await readFile(new URL("robots.txt", publicDirectory), "utf8");

    expect(robots).toContain("Sitemap: https://itro.co.in/sitemap.xml");
    expect(robots).toMatch(/^Disallow: \/(?:admin|app|operator|platform|cart|search)(?:\/|$)/m);
  });
});
