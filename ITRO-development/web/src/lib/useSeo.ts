import { useEffect } from "react";

/**
 * Lightweight SEO/meta manager for this client-rendered SPA.
 *
 * Sets <title>, meta description, canonical URL and injects one or more
 * JSON-LD structured-data blocks (e.g. FAQPage, BreadcrumbList). Google and
 * modern AI answer engines execute JS, so injected FAQPage schema is what lets
 * LLMs and rich results extract our Q&A. Everything is cleaned up on unmount
 * so pages don't leak stale tags into each other.
 */
export interface SeoOptions {
  title: string;
  description?: string;
  canonicalPath?: string; // e.g. "/industries/aerospace-defense"
  jsonLd?: object[];       // structured-data blocks
}

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

export function useSeo({ title, description, canonicalPath, jsonLd }: SeoOptions) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;

    upsertProperty("og:title", title);
    if (description) {
      upsertMeta("description", description);
      upsertProperty("og:description", description);
    }

    let canonical: HTMLLinkElement | null = null;
    if (canonicalPath) {
      const href = `${window.location.origin}${canonicalPath}`;
      canonical = document.head.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.setAttribute("rel", "canonical");
        document.head.appendChild(canonical);
      }
      canonical.setAttribute("href", href);
      upsertProperty("og:url", href);
    }

    // Inject JSON-LD blocks tagged so we can remove exactly these on cleanup.
    const scripts: HTMLScriptElement[] = (jsonLd ?? []).map((block) => {
      const s = document.createElement("script");
      s.type = "application/ld+json";
      s.setAttribute("data-seo", "managed");
      s.text = JSON.stringify(block);
      document.head.appendChild(s);
      return s;
    });

    return () => {
      document.title = prevTitle;
      scripts.forEach((s) => s.remove());
      // Leave canonical/description in place; the next page's useSeo overwrites them.
    };
  }, [title, description, canonicalPath, jsonLd]);
}
