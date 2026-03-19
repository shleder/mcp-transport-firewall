import type { Request, Response, NextFunction } from "express";
import { scopeValidator } from "../src/middleware/scope-validator.js";

function createMockReq(body: Record<string, unknown>, nhiScopes: string[] = []): Partial<Request> {
  return {
    body,
    nhiScopes,
    ip: "127.0.0.1",
  };
}

function createMockRes(): Partial<Response> {
  const res: Partial<Response> = {
    status: jest.fn((code: number) => res as Response),
    json: jest.fn((body: unknown) => res as Response),
  };
  return res;
}

describe("scopeValidator", () => {
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 403 if tool scope is entirely missing from nhiScopes", () => {
    const req = createMockReq(
      { tools: [{ name: "modify_database" }] },
      ["tools.read_files"] // lacking tools.modify_database
    );
    const res = createMockRes();
    const next = jest.fn();

    scopeValidator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe("MISSING_SCOPE");
    expect(body.error.message).toContain("lacks the required scope 'tools.modify_database'");
  });

  it("allows request if exact tool scope matches", () => {
    const req = createMockReq(
      { tools: [{ name: "read_files" }] },
      ["tools.read_files", "tools.ping"]
    );
    const res = createMockRes();
    const next = jest.fn();

    scopeValidator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows request if wildcard tools.* scope is present", () => {
    const req = createMockReq(
      { tools: [{ name: "destructive_action" }] },
      ["tools.*"]
    );
    const res = createMockRes();
    const next = jest.fn();

    scopeValidator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("checks recursive/nested body parameters", () => {
    const req = createMockReq(
      { params: { tools: [{ name: "nested_tool" }] } },
      ["tools.nested_tool"]
    );
    const res = createMockRes();
    const next = jest.fn();

    scopeValidator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows empty tools array", () => {
    const req = createMockReq({ tools: [] }, []);
    const res = createMockRes();
    const next = jest.fn();

    scopeValidator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
