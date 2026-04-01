# Workflow Intake Notes

Use this page when the package proof is clear but you need help adapting it to one real local MCP workflow.

Best fit:

- one existing local MCP workflow with a concrete integration gap or risk
- a narrow protected workflow that already has a clear downstream server
- cases where a sanitized public issue is enough to explain the problem, or can at least explain the boundary of it

What this repository can help with:

- narrow setup help for one local MCP stack
- workflow hardening diagnosis for one real downstream MCP server
- trust-gate diagnosis for a specific read, search, fetch, or high-trust action path

How to request help:

1. Read the workflow guide: [WORKFLOW_HARDENING.md](WORKFLOW_HARDENING.md)
2. Open the workflow intake issue directly: [workflow intake](https://github.com/shleder/mcp-transport-firewall/issues/new?template=guided-setup-request.yml)
3. Include sanitized details about:
   - your MCP client or host tool
   - the downstream MCP server you want to protect
   - the risky workflow you want to gate
   - the expected outcome
4. Do not post secrets, tokens, private repo URLs, or customer data
5. If the issue cannot stay useful after sanitization, say so in the intake and move the sensitive detail to private follow-up only if needed

What to include in a useful request:

- operating system
- Node.js version
- exact command or config shape you want to protect
- current failure mode, risk, or engineering concern
- whether you want a proof path, blocked-integration diagnosis, or trust-gate diagnosis

What this is not:

- not a vulnerability disclosure path; use `SECURITY.md` for security findings
- not a hosted control plane
- not a broad intake path for unrelated workflows
- not a promise that every custom setup request will be accepted
