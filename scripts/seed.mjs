import { spawnSync } from "node:child_process";
if (!process.env.SEED_PASSWORD) {
  console.error("Define SEED_PASSWORD antes de ejecutar este comando.");
  process.exit(1);
}
const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "db:seed", "-w", "backend"],
  {
    stdio: "inherit",
    env: { ...process.env, SEED_DEMO: "true" },
    shell: process.platform === "win32",
  },
);
process.exit(result.status ?? 1);
