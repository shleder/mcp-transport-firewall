# Stdio Walkthrough

Use this page when you want a complete, reproducible stdio-first evaluation path. The HTTP harness and dashboard are secondary and are not required for the main claim.

## Windows

PowerShell commands:

```powershell
npm install
npm --prefix ui install
Copy-Item .env.example .env
npm run verify:all
npm run demo:stdio
```

Manual stdio path:

```powershell
npm run build
npm run start:cli -- -- node examples/demo-target.js
```

Expected evidence:

- the first `search_files` request is allowed
- the second identical `search_files` request is served from cache
- the `fetch_url` exfiltration sample returns `SHADOWLEAK_DETECTED`
- the missing-auth sample returns `AUTH_FAILURE`

For a repeatable measurement packet, also run [EVIDENCE_BENCHMARK.md](EVIDENCE_BENCHMARK.md) through `npm run benchmark:stdio`.

## Linux

Shell commands:

```bash
npm install
npm --prefix ui install
cp .env.example .env
npm run verify:all
npm run demo:stdio
```

Manual stdio path:

```bash
npm run build
npm run start:cli -- -- node examples/demo-target.js
```

If you want to inspect the HTTP review harness as a secondary surface:

```bash
npm run dev
npm --prefix ui run dev
```

## Evidence Checklist

Capture these artifacts for a validation packet:

- the `npm run verify:all` result
- the `npm run demo:stdio` result
- the target process log from `examples/demo-target.js`
- the trust-gate behavior for `AUTH_FAILURE` and `SHADOWLEAK_DETECTED`
- the admin dashboard or HTTP harness only if you need the secondary compatibility surface
