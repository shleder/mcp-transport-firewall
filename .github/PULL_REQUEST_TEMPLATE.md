
- describe the user-visible or maintainer-visible change
- list the main files or subsystems touched


- explain the problem being solved
- explain how the change fits the fail-closed stdio-first product shape


- [ ] `npm run verify:all`
- [ ] `npm run demo:stdio` if runtime or trust-gate behavior changed
- [ ] `npm run benchmark:stdio -- --json --output evidence.json` if security claims, benchmark corpus, or cache behavior changed
- [ ] `npm run pack:dry-run && npm run pack:smoke` if packaging, CLI surface, docs install commands, or release workflows changed
- [ ] docs updated if claims, demos, release notes, or repo metadata changed


- note any residual risks, unsupported claims, metrics changes, or follow-up work
