import { useEffect } from "react";

/**
 * Lightweight SEO/meta manager for this client-rendered SPA.
 *
 * Sets <title>, meta description, canonical URL and injects one or more
 * JSON-LD structured-data blocks (e.g. FAQPage, BreadcrumbList). These tags are
 * client-rendered; bots that do not execute JavaScript need server rendering or
 * pre-rendered route HTML to see route-specific metadata and structured data.
 */
export interface SeoOptions {
  title: string;
  description?: string;
  canonicalPath?: string; // e.g. "/industries/aerospace-defense"
  jsonLd?: object[];       // structured-data blocks
  robots?: string;
}

export const SEO_SITE_URL = (import.meta.env.VITE_SITE_URL || "https://itro.co.in").replace(/\/+$/, "");
const DEFAULT_IMAGE = `${SEO_SITE_URL}/itro-logo.png`;

function upsertMeta(name: string, content: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  return el;
}

function upsertProperty(property: string, content: string): HTMLMetaElement {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
  return el;
}

export function useSeo({ title, description, canonicalPath, jsonLd, robots }: SeoOptions) {
  useEffect(() => {
    document.title = title;

    upsertProperty("og:title", title);
    upsertMeta("twitter:title", title);
    if (description) {
      upsertMeta("description", description);
      upsertProperty("og:description", description);
      upsertMeta("twitter:description", description);
    }

    let canonical: HTMLLinkElement | null = null;
    if (canonicalPath) {
      const href = new URL(canonicalPath, SEO_SITE_URL).href;
      canonical = document.head.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", href);
      upsertProperty("og:url", href);
    }

    upsertProperty("og:type", "website");
    upsertProperty("og:site_name", "ITRO");
    upsertProperty("og:image", DEFAULT_IMAGE);
    upsertMeta("twitter:card", "summary_large_image");
    upsertMeta("twitter:image", DEFAULT_IMAGE);
    upsertMeta("robots", robots ?? "index, follow, max-image-preview:large");

    const pageUrl = canonicalPath ? new URL(canonicalPath, SEO_SITE_URL).href : undefined;
    const pageData: object[] = pageUrl
      ? [{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: title,
          description,
          url: pageUrl,
          isPartOf: { "@id": `${SEO_SITE_URL}/#website` },
          inLanguage: "en-IN",
        }]
      : [];
    const hasBreadcrumbs = (jsonLd ?? []).some((block) =>
      typeof block === "object" && block !== null && "@type" in block && block["@type"] === "BreadcrumbList"
    );
    if (canonicalPath && !hasBreadcrumbs) {
      const segments = canonicalPath.split("/").filter(Boolean);
      const breadcrumbs = [
        { name: "Home", item: `${SEO_SITE_URL}/` },
        ...segments.map((segment, index) => ({
          name: index === segments.length - 1
            ? title.replace(/\s*[|–-]\s*ITRO.*$/i, "")
            : segment.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
          item: `${SEO_SITE_URL}/${segments.slice(0, index + 1).map(encodeURIComponent).join("/")}`,
        })),
      ];
      pageData.push({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((crumb, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: crumb.name,
          item: crumb.item,
        })),
      });
    }

    // Inject JSON-LD blocks tagged so we can remove exactly these on cleanup.
    const scripts: HTMLScriptElement[] = [...pageData, ...(jsonLd ?? [])].map((block) => {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.setAttribute("data-seo", "managed");
      s.text = JSON.stringify(block).replace(/</g, "\\u003c");
      document.head.appendChild(s);
      return s;
    });

    return () => {
      scripts.forEach((s) => s.remove());
      // The next route owns the current title and metadata.
    };
  }, [title, description, canonicalPath, jsonLd, robots]);
}
