import { describe, it, expect } from "vitest";
import { sanitizeShadowLeak } from "../engine.js";

describe("ShadowLeak Protection", () => {
  it("не должен изменять безопасные сообщения", () => {
    const msg = "Something went wrong during execution";
    const data = { details: "No sensitive info here" };

    const result = sanitizeShadowLeak(msg, data);

    expect(result.msg).toBe(msg);
    expect(result.data).toStrictEqual(data);
  });

  it("должен санитизировать сообщение, содержащее стек вызовов (stack trace)", () => {
    const msg = "Error: Connection failed\n    at Socket.TCPConn (net.js:123:45)\n    at Object.connect (tls.js:789:12)";
    const data = { code: 500 };

    const result = sanitizeShadowLeak(msg, data);

    expect(result.msg).toBe("Target server encountered an internal error.");
    expect(result.data).toBeUndefined();
  });

  it("должен санитизировать утечки путей (например, /etc/passwd)", () => {
    const msg = "Failed to read file from /etc/passwd: Permission denied";
    const result = sanitizeShadowLeak(msg);

    expect(result.msg).toBe("Target server encountered an internal error.");
  });

  it("должен санитизировать утечки путей (например, node_modules)", () => {
    const msg = "Cannot find module 'express' in /app/node_modules/express/index.js";
    const result = sanitizeShadowLeak(msg);

    expect(result.msg).toBe("Target server encountered an internal error.");
  });

  it("должен санитизировать утечки токенов API", () => {
    const msg = "Authentication failed";
    const data = { token: "sk-abc123def456ghi789jkl012mno345pqr" }; // 35 chars

    const result = sanitizeShadowLeak(msg, data);

    expect(result.msg).toBe("Target server encountered an internal error.");
    expect(result.data).toBeUndefined();
  });

  it("должен находить паттерны утечек в объекте data, даже если сообщение безопасно", () => {
    const msg = "Safe message";
    const data = {
      path: "C:\\Windows\\System32\\cmd.exe"
    };

    const result = sanitizeShadowLeak(msg, data);

    expect(result.msg).toBe("Target server encountered an internal error.");
    expect(result.data).toBeUndefined();
  });
});
