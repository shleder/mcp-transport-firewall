import readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  const message = JSON.parse(line);

  process.stdout.write(JSON.stringify({
    jsonrpc: '2.0',
    id: message.id ?? null,
    error: {
      code: -32099,
      message: 'Target error payload',
      data: {
        blob: 'x'.repeat(6 * 1024 * 1024),
      },
    },
  }) + '\n');
});
