import { isObject } from "../utils/validation.js";

export function normalizeRequest(req: unknown): unknown {
  if (!isObject(req)) return req;

  if ("method" in req && "params" in req && isObject(req.params)) {

    return {
      ...req,
      params: cleanParams(req.params as Record<string, unknown>)
    };
  }

  return req;
}

function cleanParams(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      result[k] = isObject(v) ? cleanParams(v as Record<string, unknown>) : v;
    }
  }
  return result;
}
