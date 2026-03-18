export type MiddlewareContext = {
  rawMessage: string;
  message?: unknown;
  serverId: string;
  isCached?: boolean;
  rateLimitTokens?: number;
  blocked?: boolean;     // Fail-Closed flag
  blockReason?: string;  // Human-readable block reason
  [key: string]: unknown;
};

export type NextFunction = () => Promise<void>;
export type Middleware = (ctx: MiddlewareContext, next: NextFunction) => Promise<void>;

export class Pipeline {
  private middlewares: Middleware[] = [];

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  async execute(ctx: MiddlewareContext): Promise<void> {
    let index = -1;

    const dispatch = async (i: number): Promise<void> => {
      if (i <= index) throw new Error("next() called multiple times");
      index = i;

      const fn = this.middlewares[i];
      if (!fn) return;

      try {
        await fn(ctx, dispatch.bind(null, i + 1));
      } catch (err) {
        // Fail-Closed: block execution on any middleware error
        ctx.blocked = true;
        ctx.blockReason = err instanceof Error
          ? `Fail-Closed: middleware error: ${err.message}`
          : "Fail-Closed: unknown middleware error";
        throw err;
      }
    };

    return dispatch(0);
  }
}
