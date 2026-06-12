import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror tsconfig's "@/*" → repo root so tests resolve app imports.
    alias: { "@": path.resolve(__dirname) },
  },
  // tsconfig sets jsx:"preserve" for Next's compiler, which would leave
  // .tsx test imports (the card components) unparseable here; compile JSX
  // with the automatic react runtime instead.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
  },
});
