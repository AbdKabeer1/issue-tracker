import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom provides a DOM so React components (.tsx) can be rendered
    // and tested with @testing-library. Pure unit tests (.ts) also run here
    // happily — a DOM is available but not required.
    environment: "jsdom",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    // `e2e` holds Playwright specs. They are a different runner, and the
    // glob above would otherwise collect them (#299).
    exclude: ["node_modules", ".next", "prisma", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      // Unit-testable code only. app/** (server actions, API routes) needs a
      // live Prisma/DB and is out of scope for jsdom unit tests.
      include: ["components/**/*.{ts,tsx}", "lib/**/*.ts"],
      // Ratchet these upward as component backfill continues. As of ENDOR-219
      // actuals are ~56% lines (lib ~83%, components ~38%); the gap is
      // untested components like app-header/login-form, not this issue's scope.
      thresholds: {
        lines: 50,
        functions: 70,
        branches: 75,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(__dirname, "node_modules/server-only/empty.js"),
    },
  },
});
