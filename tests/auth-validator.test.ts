import type { Request, Response, NextFunction } from "express";
import { authValidator } from "../src/middleware/auth-validator.js";

function createMockReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
    ip: "127.0.0.1",
  };
}

function createMockRes(): Partial<Response> {
  const res: Partial<Response> = {
    status: jest.fn((code: number) => {
      return res as Response;
    }),
    json: jest.fn((body: unknown) => {
      return res as Response;
    }),
  };
  return res;
}

describe("authValidator", () => {
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.PROXY_AUTH_TOKEN;
  });

  it("handles missing PROXY_AUTH_TOKEN", () => {
    delete process.env.PROXY_AUTH_TOKEN;

    const req = createMockReq("Bearer somevalidlookingtokenthatislongenoughforvalidation");
    const res = createMockRes();
    const next = jest.fn();

    authValidator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.message).toContain("Fail-Closed");
  });

  it("handles missing Authorization header", () => {
    process.env.PROXY_AUTH_TOKEN = "abcdefghijklmnopqrstuvwxyz1234567890ABCDEF";

    const req = createMockReq();
    const res = createMockRes();
    const next = jest.fn();

    authValidator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("handles wrong token", () => {
    process.env.PROXY_AUTH_TOKEN = "abcdefghijklmnopqrstuvwxyz1234567890ABCDEF";

    const req = createMockReq("Bearer zyxwvutsrqponmlkjihgfedcba9876543210ZYXWVU");
    const res = createMockRes();
    const next = jest.fn();

    authValidator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("handles valid token", () => {
    const token = "abcdefghijklmnopqrstuvwxyz1234567890ABCDEF";
    process.env.PROXY_AUTH_TOKEN = token;

    const req = createMockReq(`Bearer ${token}`);
    const res = createMockRes();
    const next = jest.fn();

    authValidator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("handles short token", () => {
    process.env.PROXY_AUTH_TOKEN = "short";

    const req = createMockReq("Bearer short");
    const res = createMockRes();
    const next = jest.fn();

    authValidator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("handles wrong scheme", () => {
    process.env.PROXY_AUTH_TOKEN = "abcdefghijklmnopqrstuvwxyz1234567890ABCDEF";

    const req = createMockReq("Basic abcdefghijklmnopqrstuvwxyz1234567890ABCDEF");
    const res = createMockRes();
    const next = jest.fn();

    authValidator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("prevents token passthrough", () => {
    const token = "abcdefghijklmnopqrstuvwxyz1234567890ABCDEF";
    process.env.PROXY_AUTH_TOKEN = token;

    const req = createMockReq(`Bearer ${token}`) as Request;
    const res = createMockRes();
    const next = jest.fn();

    authValidator(req, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });
});
