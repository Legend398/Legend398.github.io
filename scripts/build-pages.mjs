import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://legend398.github.io";

rmSync(resolve(root, "out"), { recursive: true, force: true });

const result = spawnSync(process.execPath, [nextCli, "build"], {
  cwd: root,
  env: {
    ...process.env,
    GITHUB_PAGES: "true",
    NEXT_PUBLIC_SITE_URL: siteUrl,
    NEXT_TELEMETRY_DISABLED: "1",
  },
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
