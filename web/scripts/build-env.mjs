import { readFile } from "node:fs/promises";
import path from "node:path";

const ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local"];

function parseEnvFile(contents) {
  const entries = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    entries.set(match[1], match[2].replace(/^(['"])(.*)\1$/, "$2"));
  }
  return entries;
}

export async function loadBuildEnv(webDirectory, processEnv = process.env) {
  const values = new Map();
  for (const file of ENV_FILES) {
    try {
      const contents = await readFile(path.join(webDirectory, file), "utf8");
      for (const [key, value] of parseEnvFile(contents)) values.set(key, value);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  for (const key of ["VITE_API_URL", "VITE_SITE_URL", "SEO_SITE_URL"]) {
    if (processEnv[key]) values.set(key, processEnv[key]);
  }
  return values;
}

export function isLocalDevelopment(processEnv = process.env) {
  return processEnv.NODE_ENV === "development" && processEnv.BUILD_MODE !== "release";
}

export function requireApiBase(apiBase, stepName, processEnv = process.env) {
  if (!apiBase) {
    const message = `${stepName} requires VITE_API_URL. Set it to the public API origin before running a release build.`;
    if (isLocalDevelopment(processEnv)) {
      console.warn(`[SEO] ${message} Skipping this step in local development.`);
      return null;
    }
    throw new Error(message);
  }

  let url;
  try {
    url = new URL(apiBase);
  } catch {
    throw new Error(`VITE_API_URL is not a valid absolute URL: ${apiBase}`);
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
    throw new Error("VITE_API_URL must be an absolute HTTP or HTTPS URL.");
  }
  return apiBase.replace(/\/+$/, "");
}

export function handleBuildStepError(stepName, error, processEnv = process.env) {
  const message = error instanceof Error ? error.message : String(error);
  if (isLocalDevelopment(processEnv)) {
    console.warn(`[SEO] ${stepName} skipped in local development: ${message}`);
    return;
  }
  console.error(`[SEO] ${stepName} failed: ${message}`);
  process.exitCode = 1;
}
