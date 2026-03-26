import { z } from 'zod';

export const mcpToolSchemas = {
  read_file: z.object({
    path: z.string().max(1024),
  }).strict(),
  write_file: z.object({
    path: z.string().max(1024),
    content: z.string().max(1024 * 1024 * 5),
  }).strict(),
  execute_command: z.object({
    command: z.string().max(512),
    args: z.array(z.string().max(512)).max(50).optional(),
  }).strict(),
  fetch_url: z.object({
    url: z.string().url().max(2048),
  }).strict(),
};
