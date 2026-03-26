interface ToolMeta {
  color?: string;
  authorization?: string;
}

export interface McpToolInvocation {
  name?: string;
  arguments?: unknown;
  _meta?: ToolMeta;
  preflightId?: string;
}

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};

const toInvocation = (value: unknown): McpToolInvocation | null => {
  if (!isRecord(value)) {
    return null;
  }

  const meta = isRecord(value._meta)
    ? {
        color: typeof value._meta.color === 'string' ? value._meta.color : undefined,
        authorization: typeof value._meta.authorization === 'string' ? value._meta.authorization : undefined,
      }
    : undefined;

  return {
    name: typeof value.name === 'string' ? value.name : undefined,
    arguments: value.arguments,
    _meta: meta,
    preflightId: typeof value.preflightId === 'string' ? value.preflightId : undefined,
  };
};

export const extractToolInvocations = (body: Record<string, unknown>): McpToolInvocation[] => {
  if (Array.isArray(body.tools)) {
    return body.tools
      .map(toInvocation)
      .filter((value): value is McpToolInvocation => value !== null);
  }

  if (!isRecord(body.params)) {
    return [];
  }

  if (Array.isArray(body.params.tools)) {
    return body.params.tools
      .map(toInvocation)
      .filter((value): value is McpToolInvocation => value !== null);
  }

  const singleInvocation = toInvocation(body.params);
  if (singleInvocation?.name) {
    return [singleInvocation];
  }

  return [];
};

export const getPrimaryToolInvocation = (body: Record<string, unknown>): McpToolInvocation | null => {
  const invocations = extractToolInvocations(body);
  return invocations[0] ?? null;
};

export const extractAuthorizationFromBody = (body: Record<string, unknown>): string | undefined => {
  for (const tool of extractToolInvocations(body)) {
    const authorization = tool._meta?.authorization;
    if (typeof authorization === 'string' && authorization.length > 0) {
      return authorization;
    }
  }

  if (isRecord(body._meta) && typeof body._meta.authorization === 'string') {
    return body._meta.authorization;
  }

  return undefined;
};
