import readline from 'node:readline';

let callCount = 0;

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', (line) => {
  const message = JSON.parse(line);

  if (message.method !== 'tools/call') {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: message.id ?? null,
      result: { ok: true },
    }) + '\n');
    return;
  }

  callCount += 1;

  setTimeout(() => {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: message.id ?? null,
      result: {
        callCount,
        tool: message.params?.name ?? null,
        arguments: message.params?.arguments ?? null,
      },
    }) + '\n');
  }, 100);
});
