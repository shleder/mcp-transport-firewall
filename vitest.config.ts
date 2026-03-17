import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "tests/circuit-breaker.test.ts", 
      "tests/cache-admin.test.ts",
      "src/middleware/__tests__/pipeline.test.ts",
      "src/proxy/__tests__/shadowleak.test.ts"
    ],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "json", "html"],
      include: [
        "src/proxy/circuit-breaker.ts", 
        "src/admin/handlers/cache.ts",
        "src/middleware/pipeline.ts",
        "src/proxy/engine.ts"
      ]
    }
  }
});
