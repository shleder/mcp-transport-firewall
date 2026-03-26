# AGENTS.md

This repository includes guidance for coding agents and maintainers working on a fail-closed MCP security control.

## Primary Product Boundary

- Treat `src/cli.ts` and `src/stdio/proxy.ts` as the primary runtime.
- Treat `src/index.ts` as a secondary HTTP companion service, not the primary product story.
- Do not describe the project as a generic MCP gateway. The core claim is fail-closed transport inspection at the stdio boundary.

## Required Verification

Before declaring work complete, run:

```bash
npm run verify:all
```

If you change runtime behavior, trust gates, or demos, also confirm the stdio demo still works:

```bash
npm run demo:stdio
```

## Evidence Discipline

- Do not claim protections that the repository cannot reproduce through code, tests, or demos.
- Keep `README.md`, `docs/THREAT_MODEL.md`, and `docs/REVIEWER_GUIDE.md` aligned with actual behavior.
- If you change threat-model claims, update tests or `scripts/stdio-demo.mjs` so the claim is externally checkable.

## Repo Hygiene

- Keep community files current: `SECURITY.md`, `SUPPORT.md`, `CODE_OF_CONDUCT.md`, issue templates, and PR template.
- Prefer deleting stale internal artifacts over accumulating parallel narratives.
- Keep release notes and `CHANGELOG.md` synchronized with tagged releases.
