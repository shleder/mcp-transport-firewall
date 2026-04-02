import { z } from 'zod';

export const TargetServerConfigSchema = z.object({
  url: z.string().url(),
  timeoutMs: z.number().int().min(100).max(30000).default(5000),
  headers: z.record(z.string()).optional(),
}).strict();

export type TargetServerConfig = z.infer<typeof TargetServerConfigSchema>;

export const RouteRegistryStateSchema = z.object({
  version: z.literal(1),
  routes: z.record(TargetServerConfigSchema),
}).strict();

export type RouteRegistryState = z.infer<typeof RouteRegistryStateSchema>;

export const RouteResultSchema = z.object({
  status: z.number().int(),
  body: z.unknown(),
  targetUrl: z.string(),
  latencyMs: z.number(),
}).strict();

export type RouteResult = z.infer<typeof RouteResultSchema>;
