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

  it.each(['read_file', 'read', 'open_file'])(
    'allows valid arguments for read-style alias %s',
    (toolName) => {
      const req = createMockReq({
        method: 'tools/call',
        params: { name: toolName, arguments: { path: '/etc/config', encoding: 'utf8', maxBytes: 256 } },
      });
      const { res } = createMockRes();
      const next = jest.fn();

      validator(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    },
  );

  it.each(['read_file', 'open_file'])(
    'blocks invalid path payload for read-style alias %s',
    (toolName) => {
      const req = createMockReq({
        method: 'tools/call',
        params: { name: toolName, arguments: { path: '/tmp/\0secret.txt' } },
      });
      const { res } = createMockRes();
      const next = jest.fn();

      validator(req as Request, res as Response, next as NextFunction);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    },
  );

  it('allows a strict read_multiple_files payload for common local filesystem workflows', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: {
        name: 'read_multiple_files',
        arguments: {
          paths: ['/workspace/README.md', '/workspace/docs/guide.md'],
        },
      },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks read_multiple_files when the paths list is empty', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: {
        name: 'read_multiple_files',
        arguments: {
          paths: [],
        },
      },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows a strict directory_tree payload', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: {
        name: 'directory_tree',
        arguments: {
          path: '/workspace/src',
        },
      },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks directory_tree when unexpected fields are present', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: {
        name: 'directory_tree',
        arguments: {
          path: '/workspace/src',
          recursive: true,
        },
      },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows a strict get_file_info payload', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: {
        name: 'get_file_info',
        arguments: {
          path: '/workspace/package.json',
        },
      },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks get_file_info when unexpected fields are present', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: {
        name: 'get_file_info',
        arguments: {
          path: '/workspace/package.json',
          followSymlinks: true,
        },
      },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows list_allowed_directories with an empty payload', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: {
        name: 'list_allowed_directories',
        arguments: {},
      },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('blocks list_allowed_directories when unexpected fields are present', () => {
    const req = createMockReq({
      method: 'tools/call',
      params: {
        name: 'list_allowed_directories',
        arguments: {
          path: '/workspace',
        },
      },
    });
    const { res } = createMockRes();
    const next = jest.fn();

    validator(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it.each(['list_directory', 'list_files'])(
    'allows valid arguments for list-style alias %s',
    (toolName) => {
      const req = createMockReq({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: {
            path: '/workspace',
            recursive: true,
            includeHidden: false,
            maxDepth: 4,
            pattern: '*.ts',
          },
        },
      });
      const { res } = createMockRes();
      const next = jest.fn();

      validator(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    },
  );

  it.each(['list_directory', 'list_files'])(
    'blocks NUL-bearing pattern for list-style alias %s',
    (toolName) => {
      const req = createMockReq({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: {
            path: '/workspace',
            pattern: '*.ts\0',
          },
        },
      });
      const { res } = createMockRes();
      const next = jest.fn();

      validator(req as Request, res as Response, next as NextFunction);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    },
  );

  it.each(['search_files', 'search'])(
    'allows valid arguments for search-style alias %s',
    (toolName) => {
      const req = createMockReq({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: {
            query: 'TODO',
            path: '/workspace',
            include: ['*.ts'],
            exclude: ['node_modules'],
            recursive: true,
            maxResults: 50,
          },
        },
      });
      const { res } = createMockRes();
      const next = jest.fn();

      validator(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    },
  );

  it.each(['search_files', 'search'])(
    'blocks NUL-bearing query for search-style alias %s',
    (toolName) => {
      const req = createMockReq({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: {
            query: 'TODO\0NOW',
          },
        },
      });
      const { res } = createMockRes();
      const next = jest.fn();

      validator(req as Request, res as Response, next as NextFunction);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    },
  );

  it.each(['search_files', 'search'])(
    'blocks NUL-bearing include patterns for search-style alias %s',
    (toolName) => {
      const req = createMockReq({
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: {
            query: 'TODO',
            include: ['src/\0*.ts'],
          },
        },
      });
      const { res } = createMockRes();
      const next = jest.fn();

      validator(req as Request, res as Response, next as NextFunction);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    },
  );

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
