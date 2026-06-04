import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Playwright specs live in e2e/ and use @playwright/test, not vitest. The
    // default include glob (**/*.spec.ts) would otherwise pick up e2e/*.spec.ts.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    coverage: {
      provider: "v8",
      include: [
        "src/shared/lib/**/*.ts",
        "src/shared/adapters/**/*.ts",
        "src/entities/**/model/*.ts",
        "src/widgets/app-shell/lib/**/*.ts",
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.itest.ts",
        "**/fixtures.ts",
        "**/types.ts",
      ],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
