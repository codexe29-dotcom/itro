import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadBuildEnv, requireApiBase } from "./build-env.mjs";

const webDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const releaseBuild = !process.argv.includes("--development");
const buildMode = releaseBuild ? "release" : "development";
const env = {
  ...process.env,
  BUILD_MODE: buildMode,
  NODE_ENV: releaseBuild ? "production" : "development",
};

async function main() {
  const buildEnv = await loadBuildEnv(webDirectory, env);
  const apiBase = requireApiBase(buildEnv.get("VITE_API_URL"), "SEO build", env);
  if (apiBase) env.VITE_API_URL = apiBase;

  for (const key of ["VITE_SITE_URL", "SEO_SITE_URL"]) {
    if (buildEnv.has(key)) env[key] = buildEnv.get(key);
  }

  const npmCli = env.npm_execpath;
  if (!npmCli) throw new Error("Cannot locate npm CLI. Run this command through `npm run build`.");

  const steps = [
    { command: process.execPath, args: [npmCli, "run", "build:compile"] },
    { command: process.execPath, args: [fileURLToPath(new URL("./generate-sitemap.mjs", import.meta.url))] },
    { command: process.execPath, args: [fileURLToPath(new URL("./prerender-public-routes.mjs", import.meta.url))] },
  ];
  for (const step of steps) {
    const result = spawnSync(step.command, step.args, {
      cwd: webDirectory,
      env,
      stdio: "inherit",
      windowsHide: true,
    });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${path.basename(step.args[0])} exited with status ${result.status ?? "unknown"}.`);
    }
  }
}

main().catch((error) => {
  console.error(`[build] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
