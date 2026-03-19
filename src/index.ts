import express from 'express';
import { mcpColorBoundary } from './middleware/color-boundary.js';
import { authValidator } from './middleware/auth-validator.js';
import { astEgressFilter } from './middleware/ast-egress-filter.js';
import { preflightValidator } from './middleware/preflight-validator.js';

const app = express();

app.use(express.json({
  strict: true,
  limit: '1mb'
}));

app.post('/mcp', authValidator, mcpColorBoundary, astEgressFilter, preflightValidator, (req, res) => {
  res.status(200).json({ status: "success", data: "MCP Proxy Request Passed" });
});

app.get('/sse', authValidator, (req, res) => {
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

export default app;

if (process.env.NODE_ENV !== 'test') {
  app.listen(3000, () => {
    console.log('MCP Proxy Core listening on port 3000 (Protected Mode)');
  });
}
