import readline from 'node:readline';

const rl = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

rl.on('line', () => {
  process.stdout.write('{not-json}\n');
});
