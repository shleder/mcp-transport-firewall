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
- the checked-out branch contains unpublished local work beyond `origin/main`
- verified P5 code packet commit: `1d194f2 test(packaging): Lock packaged install contract`
- this grounded-doc reconciliation packet is also local-only until pushed
- separate unpublished local branch: `project/naming-and-ci-discipline` at `ebbdd73`

## verified locally in the current branch

- `npm run assert:package-metadata`
- `npm test`
- `npm run pack:dry-run`
- `npm run pack:smoke`

These checks confirm the local P5/package-install-proof code packet. They do not prove push, PR merge, release, or npm publication.

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

- naming-and-ci-discipline packet on `project/naming-and-ci-discipline`
- first tests-first quality packet on `project/tests-first-quality`

### Planned-only

- `2.2.6` release/tag/publish
- the next P5 follow-up after the first tests-first packet
- optional GitHub metadata cleanup batch from `BD/08-ops/github-metadata-cleanup-candidates.md`

Important reconciliation rule:

- P1/P2 are not merely planned anymore
- P3 is not merely planned anymore
- P4 is not merely planned anymore
- P5 has already started locally and must be described as local implementation, not as a plan

## Docs vs Runtime/Tests

### confirmed

- `README.md` and `docs/RUNTIME_CONTRACT.md` still match the two-mode runtime shape in the checked-out branch: embedded standalone mode plus downstream stdio proxy mode
- the code still supports both CLI/env target resolution and the fail-closed gate chain described in the docs

### reconciled in this packet

- `docs/VERIFICATION_GUIDE.md` now reflects the local verification surface in the checked-out branch
- that local verification surface includes `scripts/assert-package-metadata.mjs`, expanded install-contract assertions in `tests/release-guardrails.test.ts`, and packaged downstream proof in `tests/package-proxy-smoke.test.ts`
- GitHub-visible docs can still lag this local grounded packet until it is pushed

### stale internal planning doc

- `BD/03-current-goals/2026-03-31-next-steps-plan.md` was stale before this grounding pass because it still described P1/P2 as the active local packet and did not reflect that P3/P4 now exist as draft PRs and P5 exists locally

### cannot confirm

- cannot confirm any unmerged branch behavior from GitHub state alone
- cannot confirm future `2.2.6` contents because no release/tag exists yet
