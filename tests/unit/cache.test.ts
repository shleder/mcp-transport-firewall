import { describe, it } from "node:test";
import assert from "node:assert";
import { buildMcpCacheKey } from "../../src/cache/key-builder.js";

describe("Key Builder", () => {
  it("создает детерминированный ключ с сортировкой", () => {
    const result1 = buildMcpCacheKey("srv1", "tools/call", { z: 1, a: 2 });
    const result2 = buildMcpCacheKey("srv1", "tools/call", { a: 2, z: 1 });

    assert.strictEqual(result1.key, result2.key);
    assert.ok(result1.key.length > 20); 
  });

  it("отличается для разных серверов", () => {
    const r1 = buildMcpCacheKey("srv1", "method", {});
    const r2 = buildMcpCacheKey("srv2", "method", {});
    assert.notStrictEqual(r1.key, r2.key);
  });

  it("отличается для разных методов", () => {
    const r1 = buildMcpCacheKey("srv1", "method1", {});
    const r2 = buildMcpCacheKey("srv1", "method2", {});
    assert.notStrictEqual(r1.key, r2.key);
  });
});
