import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
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
        "**/fixtures.ts",
        "**/types.ts",
      ],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
