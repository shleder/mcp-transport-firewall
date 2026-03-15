#!/usr/bin/env node

import readline from "node:readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

let callCount = 0;

rl.on("line", (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);

    if (req.method === "ping") {
      process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: req.id, result: {} }) + "\n");
      return;
    }

    if (req.method === "tools/call") {
      callCount++;
      const result = {
        content: [
          { type: "text", text: `Stub response. Server call count: ${callCount}` }
        ]
      };

      setTimeout(() => {
        process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: req.id, result }) + "\n");
      }, 100);
      return;
    }

    if (req.method === "error/trigger") {
      process.stdout.write(JSON.stringify({
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32000, message: "Intentional Test Error" }
      }) + "\n");
      return;
    }

    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: req.id, result: { fallback: true } }) + "\n");
  } catch (err) {
    console.error("Stub Server Parse Error", err);
  }
});
