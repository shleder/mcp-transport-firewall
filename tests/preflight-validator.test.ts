import type { Request, Response, NextFunction } from "express";
import { preflightValidator, registerPreflight, clearPreflightRegistries } from "../src/middleware/preflight-validator.js";

function createMockReq(body: Record<string, unknown>): Partial<Request> {
  return {
    body,
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

describe("preflightValidator", () => {
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
    clearPreflightRegistries();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearPreflightRegistries();
  });

  it("blocks Blue tool without preflightId", () => {
    const req = createMockReq({
      params: {
        tools: [
          { name: "modify_database", _meta: { color: "blue" } },
        ],
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    preflightValidator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe("PREFLIGHT_REQUIRED");
  });

  it("blocks Blue tool with unregistered preflightId", () => {
    const req = createMockReq({
      params: {
        tools: [
          {
            name: "modify_database",
            _meta: { color: "blue" },
            preflightId: "550e8400-e29b-41d4-a716-446655440000",
          },
        ],
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    preflightValidator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe("PREFLIGHT_NOT_FOUND");
  });

  it("allows Blue tool with valid registered preflightId", () => {
    const validId = "550e8400-e29b-41d4-a716-446655440000";
    registerPreflight(validId);

    const req = createMockReq({
      params: {
        tools: [
          {
            name: "modify_database",
            _meta: { color: "blue" },
            preflightId: validId,
          },
        ],
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    preflightValidator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("blocks replay attack: reusing consumed preflightId", () => {
    const validId = "550e8400-e29b-41d4-a716-446655440000";
    registerPreflight(validId);

    const makeReq = () => createMockReq({
      params: {
        tools: [
          {
            name: "modify_database",
            _meta: { color: "blue" },
            preflightId: validId,
          },
        ],
      },
    });

    const res1 = createMockRes();
    const next1 = jest.fn();
    preflightValidator(makeReq() as Request, res1 as Response, next1 as NextFunction);
    expect(next1).toHaveBeenCalledTimes(1);

    const res2 = createMockRes();
    const next2 = jest.fn();
    preflightValidator(makeReq() as Request, res2 as Response, next2 as NextFunction);

    expect(next2).not.toHaveBeenCalled();
    expect(res2.status).toHaveBeenCalledWith(403);
    const body = (res2.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe("PREFLIGHT_ALREADY_USED");
  });

  it("allows Red tool without preflightId", () => {
    const req = createMockReq({
      params: {
        tools: [
          { name: "read_email", _meta: { color: "red" } },
        ],
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    preflightValidator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows Green tool without preflightId", () => {
    const req = createMockReq({
      params: {
        tools: [
          { name: "list_files", _meta: { color: "green" } },
        ],
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    preflightValidator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
