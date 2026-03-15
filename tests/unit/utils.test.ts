import { describe, it } from "node:test";
import assert from "node:assert";
import { getByteSize, formatBytes } from "../../src/utils/bytes.js";
import { resolveObjectPath } from "../../src/utils/object.js";

describe("Utils: bytes", () => {
  it("считает длину строки в байтах корректно", () => {
    assert.strictEqual(getByteSize("hello"), 5);
    assert.strictEqual(getByteSize("привет"), 12); 
    assert.strictEqual(getByteSize(""), 0);
  });

  it("форматирует байты в читаемый вид", () => {
    assert.strictEqual(formatBytes(1024), "1.00 KB");
    assert.strictEqual(formatBytes(1048576), "1.00 MB");
  });
});

describe("Utils: object", () => {
  it("разрешает путь (pickObjectContent)", () => {
    const obj = { user: { profile: { id: 1 } } };
    assert.strictEqual(resolveObjectPath(obj, "user.profile.id"), 1);
    assert.strictEqual(resolveObjectPath(obj, "user.unknown"), undefined);
    assert.strictEqual(resolveObjectPath(null, "some.path"), undefined);
  });
});
