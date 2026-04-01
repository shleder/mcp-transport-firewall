# Setup Notes And Workflow Review

Use this page when the package proof is clear but you want help adapting it to a real local MCP workflow.

Best fit:

- people already running a local MCP client with a downstream MCP server
- small teams with shared local MCP tooling and a narrow protected workflow
- people who need a fail-closed layer before risky file, search, fetch, or execute-shaped tool calls

What this repository can help with:

- setup help for one local MCP stack
- workflow review for a real downstream MCP server
- policy tuning for a specific read, search, fetch, or high-trust action path

How to request help:

1. Read the workflow guide: [WORKFLOW_HARDENING.md](WORKFLOW_HARDENING.md)
2. Open the setup request directly: [setup request](https://github.com/shleder/mcp-transport-firewall/issues/new?template=guided-setup-request.yml)
3. Include sanitized details about:
   - your MCP client
   - the downstream MCP server you want to protect
   - the risky workflow you want to gate
   - the expected outcome
4. Do not post secrets, tokens, private repo URLs, or customer data

What to include in a useful request:

- operating system
- Node.js version
- exact command or config shape you want to protect
- current failure mode, risk, or workflow concern
- whether you want a proof path, a setup walkthrough, or a workflow review

What this is not:

- not a vulnerability disclosure path; use `SECURITY.md` for security findings
- not a managed control plane or hosted enterprise onboarding flow
- not a promise that every custom setup request will be accepted
