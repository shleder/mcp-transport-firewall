import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  clearRoutes,
  configureRouteRegistryPersistence,
  disableRouteRegistryPersistence,
  getRegisteredRoutes,
  registerRoute,
  removeRoute,
  routeRequest,
} from "../src/proxy/router.js";

describe("router", () => {
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    disableRouteRegistryPersistence();
    clearRoutes();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    disableRouteRegistryPersistence();
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

  it("restores persisted route-registry entries after a restart-style reload", () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-route-registry-"));

    try {
      configureRouteRegistryPersistence(stateDir);
      registerRoute("search_tool", {
        url: "https://mcp-server.example.com/search",
        timeoutMs: 3000,
      });

      disableRouteRegistryPersistence();
      clearRoutes();
      expect(getRegisteredRoutes().size).toBe(0);

      configureRouteRegistryPersistence(stateDir);

      const routes = getRegisteredRoutes();
      expect(routes.has("search_tool")).toBe(true);
      expect(routes.get("search_tool")).toEqual({
        url: "https://mcp-server.example.com/search",
        timeoutMs: 3000,
      });
    } finally {
      disableRouteRegistryPersistence();
      clearRoutes();
      fs.rmSync(stateDir, { recursive: true, force: true });
    }
  });

  it("fails closed when the persisted route-registry snapshot is invalid", () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-route-registry-invalid-"));

    try {
      fs.writeFileSync(
        path.join(stateDir, "route-registry.json"),
        JSON.stringify({
          version: 1,
          routes: {
            broken_tool: {
              url: "not-a-url",
              timeoutMs: 1000,
            },
          },
        }),
        "utf8",
      );

      configureRouteRegistryPersistence(stateDir);

      expect(getRegisteredRoutes().size).toBe(0);
      expect(stderrSpy).toHaveBeenCalled();
      expect(String(stderrSpy.mock.calls.at(-1)?.[0] ?? "")).toContain("ROUTE_REGISTRY_RESTORE_FAILED");
    } finally {
      disableRouteRegistryPersistence();
      clearRoutes();
      fs.rmSync(stateDir, { recursive: true, force: true });
    }
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
