## Workflow Hardening Guide

Use this page when the package itself is clear but the real workflow question is practical:

- how do I put this in front of a live local MCP workflow?
- what risky local MCP calls should I guard first?
- how do I roll this out without opening a bigger hole than I close?

This guide stays narrow on purpose. The best current fit is someone who already has a downstream tool server and wants a fail-closed control before risky local execution.

## Start With One Protected Workflow

The safest rollout is one workflow, one downstream target, one proof path.

Recommended order:

1. run the 60-second proof with `npm run demo:stdio`
2. protect one local downstream server through the proxy path
3. confirm safe read or search calls still pass
4. confirm a risky request fails closed before downstream execution
5. only then expand to broader tool coverage or team workflows

If you cannot explain which single workflow you want to protect first, stop and narrow scope before adding more trust gates or more tool surface.

## Common Reasons People Use This

Most real setups start with one of these problems:

- a local MCP server can read or search more than it should, and the client will call it too easily
- a risky fetch, path, or shell-shaped payload can reach a downstream target before anyone notices
- there is no clear auth envelope between the client and the local MCP server
- one workflow mixes low-trust read actions with higher-trust mutation or execution paths
- the team wants a deny-first transport layer before downstream tool logic runs

## Common First Targets

### 1. Read And Search Servers

Best when the downstream MCP server mainly exposes file reads, directory listing, or search helpers.

Why start here:

- easiest to explain
- easiest to prove locally
- closest match to the current README and demo path

### 2. Risky Local Fetch Or Execute Paths

Best when a downstream tool server can fetch remote content, touch sensitive paths, or execute shell-shaped actions.

Why this matters:

- this is where fail-closed transport checks save the most pain
- this is also where auth gaps, exfiltration markers, and mixed-trust problems become obvious

### 3. Shared Local Tooling For A Small Team

Best when several people reuse one local MCP setup and want the same trust defaults.

Why this comes second:

- team rollout is more valuable after a single-user path is already proven
- it is easier to tune trust gates when one workflow is already stable

## What To Check Before You Trust The Rollout

- the client config points to the proxy path, not straight to the downstream target
- `PROXY_AUTH_TOKEN` is present when shared-secret auth is expected
- the downstream target command and args are explicit and reproducible
- one safe request passes and one risky request fails closed
- logs and denial codes are understandable enough to debug without guesswork

If any of those are missing, treat the rollout as incomplete.

## When To Ask For Help

Use the setup request path when:

- you can run the demo locally but the real client wiring still feels brittle
- you are not sure which trust gate is blocking a real workflow
- you want a workflow hardening review before putting the setup in front of a wider team
- you need custom trust-gate tuning for a downstream server with a non-obvious tool contract

Open a request here:

- [setup request](https://github.com/shleder/mcp-transport-firewall/issues/new?template=guided-setup-request.yml)
