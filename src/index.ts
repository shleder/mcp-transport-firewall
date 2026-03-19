import './types/express.js';
import express from 'express';
import { nhiAuthValidator } from './middleware/nhi-auth-validator.js';
import { scopeValidator } from './middleware/scope-validator.js';
import { mcpColorBoundary } from './middleware/color-boundary.js';
import { astEgressFilter } from './middleware/ast-egress-filter.js';
import { preflightValidator } from './middleware/preflight-validator.js';
import { errorHandler } from './middleware/error-handler.js';

const app = express();

app.use(express.json({
  strict: true,
  limit: '1mb'
}));

// PIpeline: NHI Auth -> Scope Validation -> ColorBoundary -> EgressFilter (ETT) -> Preflight -> Handler -> Global Error
app.post('/mcp', nhiAuthValidator, scopeValidator, mcpColorBoundary, astEgressFilter, preflightValidator, (req, res) => {
  res.status(200).json({ status: "success", data: "MCP Proxy Request Passed" });
});

app.get('/sse', nhiAuthValidator, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(`data: ${JSON.stringify({ status: "connected" })}\n\n`);
  
  const intervalId = setInterval(() => {
    res.write(':\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(intervalId);
  });
});

app.use(errorHandler);

export default app;

if (process.env.NODE_ENV !== 'test') {
  app.listen(3000, () => {
    console.log('MCP Proxy Core listening on port 3000 (Protected Mode with NHI & ETT)');
  });
}
