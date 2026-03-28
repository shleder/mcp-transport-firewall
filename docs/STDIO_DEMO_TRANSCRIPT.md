Command:

```powershell
npm run demo:stdio
```

Observed output from the latest local run:

```text
stdio demo passed
allow: tool=search_files callCount=1
cache: second response matched first response for tool=search_files
block: ShadowLeak request denied with code=SHADOWLEAK_DETECTED
block: missing auth denied with code=AUTH_FAILURE
```

Interpretation:

- the first allow request reached the downstream target
- the second identical allow request was served from cache
- the exfiltration sample was denied before downstream execution
- the missing-auth sample was denied at the transport boundary
