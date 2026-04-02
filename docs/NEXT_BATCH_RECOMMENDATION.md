# Next Batch Recommendation

Updated: 2026-04-02

## Chosen Batch

Name: `future push/PR readiness from the converged local stack`

## Why This Is The Best ROI

- the checked-out branch already carries the meaningful local-only stack:
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
- after the current convergence refresh, the remaining risk is publication sequencing and truth maintenance, not another missing runtime capability
- another isolated hardening or docs-only packet would mostly re-fragment a branch that is now close to one reviewable boundary
- the next meaningful `2.2.6` discussion should start from a future push/PR boundary around this stack, not from mixed local and draft surfaces

## Recommended Scope For The Next Phase

- open a future push/PR phase around `project/tests-first-quality` or a direct descendant
- keep README, runtime docs, and proof docs centered on one local filesystem/search stdio workflow
- keep `Toolwall` as display/planning only until a later deliberate display-copy batch
- carry over only non-renaming workflow hygiene if it clearly improves coherence more than churn
- avoid new runtime features unless a factual correctness fix appears

## Exact Blockers Before That Phase

- the current local stack is still unpublished local-only work
- `public/current` remains `2.2.5` while this branch still sits ahead of public `main`
- the separate workflow hygiene branch must not be mistaken for merged current state
- exact `2.2.6` contents should stay unclaimed until the future review boundary exists

## Recommendation On `project/naming-and-ci-discipline`

- take now: only the `package-smoke.yml` action-runtime bump to `actions/checkout@v6` and `actions/setup-node@v6`, because it removes the known non-blocking warning source without renaming workflows or evidence artifacts
- defer: workflow display-name changes and the benchmark artifact rename to a later explicit CI naming batch
- never by default: package, repo, CLI/bin, env-var, or evidence-surface renames from that line

## Why The Other Top 2 Options Lose

### 1. broader display-name rollout

- `Toolwall` is still a planning/display boundary, not a technical identity migration
- broader naming rollout before branch convergence would add churn faster than clarity

### 2. monetization or audience-growth work

- repo truth and branch coherence still come first
- pushing growth or monetization on top of mixed local, draft, and public state would amplify confusion instead of trust
