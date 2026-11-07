import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const siteUrl = (env.VITE_SITE_URL || "https://itro.co.in").replace(/\/+$/, "");
  let apiOrigin = "http://localhost:4000";
  try {
    apiOrigin = new URL(env.VITE_API_URL || `${apiOrigin}/api`).origin;
  } catch {
    console.warn("VITE_API_URL is invalid; uploads proxying to http://localhost:4000.");
  }

  return {
    plugins: [
      react(),
      {
        name: "seo-site-url",
        transformIndexHtml(html) {
          return html.replaceAll("__VITE_SITE_URL__", siteUrl);
        },
      },
    ],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      host: "localhost",
      port: 5000,
      strictPort: true,
      proxy: { "/uploads": { target: apiOrigin, changeOrigin: true } },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = id.replaceAll("\\", "/");
            if (!moduleId.includes("/node_modules/")) return;

            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(moduleId)) return "vendor-react";
            if (/\/node_modules\/(react-router|react-router-dom|@remix-run\/router)\//.test(moduleId)) return "vendor-router";
            if (/\/node_modules\/(recharts|victory-vendor|d3-[^/]+)\//.test(moduleId)) return "vendor-charts";
            if (/\/node_modules\/lucide-react\//.test(moduleId)) return "vendor-icons";
            if (/\/node_modules\/date-fns\//.test(moduleId)) return "vendor-dates";
            if (/\/node_modules\/zod\//.test(moduleId)) return "vendor-validation";
            if (/\/node_modules\/leaflet\//.test(moduleId)) return "vendor-maps";
            if (/\/node_modules\/@radix-ui\//.test(moduleId)) return "vendor-ui";
            if (/\/node_modules\/@tanstack\//.test(moduleId)) return "vendor-query";

            return "vendor";
          },
        },
      },
    },
  };
});
