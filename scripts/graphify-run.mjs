import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUPPORTED_KEY_NAMES = [
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "MOONSHOT_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "DEEPSEEK_API_KEY"
];

export function hasAnyLlmApiKey(env = process.env) {
  return SUPPORTED_KEY_NAMES.some((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

export function normalizeModuleName(modulePath) {
  return modulePath
    .replace(/^[./\\]+/, "")
    .replace(/[\\\/]+/g, "_")
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function buildGraphifyOutputDirName(modulePath) {
  const normalized = normalizeModuleName(modulePath);
  return normalized ? `graphify_${normalized}` : "graphify";
}

const CODE_FILE_EXTENSIONS = new Set([
  ".c",
  ".cc",
  ".cpp",
  ".cs",
  ".css",
  ".go",
  ".h",
  ".hpp",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".kts",
  ".lua",
  ".m",
  ".mm",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".scala",
  ".scss",
  ".sh",
  ".swift",
  ".ts",
  ".tsx",
  ".vue",
  ".zig"
]);

const SKIP_PATH_SEGMENTS = new Set([
  ".git",
  "dist",
  "graphify",
  "graphify-out",
  "node_modules",
  "vendor"
]);

export function collectCodeFiles(relativePaths) {
  return relativePaths.filter((relativePath) => {
    const normalized = relativePath.replace(/\\/g, "/");
    const segments = normalized.split("/");
    if (segments.some((segment) => SKIP_PATH_SEGMENTS.has(segment))) {
      return false;
    }
    return CODE_FILE_EXTENSIONS.has(path.extname(normalized));
  });
}

function parseArgs(argv) {
  const [targetArg = ".", ...rest] = argv;
  const modulePath = targetArg.trim() || ".";
  const extraArgs = [];
  let clean = false;

  for (const arg of rest) {
    if (arg === "--clean") {
      clean = true;
      continue;
    }
    extraArgs.push(arg);
  }

  return {
    modulePath,
    clean,
    extraArgs
  };
}

function resolvePaths(modulePath) {
  const cwd = process.cwd();
  const targetPath = path.resolve(cwd, modulePath);
  const outputDirName = buildGraphifyOutputDirName(modulePath === "." ? "" : modulePath);
  const outputPath = path.join(cwd, outputDirName);

  return {
    cwd,
    targetPath,
    outputDirName,
    outputPath
  };
}

function ensureTargetExists(targetPath) {
  if (!existsSync(targetPath)) {
    throw new Error(`Graphify target does not exist: ${targetPath}`);
  }
}

function prepareOutputDir(outputPath, clean) {
  if (clean && existsSync(outputPath)) {
    rmSync(outputPath, { recursive: true, force: true });
  }
  mkdirSync(outputPath, { recursive: true });
}

function buildExtractArgs(targetPath, outputPath, extraArgs, useFullCorpus) {
  const args = ["extract", targetPath, "--out", outputPath, ...extraArgs];
  if (!useFullCorpus && !extraArgs.includes("--no-cluster")) {
    args.push("--no-cluster");
  }
  return args;
}

function walkRelativeFiles(rootPath, currentPath = rootPath, results = []) {
  for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
    if (SKIP_PATH_SEGMENTS.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, absolutePath);

    if (entry.isDirectory()) {
      walkRelativeFiles(rootPath, absolutePath, results);
      continue;
    }

    results.push(relativePath);
  }

  return results;
}

function stageCodeOnlyCorpus(targetPath, outputPath) {
  const stageRoot = path.join(outputPath, "_code_only_input");
  rmSync(stageRoot, { recursive: true, force: true });
  mkdirSync(stageRoot, { recursive: true });

  const relativeFiles = walkRelativeFiles(targetPath);
  const codeFiles = collectCodeFiles(relativeFiles);

  if (codeFiles.length === 0) {
    throw new Error(`No supported code files found under ${targetPath}`);
  }

  for (const relativePath of codeFiles) {
    const sourcePath = path.join(targetPath, relativePath);
    const destinationPath = path.join(stageRoot, relativePath);
    mkdirSync(path.dirname(destinationPath), { recursive: true });
    copyFileSync(sourcePath, destinationPath);
  }

  return stageRoot;
}

function runGraphify(args) {
  return spawnSync("graphify", args, {
    stdio: "inherit",
    encoding: "utf8"
  });
}

export function runGraphifyExtraction(argv = process.argv.slice(2), env = process.env) {
  const { modulePath, clean, extraArgs } = parseArgs(argv);
  const { targetPath, outputDirName, outputPath } = resolvePaths(modulePath);

  ensureTargetExists(targetPath);
  prepareOutputDir(outputPath, clean);

  const useFullCorpus = hasAnyLlmApiKey(env);
  const extractTargetPath = useFullCorpus ? targetPath : stageCodeOnlyCorpus(targetPath, outputPath);
  const args = buildExtractArgs(extractTargetPath, outputPath, extraArgs, useFullCorpus);

  console.log(
    `[graphify-run] target=${targetPath} output=${outputDirName} mode=${useFullCorpus ? "full" : "code-only"}`
  );
  if (!useFullCorpus) {
    console.log(
      "[graphify-run] no supported LLM API key detected; falling back to code-only extraction with --no-cluster"
    );
  }

  const result = runGraphify(args);
  if (result.status !== 0) {
    throw new Error(`graphify failed with exit code ${result.status ?? 1}`);
  }

  return {
    targetPath,
    outputPath,
    outputDirName,
    useFullCorpus
  };
}

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  try {
    const result = runGraphifyExtraction();
    console.log(`[graphify-run] graph written to ${result.outputPath}`);
  } catch (error) {
    console.error(`[graphify-run] ${error.message}`);
    process.exit(1);
  }
}
