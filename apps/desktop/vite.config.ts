import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    strictPort: true,
    host: "127.0.0.1",
    port: 1420
  },
  clearScreen: false,
  build: {
    chunkSizeWarningLimit: 700
  }
});
