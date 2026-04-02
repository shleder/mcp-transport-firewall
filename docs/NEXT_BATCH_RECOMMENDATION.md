# Next Batch Recommendation

Updated: 2026-04-02

## Chosen Batch

Name: `package install proof`

## Why This Is The Best ROI

- this docs-only grounding commit does not replace the next implementation batch; it only records the current local truth around it
- it extends the only active local quality packet already on the checked-out branch
- it hardens the boundary between repo state and the actual npm artifact, which is still the most expensive place to regress before `2.2.6`
- it improves confidence for every other queued public-facing packet because README/support/runtime wording is safer to publish when the packaged install path is harder to break
- it adds value without creating another public draft branch immediately

## Recommended Scope

- continue the current P5 line from package metadata guardrails and tarball proxy smoke
- add source-install and entrypoint proof where the packaged surface is still under-specified
- add only the remaining high-value proxy/trust-gate proofs that exercise the real packaged boundary
- keep the batch focused on tests, scripts, and tight doc alignment

## Why The Other Top 2 Options Lose

### 1. workflow proof publication

- strong user-facing value, but the core packet already exists as draft PR `#53`
- publishing more top-layer proof before the packaged install boundary is tighter increases story polish faster than delivery confidence

### 2. support surface cleanup

- useful for intake hygiene, but support wording is secondary to making the shipped package harder to regress
- the packet already exists as draft PR `#52`, so its marginal ROI is lower than finishing the active local quality line
