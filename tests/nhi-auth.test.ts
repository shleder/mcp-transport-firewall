import { jest, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import type { Request, Response, NextFunction } from "express";
import { nhiAuthValidator } from "../src/middleware/nhi-auth-validator.js";

function createMockReq(headers: Record<string, string> = {}): Partial<Request> {
  return {
    headers,
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

describe("nhiAuthValidator", () => {
  let stderrSpy: jest.SpyInstance;
  const validServerToken = "12345678901234567890123456789012";

  beforeAll(() => {
    process.env.PROXY_AUTH_TOKEN = validServerToken;
  });

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 401 if Authorization header is entirely missing", () => {
    const req = createMockReq({});
    const res = createMockRes();
    const next = jest.fn();

    nhiAuthValidator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe("AUTH_FAILURE");
  });

  it("strips Authorization header to enforce Zero Token Passthrough", () => {
    const nhiPayload = { token: validServerToken, scopes: ["tools.read"] };
    const base64 = Buffer.from(JSON.stringify(nhiPayload)).toString("base64");
    const req = createMockReq({ authorization: `Bearer ${base64}` });
    const res = createMockRes();
    const next = jest.fn();

    nhiAuthValidator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.headers?.authorization).toBeUndefined();
    expect(req.nhiScopes).toEqual(["tools.read"]);
  });

  it("returns 401 if NHI Base64 decoding fails / invalid structure", () => {
    const req = createMockReq({ authorization: `Bearer NotValidBase64JSON` });
    const res = createMockRes();
    const next = jest.fn();

    nhiAuthValidator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.message).toContain("Client NHI token structure is invalid");
  });

  it("returns 401 if NHI sub-token doesn't match SERVER_TOKEN", () => {
    const nhiPayload = { token: "wrong_token_here_1234567890123456", scopes: [] };
    const base64 = Buffer.from(JSON.stringify(nhiPayload)).toString("base64");
    const req = createMockReq({ authorization: `Bearer ${base64}` });
    const res = createMockRes();
    const next = jest.fn();

    nhiAuthValidator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
