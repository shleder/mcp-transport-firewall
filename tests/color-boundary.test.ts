import type { Request, Response, NextFunction } from "express";
import { mcpColorBoundary } from "../src/middleware/color-boundary.js";

function createMockReq(body: Record<string, unknown>, query: Record<string, string> = {}): Partial<Request> {
  return {
    body,
    query,
    ip: "127.0.0.1",
  };
}

function createMockRes(): { res: Partial<Response>; statusCode: number; responseBody: unknown } {
  const state = { statusCode: 0, responseBody: null as unknown };
  const res: Partial<Response> = {
    status: jest.fn((code: number) => {
      state.statusCode = code;
      return res as Response;
    }),
    json: jest.fn((body: unknown) => {
      state.responseBody = body;
      return res as Response;
    }),
  };
  return { res, ...state };
}

describe("mcpColorBoundary", () => {
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 403 when RED and BLUE tools are requested simultaneously", () => {
    const req = createMockReq({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        tools: [
          { name: "read_email", _meta: { color: "red" } },
          { name: "modify_database", _meta: { color: "blue" } },
        ],
      },
    });

    const { res } = createMockRes();
    const next = jest.fn();

    mcpColorBoundary(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.message).toContain("Cross-Tool Hijack Attempt detected");
    expect(body.error.message).toContain("read_email");
    expect(body.error.message).toContain("modify_database");

    expect(stderrSpy).toHaveBeenCalled();
    const auditOutput = (stderrSpy.mock.calls[0][0] as string);
    expect(auditOutput).toContain("CROSS_TOOL_HIJACK");
  });

  it("halts when multiple RED and multiple BLUE tools are mixed", () => {
    const req = createMockReq({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        tools: [
          { name: "parse_website", _meta: { color: "red" } },
          { name: "read_untrusted_doc", _meta: { color: "red" } },
          { name: "update_iam_policy", _meta: { color: "blue" } },
          { name: "delete_user", _meta: { color: "blue" } },
        ],
      },
    });

    const { res } = createMockRes();
    const next = jest.fn();

    mcpColorBoundary(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("allows only RED tools", () => {
    const req = createMockReq({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        tools: [
          { name: "read_email", _meta: { color: "red" } },
          { name: "parse_website", _meta: { color: "red" } },
        ],
      },
    });

    const { res } = createMockRes();
    const next = jest.fn();

    mcpColorBoundary(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows only BLUE tools", () => {
    const req = createMockReq({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        tools: [
          { name: "modify_database", _meta: { color: "blue" } },
        ],
      },
    });

    const { res } = createMockRes();
    const next = jest.fn();

    mcpColorBoundary(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows GREEN tools mixed with RED or BLUE", () => {
    const req = createMockReq({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        tools: [
          { name: "list_files", _meta: { color: "green" } },
          { name: "read_email", _meta: { color: "red" } },
        ],
      },
    });

    const { res } = createMockRes();
    const next = jest.fn();

    mcpColorBoundary(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("passes through requests with no tool data", () => {
    const req = createMockReq({});
    const { res } = createMockRes();
    const next = jest.fn();

    mcpColorBoundary(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("detects RED+BLUE in flat params format", () => {
    const req = createMockReq({
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      tools: [
        { name: "fetch_url", _meta: { color: "red" } },
        { name: "write_config", _meta: { color: "blue" } },
      ],
    });

    const { res } = createMockRes();
    const next = jest.fn();

    mcpColorBoundary(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
