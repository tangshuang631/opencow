import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function readDesktopFile(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function readRepoFile(relativePath: string) {
  return readFileSync(join(process.cwd(), "..", "..", relativePath), "utf8");
}

describe("desktop dev server contract", () => {
  it("keeps the Vite dev server pinned to the Tauri desktop devUrl", () => {
    const viteConfigText = readDesktopFile("vite.config.ts");
    const tauriConfig = JSON.parse(readDesktopFile("src-tauri/tauri.conf.json")) as {
      build: { devUrl: string };
    };
    const tauriDevUrl = new URL(tauriConfig.build.devUrl);

    expect(viteConfigText).toContain(`host: "${tauriDevUrl.hostname}"`);
    expect(viteConfigText).toContain(`port: ${Number(tauriDevUrl.port)}`);
    expect(viteConfigText).toContain("strictPort: true");
  });

  it("starts the main desktop webview from a dedicated dev data directory", () => {
    const tauriConfig = JSON.parse(readDesktopFile("src-tauri/tauri.conf.json")) as {
      app: {
        windows: Array<{
          title?: string;
          create?: boolean;
          incognito?: boolean;
          dataDirectory?: string;
        }>;
      };
    };

    const mainWindow = tauriConfig.app.windows.find((window) => window.title === "opencow");

    expect(mainWindow).toBeDefined();
    expect(mainWindow?.create).toBe(false);
    expect(mainWindow?.incognito).not.toBe(true);
    expect(mainWindow?.dataDirectory).toBe("dev-webview");
  });

  it("creates the desktop webview with an explicit runtime data directory", () => {
    const libRs = readDesktopFile("src-tauri/src/lib.rs");

    expect(libRs).toContain(".setup(|app|");
    expect(libRs).toContain("WebviewWindowBuilder::from_config");
    expect(libRs).toContain("app_local_data_dir");
    expect(libRs).toContain(".data_directory(");
  });

  it("does not mix static and dynamic imports for the same Ollama service module", () => {
    const appTsx = readDesktopFile("src/app/App.tsx");

    expect(appTsx).not.toContain('await import("../features/ollama/ollamaService")');
  });

  it("starts the desktop test launcher without silently reusing an already running dev server", () => {
    const launcher = readRepoFile("start-opencow-test.bat");

    expect(launcher).toContain("setlocal EnableExtensions EnableDelayedExpansion");
    expect(launcher).toContain("npm run desktop:dev");
    expect(launcher).not.toContain("set \"FRONTEND_ALREADY_RUNNING=");
    expect(launcher).not.toContain("cargo run --no-default-features");
  });

  it("refreshes the OpenClaw adapter build before launching the desktop runtime", () => {
    const launcher = readRepoFile("start-opencow-test.bat");

    expect(launcher).toContain("npm run predesktop:dev");
    expect(launcher.indexOf("npm run predesktop:dev")).toBeLessThan(
      launcher.indexOf("npm run desktop:dev")
    );
  });

  it("refreshes the OpenClaw adapter build before root desktop dev startup", () => {
    const rootPackage = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(rootPackage.scripts["predesktop:dev"]).toBe("npm --workspace packages/openclaw-adapter run build");
    expect(rootPackage.scripts["desktop:dev"]).toBe("npm --workspace apps/desktop run tauri:dev");
  });

  it("exposes a local-only WebView2 debugging port for desktop smoke automation", () => {
    const launcher = readRepoFile("start-opencow-test.bat");

    expect(launcher).toContain("set \"WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=");
    expect(launcher).toContain("--enable-features=msEdgeDevToolsWdpRemoteDebugging");
    expect(launcher).toContain("--remote-debugging-port=9333");
    expect(launcher).toContain("http://127.0.0.1:9333/json");
  });
});
