import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" → repo root so tests resolve app imports.
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    environment: "node",
  },
});
