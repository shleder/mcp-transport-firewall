export type MiddlewareContext = {
  rawMessage: string;
  message?: unknown; 
  serverId: string;
  isCached?: boolean;
  rateLimitTokens?: number;
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

      let fn = this.middlewares[i];
      if (!fn) return; 

      await fn(ctx, dispatch.bind(null, i + 1));
    };

    return dispatch(0);
  }
}
