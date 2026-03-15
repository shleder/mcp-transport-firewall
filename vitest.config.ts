import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/circuit-breaker.test.ts", "tests/cache-admin.test.ts"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "json", "html"],
      include: ["src/proxy/circuit-breaker.ts", "src/admin/handlers/cache.ts"]
    }
  }
});
