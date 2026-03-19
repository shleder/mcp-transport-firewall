import { registerRoute, removeRoute, getRegisteredRoutes, clearRoutes, routeRequest } from "../src/proxy/router.js";

describe("router", () => {
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    clearRoutes();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearRoutes();
  });

  it("registers a valid route via Zod schema", () => {
    registerRoute("search_tool", {
      url: "https://mcp-server.example.com/search",
      timeoutMs: 3000,
    });

    const routes = getRegisteredRoutes();
    expect(routes.has("search_tool")).toBe(true);
    expect(routes.get("search_tool")?.url).toBe("https://mcp-server.example.com/search");
  });

  it("rejects invalid route config (Fail-Closed)", () => {
    expect(() => {
      registerRoute("bad_tool", {
        url: "not-a-valid-url",
        timeoutMs: -5,
      });
    }).toThrow();
  });

  it("removes a registered route", () => {
    registerRoute("temp_tool", {
      url: "https://example.com/api",
      timeoutMs: 2000,
    });

    expect(removeRoute("temp_tool")).toBe(true);
    expect(getRegisteredRoutes().has("temp_tool")).toBe(false);
  });

  it("returns 403 UNKNOWN_ROUTE for unregistered tools (Fail-Closed)", async () => {
    const result = await routeRequest("nonexistent_tool", { query: "test" });

    expect(result.status).toBe(403);
    expect((result.body as Record<string, Record<string, string>>).error.code).toBe("UNKNOWN_ROUTE");
    expect(stderrSpy).toHaveBeenCalled();
  });

  it("returns 503 TARGET_UNREACHABLE when target server is down", async () => {
    registerRoute("unreachable_tool", {
      url: "https://localhost:19999/nonexistent",
      timeoutMs: 500,
    });

    const result = await routeRequest("unreachable_tool", { query: "test" });

    expect(result.status).toBe(503);
    expect((result.body as Record<string, Record<string, string>>).error.code).toBe("TARGET_UNREACHABLE");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
