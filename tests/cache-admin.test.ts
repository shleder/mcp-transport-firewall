import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleCacheRoutes } from "../src/admin/handlers/cache.js";
import { HTTP_STATUS } from "../src/constants.js";
import { NotFoundError, ValidationError } from "../src/errors.js";
import { EventEmitter } from "events";
import type { IncomingMessage, ServerResponse } from "http";

class MockReq extends EventEmitter {
  method = "GET";
  url = "/cache/stats";
  headers = { host: "localhost" };
  
  sendBody(body: string) {
    this.emit("data", Buffer.from(body));
    this.emit("end");
  }
}

describe("Cache Admin Handlers", () => {
  let req: MockReq;
  let res: any;
  let mockCacheManager: any;

  beforeEach(() => {
    req = new MockReq();
    res = {
      writeHead: vi.fn(),
      end: vi.fn(),
    };
    mockCacheManager = {
      getStats: vi.fn().mockReturnValue({ hits: 10, misses: 2 }),
      clear: vi.fn(),
      invalidator: {
        invalidateByKey: vi.fn().mockReturnValue(true),
        invalidateByMethod: vi.fn().mockReturnValue(5),
      }
    };
  });

  it("should return stats on GET /cache/stats", async () => {
    req.method = "GET";
    req.url = "/cache/stats";
    
    await handleCacheRoutes(req as any, res, mockCacheManager);
    
    expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ hits: 10, misses: 2 }));
    expect(mockCacheManager.getStats).toHaveBeenCalled();
  });

  it("should clear cache on DELETE /cache", async () => {
    req.method = "DELETE";
    req.url = "/cache";
    
    await handleCacheRoutes(req as any, res, mockCacheManager);
    
    expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: "ok", message: "Кэш полностью очищен" }));
    expect(mockCacheManager.clear).toHaveBeenCalled();
  });

  it("should invalidate by key on POST /cache/invalidate", async () => {
    req.method = "POST";
    req.url = "/cache/invalidate";
    
    const promise = handleCacheRoutes(req as any, res, mockCacheManager);
    req.sendBody(JSON.stringify({ key: "test-key" }));
    await promise;
    
    expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: "ok", result: true }));
    expect(mockCacheManager.invalidator.invalidateByKey).toHaveBeenCalledWith("test-key");
  });

  it("should invalidate by method on POST /cache/invalidate", async () => {
    req.method = "POST";
    req.url = "/cache/invalidate";
    
    const promise = handleCacheRoutes(req as any, res, mockCacheManager);
    req.sendBody(JSON.stringify({ method: "read_file" }));
    await promise;
    
    expect(res.writeHead).toHaveBeenCalledWith(200, { "Content-Type": "application/json" });
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ status: "ok", result: 5 }));
    expect(mockCacheManager.invalidator.invalidateByMethod).toHaveBeenCalledWith("read_file");
  });

  it("should throw ValidationError if no key or method provided", async () => {
    req.method = "POST";
    req.url = "/cache/invalidate";
    
    const promise = handleCacheRoutes(req as any, res, mockCacheManager);
    req.sendBody(JSON.stringify({ something: "else" }));
    
    await expect(promise).rejects.toThrowError(ValidationError);
  });

  it("should throw ValidationError on invalid JSON", async () => {
    req.method = "POST";
    req.url = "/cache/invalidate";
    
    const promise = handleCacheRoutes(req as any, res, mockCacheManager);
    req.sendBody("{ invalid json }");
    
    await expect(promise).rejects.toThrowError(ValidationError);
  });

  it("should reject on req error", async () => {
    req.method = "POST";
    req.url = "/cache/invalidate";
    
    const promise = handleCacheRoutes(req as any, res, mockCacheManager);
    req.emit("error", new Error("Network error"));
    
    await expect(promise).rejects.toThrowError("Network error");
  });

  it("should throw NotFoundError on unknown route", async () => {
    req.method = "GET";
    req.url = "/unknown";
    
    await expect(handleCacheRoutes(req as any, res, mockCacheManager)).rejects.toThrowError(NotFoundError);
  });
  
  it("should treat empty body as {} in readJsonBody", async () => {
    req.method = "POST";
    req.url = "/cache/invalidate";
    
    const promise = handleCacheRoutes(req as any, res, mockCacheManager);
    req.sendBody("");
    
    await expect(promise).rejects.toThrowError(ValidationError);
  });
});
