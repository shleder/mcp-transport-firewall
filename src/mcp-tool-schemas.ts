import { z } from 'zod';

const nonEmptyPath = z.string().min(1).max(1024).refine((value) => !value.includes('\0'), {
  message: 'must not contain NUL bytes',
});

const nonEmptyCommand = z.string().min(1).max(512).refine((value) => !value.includes('\0'), {
  message: 'must not contain NUL bytes',
});

const httpUrl = z.string().max(2048).url().refine((value) => {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}, {
  message: 'must use an http(s) URL',
});

const readFileSchema = z.object({
  path: nonEmptyPath,
  encoding: z.enum(['utf8', 'base64']).optional(),
  maxBytes: z.number().int().min(1).max(1024 * 1024).optional(),
}).strict();

const writeFileSchema = z.object({
  path: nonEmptyPath,
  content: z.string().max(1024 * 1024 * 5),
  encoding: z.enum(['utf8', 'base64']).optional(),
  overwrite: z.boolean().optional(),
}).strict();

const createFileSchema = z.object({
  path: nonEmptyPath,
  content: z.string().max(1024 * 1024 * 5).optional(),
  overwrite: z.boolean().optional(),
}).strict();

const listDirectorySchema = z.object({
  path: nonEmptyPath,
  recursive: z.boolean().optional(),
  includeHidden: z.boolean().optional(),
  maxDepth: z.number().int().min(1).max(32).optional(),
  pattern: z.string().max(256).optional(),
}).strict();

const searchFilesSchema = z.object({
  query: z.string().min(1).max(4096),
  path: nonEmptyPath.optional(),
  include: z.array(z.string().min(1).max(256)).max(20).optional(),
  exclude: z.array(z.string().min(1).max(256)).max(20).optional(),
  recursive: z.boolean().optional(),
  maxResults: z.number().int().min(1).max(1000).optional(),
}).strict();

const executeCommandSchema = z.object({
  command: nonEmptyCommand,
  args: z.array(z.string().max(512)).max(50).optional(),
  cwd: nonEmptyPath.optional(),
  timeoutMs: z.number().int().min(100).max(300000).optional(),
  env: z.record(z.string().max(1024)).optional(),
}).strict();

const fetchUrlSchema = z.object({
  url: httpUrl,
  method: z.enum(['GET', 'HEAD', 'POST']).optional(),
  headers: z.record(z.string().max(2048)).optional(),
  body: z.string().max(1024 * 1024).optional(),
  timeoutMs: z.number().int().min(100).max(300000).optional(),
}).strict();

const emptyToolSchema = z.object({}).strict();

export const mcpToolSchemas = {
  read_file: readFileSchema,
  read: readFileSchema,
  open_file: readFileSchema,
  write_file: writeFileSchema,
  write: writeFileSchema,
  create_file: createFileSchema,
  list_directory: listDirectorySchema,
  list_files: listDirectorySchema,
  search_files: searchFilesSchema,
  search: searchFilesSchema,
  execute_command: executeCommandSchema,
  execute: executeCommandSchema,
  fetch_url: fetchUrlSchema,
  firewall_status: emptyToolSchema,
  firewall_usage: emptyToolSchema,
} as const;

export type McpToolSchemaRegistry = typeof mcpToolSchemas;
