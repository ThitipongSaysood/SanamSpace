import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
    // Playwright specs live in e2e/ and run via `npx playwright test`, not Vitest.
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
