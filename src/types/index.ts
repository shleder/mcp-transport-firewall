import { z } from 'zod';

export const McpToolSchema = z.object({
  name: z.string().min(1),
  _meta: z.object({
    color: z.enum(['red', 'blue', 'green', 'yellow']).optional()
  }).optional()
}).strict();

export const McpRequestSchema = z.object({
  tools: z.array(McpToolSchema).optional(),
}).passthrough();
