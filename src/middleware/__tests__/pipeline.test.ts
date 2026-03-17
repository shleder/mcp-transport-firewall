import { describe, it, expect } from "vitest";
import { Pipeline, MiddlewareContext, Middleware } from "../pipeline.js";

describe("Pipeline Fail-Closed Logic", () => {
  it("должен завершаться успешно, если middleware не бросает ошибок", async () => {
    const pipeline = new Pipeline();
    const ctx: MiddlewareContext = { rawMessage: "test", serverId: "server1" };

    let called = false;
    const testMiddleware: Middleware = async (c, next) => {
      called = true;
      await next();
    };

    pipeline.use(testMiddleware);
    await pipeline.execute(ctx);

    expect(called).toBe(true);
    expect(ctx.blocked).toBeUndefined();
    expect(ctx.blockReason).toBeUndefined();
  });

  it("должен устанавливать blocked = true и выбрасывать ошибку (Fail-Closed)", async () => {
    const pipeline = new Pipeline();
    const ctx: MiddlewareContext = { rawMessage: "test", serverId: "server1" };

    const failingMiddleware: Middleware = async () => {
      throw new Error("Simulated middleware failure");
    };

    let secondCalled = false;
    const secondMiddleware: Middleware = async (c, next) => {
      secondCalled = true; // This should not be reached
      await next();
    };

    pipeline.use(failingMiddleware);
    pipeline.use(secondMiddleware);

    // Ожидаем, что выбросится ошибка
    await expect(pipeline.execute(ctx)).rejects.toThrow("Simulated middleware failure");

    // Проверяем флаги Fail-Closed
    expect(ctx.blocked).toBe(true);
    expect(ctx.blockReason).toContain("Fail-Closed: Ошибка в middleware: Simulated middleware failure");
    
    // Второе middleware не должно было вызваться
    expect(secondCalled).toBe(false);
  });
});
