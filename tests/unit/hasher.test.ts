import { describe, it } from "node:test";
import assert from "node:assert";
import { generateHashContext } from "../../src/hasher.js";

describe("generateHashContext", () => {
  it("должен возвращать одинаковый хэш для идентичных параметров", () => {
    const hash1 = generateHashContext("my-server", "tools/call", { a: 1, b: 2 });
    const hash2 = generateHashContext("my-server", "tools/call", { a: 1, b: 2 });
    assert.strictEqual(hash1, hash2);
  });

  it("должен возвращать одинаковый хэш независимо от порядка ключей", () => {
    const hash1 = generateHashContext("my-server", "tools/call", { a: 1, b: 2 });
    const hash2 = generateHashContext("my-server", "tools/call", { b: 2, a: 1 });
    assert.strictEqual(hash1, hash2);
  });

  it("должен возвращать разные хэши для разных параметров", () => {
    const hash1 = generateHashContext("my-server", "tools/call", { a: 1, b: 2 });
    const hash2 = generateHashContext("my-server", "tools/call", { a: 1, b: 3 });
    assert.notStrictEqual(hash1, hash2);
  });

  it("должен корректно работать без параметров", () => {
    const hash1 = generateHashContext("my-server", "resources/read", undefined);
    const hash2 = generateHashContext("my-server", "resources/read", undefined);
    assert.strictEqual(hash1, hash2);
    assert.ok(hash1.length > 10);
  });
});
