# Guided Setup And Audits

Use this page when the package proof is clear but you want help adapting it to a real local MCP workflow.

Best fit:

- individual Codex or Claude Code users already running local MCP servers
- small teams with shared local MCP tooling and a narrow protected workflow
- operators who need a fail-closed layer before risky file, search, fetch, or execute-shaped tool calls

What this repository can help with:

- guided setup for one local MCP stack
- workflow hardening audit for a real downstream MCP server
- trust-gate tuning for a specific read, search, fetch, or high-trust action path

Early operator offer:

- first 10 guided setup requests can start with a free 20-minute risk review
- reduced-cost or free setup work is possible when the workflow is a strong fit for a reusable example, quote, or case study
- this is for proof and operator feedback first, not for broad custom consulting intake

How to request help:

1. Read the operator guide: [WORKFLOW_HARDENING.md](WORKFLOW_HARDENING.md)
2. Open the guided setup request directly: [guided setup request](https://github.com/shleder/mcp-transport-firewall/issues/new?template=guided-setup-request.yml)
3. Include sanitized details about:
   - your MCP client (`Codex`, `Claude Code`, or similar)
   - the downstream MCP server you want to protect
   - the risky workflow you want to gate
   - the expected outcome
4. Do not post secrets, tokens, private repo URLs, or customer data

What to include in a useful request:

- operating system
- Node.js version
- exact command or config shape you want to protect
- current failure mode, risk, or operator concern
- whether you want a proof path, a setup walkthrough, or a hardening review

What this is not:

- not a vulnerability disclosure path; use `SECURITY.md` for security findings
- not a managed control plane or hosted enterprise onboarding flow
- not a promise that every custom setup request will be accepted
