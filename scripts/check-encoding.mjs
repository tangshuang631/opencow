import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const files = [
  "OPENCOW_CORE_RULES.md",
  "README.md",
  "package.json",
  "apps/desktop/package.json",
  "apps/desktop/index.html"
];

for (const file of files) {
  const buffer = readFileSync(file);
  const text = buffer.toString("utf8");
  if (text.includes("\uFFFD")) {
    throw new Error(`Encoding check failed: ${file}`);
  }
}

for (const file of globSync("apps/desktop/src/**/*.{ts,tsx,css}")) {
  const text = readFileSync(file).toString("utf8");
  if (text.includes("\uFFFD")) {
    throw new Error(`Encoding check failed: ${file}`);
  }
}

for (const file of globSync("packages/**/*.{ts,tsx,css,json,md}")) {
  const text = readFileSync(file).toString("utf8");
  if (text.includes("\uFFFD")) {
    throw new Error(`Encoding check failed: ${file}`);
  }
}

console.log("encoding check passed");
