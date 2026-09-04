import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(scriptPath), "..");

export function createBaselineSnapshot(input) {
  if (typeof input?.branch !== "string" || input.branch.length === 0) {
    throw new Error("branch must be a non-empty string");
  }

  if (!/^[0-9a-f]{40}$/.test(input.commitSha ?? "")) {
    throw new Error("commitSha must be a 40-character lowercase hexadecimal SHA");
  }

  if (typeof input.nodeVersion !== "string" || input.nodeVersion.length === 0) {
    throw new Error("nodeVersion must be a non-empty string");
  }

  if (typeof input.openclawVersion !== "string" || !/^\d{4}\.\d+\.\d+$/.test(input.openclawVersion)) {
    throw new Error("openclawVersion must be a stable version");
  }

  if (!Array.isArray(input.testCommands) || input.testCommands.some((command) => typeof command !== "string")) {
    throw new Error("testCommands must be an array of strings");
  }

  return {
    branch: input.branch,
    commitSha: input.commitSha,
    nodeVersion: input.nodeVersion,
    openclawVersion: input.openclawVersion,
    testCommands: [...input.testCommands]
  };
}

export function serializeBaselineSnapshot(snapshot) {
  return JSON.stringify({
    branch: snapshot.branch,
    commitSha: snapshot.commitSha,
    nodeVersion: snapshot.nodeVersion,
    openclawVersion: snapshot.openclawVersion,
    testCommands: snapshot.testCommands
  }) + "\n";
}

function readGitValue(...args) {
  return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
}

export function collectBaselineSnapshot() {
  const openclawPackage = JSON.parse(readFileSync(resolve(repoRoot, "vendor/openclaw/package.json"), "utf8"));

  return createBaselineSnapshot({
    branch: readGitValue("branch", "--show-current"),
    commitSha: readGitValue("rev-parse", "HEAD"),
    nodeVersion: process.version,
    openclawVersion: openclawPackage.version,
    testCommands: [
      "npm run check:encoding",
      "npm run test:unit",
      "npm --workspace packages/openclaw-adapter run build",
      "npm run eval:wp0",
      "npm run benchmark:vector"
    ]
  });
}

if (process.argv[1] === scriptPath) {
  process.stdout.write(serializeBaselineSnapshot(collectBaselineSnapshot()));
}
