import { describe, it } from "node:test";
import assert from "node:assert";
import { ConfigSchema } from "../../src/config/schema.js";

describe("Config Schema", () => {
  it("валидирует дефолтный конфиг без ошибок", () => {
    const result = ConfigSchema.safeParse({
       target: { command: "node", args: ["server.js"] }
    });

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.cache.l1MaxItems, 10000);
      assert.strictEqual(result.data.cache.compress, true);
      assert.strictEqual(result.data.target.command, "node");
    }
  });

  it("отклоняет невалидные типы", () => {
    const result = ConfigSchema.safeParse({
       target: { command: 123 }
    });
    assert.strictEqual(result.success, false);
  });
});
