# Current State Grounded

Updated: 2026-04-02

## public/current

- npm `latest` is `2.2.5`
- `npm view mcp-transport-firewall version dist-tags --json` still returns version `2.2.5` and `latest: 2.2.5`
- latest GitHub release is `v2.2.5`, published at `2026-03-31T19:48:11Z`
- `origin/main` is commit `597c7e3` (`ci(actions): Update workflows for Node 24 (#48)`)

Grounded implication:

- the public package line is still `2.2.5`
- the public default-branch code is newer than the public package, so `public/current package` and `public/current main` are not the same thing

## open/draft PR state

Confirmed via local `gh` on `2026-04-02`:

- `#49` draft: `docs(public): tighten human-facing security copy`
- `#50` draft: `chore(repo): normalize public copy and verification naming`
- `#51` draft: `ref(runtime): normalize operator-facing security language`
- `#52` draft: `docs(support): tighten workflow intake surface`
- `#53` draft: `docs(workflow): center proof on filesystem/search path`

These PRs are public on GitHub, but they are not merged and they do not change the published npm state.

## local-only

- checked-out branch: `project/tests-first-quality`
- the current checked-out tip is local-only and unpublished; re-read `git log --oneline --decorate -n 30` for the exact hash
- re-read `git status --short --branch` for the exact ahead count on the current tip
- the intended local release-candidate boundary should keep a clean working tree
- current local-only stack already includes:
  - package install proof
  - grounded docs
  - public proof surface
  - policy/rules hardening
  - benchmark/evidence alignment
  - docs/examples alignment
  - repo-surface truth-sync
  - durable operator state for secondary surfaces
  - expanded flagship schema coverage
  - short-chunk ShadowLeak hardening
  - release-boundary convergence
  - first-read Toolwall cleanup for external review prep
- current local-only packets already include these recent unpublished commits:
  - `1d194f2 test(packaging): Lock packaged install contract`
  - `6d530b6 docs(grounding): reconcile local architecture and current state`
  - `e076e53 docs(public): sharpen install and workflow proof surface`
  - `46c04db feat(policy): Harden flagship workflow trust rules`
  - `25c1743 docs(evidence): Align benchmark with preflight hardening`
  - `24e8eb4 docs(examples): Clarify flagship proof path`
  - `8897a6b docs(truth): Sync repo surface with verified local workflow`
  - `672bf38 feat(state): Persist secondary-surface route registry`
  - `1c05fbd feat(schema): Expand flagship tool contract coverage`
  - `d71a736 feat(egress): Harden short-chunk ShadowLeak detection`
  - `dbb35d5 docs(release): Converge local stack for future release boundary`
  - `fa26c69 docs(readme): Clean first-read surface and remove logo`
- separate unpublished local branch: `project/naming-and-ci-discipline` at `ebbdd73`

## convergence status

### already coherent in the checked-out branch

- one primary product story: a protected local filesystem/search MCP workflow over `stdio`
- package install proof, packaged proxy smoke coverage, and repo-local demo proof all exist on the same branch
- policy hardening, evidence alignment, docs/examples alignment, and runtime truth-sync already landed together in local-only form
- the secondary HTTP/admin route registry is now restart-durable without broadening the flagship stdio story
- strict schema coverage expanded only for common safe filesystem sibling tools
- ShadowLeak detection now blocks repeated short query chunks under one key without widening the safe search/read path
- the README and first-read repo surface now present `Toolwall` as the display name while keeping `mcp-transport-firewall` as the technical package/install identity

### still fragmented or intentionally separate

- the current local stack is still unpublished local-only work
- `project/naming-and-ci-discipline` remains a separate hygiene branch and should not be treated as if it already merged into this line
- workflow display-name and artifact-label renames from that branch are still optional, not part of the current runtime proof

### blockers before a meaningful future `2.2.6` discussion

- use the current checked-out branch as one explicit push/PR review boundary instead of reopening scope with another implementation packet
- keep `public/current` and `local-only` state explicitly separate in repo and handoff docs
- either port only the non-renaming workflow hygiene worth carrying forward now, or explicitly defer the rest of the naming branch
- do not claim exact `2.2.6` contents until that future review boundary exists

## required verification boundary for this local stack

- `git status --short --branch`
- `git branch --show-current`
- `git log --oneline --decorate -n 30`
- `npm test`
- `npm run demo:stdio`
- `npm run pack:smoke`
- `npm run benchmark:stdio -- --json --output evidence.json`

These checks confirm local branch behavior only. They do not prove push, PR merge, release, or npm publication.

## Packet Reconciliation

### Already public/current

- released package line `2.2.5`
- tag `v2.2.5`
- default branch `origin/main` at `597c7e3`

### Implemented and publicly visible, but not merged

- repo-baseline packet on `project/repo-baseline` / draft PR `#50`
- runtime-language packet on `project/product-runtime-language` / draft PR `#51`
- support-surface packet on `project/support-surface` / draft PR `#52`
- workflow-proof packet on `project/workflow-proof` / draft PR `#53`
- earlier public-copy cleanup on `cleanup/security-copy` / draft PR `#49`

### Implemented locally, not public

- the current `project/tests-first-quality` local-only stack, including the recent commits listed above
- the separate workflow-hygiene packet on `project/naming-and-ci-discipline`

### Planned-only

- `2.2.6` release/tag/publish
- any future push/PR phase that carries this local stack forward
- optional GitHub metadata cleanup batch from `BD/08-ops/github-metadata-cleanup-candidates.md`
- any Toolwall display-name rollout beyond planning artifacts

Important reconciliation rule:

- draft PR visibility is not merge or release proof
- the checked-out branch is the source of truth for local-only behavior
- `2.2.6` contents remain unconfirmed until a real future review boundary exists

## Docs vs Runtime/Tests

### confirmed

- the operator-facing CLI path is the stdio proxy from `src/stdio/proxy.ts`
- when no explicit target is configured, `src/cli-options.ts` falls back to the current package entrypoint with `--embedded-target`
- the bundled embedded server in `src/embedded/server.ts` exposes `firewall_status` and `firewall_usage`
- trust gates in `src/stdio/proxy.ts` run in this order:
  1. auth extraction and scope validation
  2. color-boundary validation
  3. AST/egress validation
  4. preflight validation
  5. strict schema validation

### reconciled in this packet

- repo docs should describe the packaged embedded server as the fallback downstream target for the default CLI path, not as the default direct CLI path
- the checked-out branch now also includes truth-synced repo surfaces, restart-durable secondary route registration, expanded safe schema coverage, and repeated short-chunk ShadowLeak blocking
- the local verification surface still includes `scripts/assert-package-metadata.mjs`, expanded install-contract assertions in `tests/release-guardrails.test.ts`, and packaged downstream proof in `tests/package-proxy-smoke.test.ts`
- GitHub-visible docs can still lag this grounded local packet until it is pushed

### cannot confirm

- cannot confirm any unmerged branch behavior from GitHub state alone
- cannot confirm future `2.2.6` contents because no release/tag exists yet
