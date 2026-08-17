import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // Mirrors the "@/*" -> "src/*" alias from tsconfig.json so tests import
    // application modules exactly the way the app does.
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Payment tests stub the repositories, so no database is required.
    restoreMocks: true,
  },
});
