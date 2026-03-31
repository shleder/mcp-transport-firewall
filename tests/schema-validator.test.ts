import { jest, describe, it, expect } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { createSchemaValidator } from '../src/middleware/schema-validator.js';
import { mcpToolSchemas } from '../src/mcp-tool-schemas.js';

function createMockReq(body: Record<string, unknown>): Partial<Request> {
  return {
    body,
    ip: '127.0.0.1',
    path: '/mcp',
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

describe('schema-validator (Progressive Disclosure)', () => {
  const validator = createSchemaValidator(mcpToolSchemas);

  it('allows valid arguments for a registered file tool alias', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: { name: 'read', arguments: { path: '/etc/config', encoding: 'utf8', maxBytes: 256 } },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks invalid arguments when a strict schema sees an unexpected field', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: { name: 'write_file', arguments: { path: '/etc/config', content: 'secret', ignore_previous_instructions: true } },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);

    const body = (res.json as jest.Mock).mock.calls[0][0] as { error: { message: string } };
    expect(body.error.message).toContain('Fail-Closed');
  });

  it('blocks non-http(s) URLs for fetch_url', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: { name: 'fetch_url', arguments: { url: 'file:///etc/passwd' } },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('blocks overlong http(s) URLs for fetch_url', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: { name: 'fetch_url', arguments: { url: `https://example.com/${'a'.repeat(2050)}` } },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows a strict execute_command payload', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: {
        name: 'execute_command',
        arguments: {
          command: 'node',
          args: ['--version'],
          cwd: '/tmp',
          timeoutMs: 5000,
        },
      },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows passthrough for unknown tools', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: { name: 'unknown_tool', arguments: { malicious: 'data' } },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
