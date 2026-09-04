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

  it("declares dedicated desktop icon assets in the tauri source tree", () => {
    const tauriConfig = JSON.parse(readDesktopFile("src-tauri/tauri.conf.json")) as {
      bundle?: {
        icon?: string[];
      };
    };

    expect(tauriConfig.bundle?.icon).toEqual([
      "icons/icon.png",
      "icons/icon.ico",
      "icons/icon.icns"
    ]);
  });

  it("keeps a repo script for refreshing the desktop app copy from the latest mac bundle", () => {
    const rootPackage = JSON.parse(readRepoFile("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(rootPackage.scripts["desktop:sync:mac"]).toBeDefined();
    expect(rootPackage.scripts["desktop:sync:mac"]).toContain("sync-opencow-mac-apps.py");
    expect(rootPackage.scripts["desktop:run:mac"]).toBe("zsh scripts/start-opencow-latest-desktop-mac.command");
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

  it("keeps check-mode launcher failures non-interactive", () => {
    const launcher = readRepoFile("start-opencow-test.bat");

    const checkModeExitIndex = launcher.indexOf('if /I "%MODE%"=="check"');
    const pauseIndex = launcher.indexOf("pause >nul");

    expect(checkModeExitIndex).toBeGreaterThanOrEqual(0);
    expect(pauseIndex).toBeGreaterThanOrEqual(0);
    expect(checkModeExitIndex).toBeLessThan(pauseIndex);
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

  it("refreshes the mac desktop app bundle through the sync script before copying the app", () => {
    const syncScript = readRepoFile("scripts/sync-opencow-mac-apps.py");

    expect(syncScript).toContain('["npm", "--workspace", "apps/desktop", "run", "build"]');
    expect(syncScript).toContain('["npm", "run", "tauri:build"]');
    expect(syncScript).toContain("copy_app_bundle(DESKTOP_BUNDLE, DESKTOP_TARGET)");
    expect(syncScript).not.toContain("LATEST_TEST_APP");
    expect(syncScript).not.toContain("WEB_TARGET");
    expect(syncScript.indexOf('["npm", "--workspace", "apps/desktop", "run", "build"]')).toBeLessThan(
      syncScript.indexOf("copy_app_bundle")
    );
    expect(syncScript.indexOf('["npm", "run", "tauri:build"]')).toBeLessThan(
      syncScript.indexOf("copy_app_bundle")
    );
  });

  it("starts the mac desktop launcher by syncing before opening the desktop app", () => {
    const launcher = readRepoFile("scripts/start-opencow-latest-desktop-mac.command");

    expect(launcher).toContain('SYNC_SCRIPT="${REPO_ROOT}/scripts/sync-opencow-mac-apps.py"');
    expect(launcher).toContain('python3 "${SYNC_SCRIPT}"');
    expect(launcher).not.toContain("python3 scripts/sync-opencow-mac-apps.py");
    expect(launcher).toContain('if [[ ! -x "${DESKTOP_APP}/Contents/MacOS/${APP_EXECUTABLE}" ]]; then');
    expect(launcher).toContain('/usr/bin/open -n "${DESKTOP_APP}"');
    expect(launcher.indexOf('python3 "${SYNC_SCRIPT}"')).toBeLessThan(
      launcher.indexOf('/usr/bin/open -n "${DESKTOP_APP}"')
    );
    expect(launcher).toContain("APP_BUNDLE_ID=\"cn.opencow.desktop\"");
    expect(launcher).toContain("APP_EXECUTABLE=\"opencow-desktop\"");
  });

  it("exposes a local-only WebView2 debugging port for desktop smoke automation", () => {
    const launcher = readRepoFile("start-opencow-test.bat");

    expect(launcher).toContain("set \"WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=");
    expect(launcher).toContain("--enable-features=msEdgeDevToolsWdpRemoteDebugging");
    expect(launcher).toContain("--remote-debugging-port=9333");
    expect(launcher).toContain("http://127.0.0.1:9333/json");
  });
});
