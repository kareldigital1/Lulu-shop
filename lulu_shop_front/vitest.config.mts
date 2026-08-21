import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Borné à src/ : sinon Vitest ramasse les suites de tests livrées par les
    // dépendances (et le dossier résiduel node_modules_broken_*).
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
