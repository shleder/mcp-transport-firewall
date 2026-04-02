This repository is a transport control. It does not claim to be a complete execution-security stack.

Current limits:

- the primary enforcement path is stdio; the HTTP service is a compatibility harness
- strict schema enforcement applies only to registered tool contracts
- the shared-secret auth envelope is not cryptographic attestation
- the current egress gate is recursive string inspection, not a full parser
- cache behavior is optimized for allowlisted read-style tools only
- this repository is not presented as a broad MCP platform or hosted control plane

Non-goals:

- cryptographic identity attestation for every actor in the chain
- kernel, VM, or container sandboxing
- complete semantic detection of every prompt-injection variant
- post-execution containment after a tool has already started
- universal coverage for every MCP deployment topology or custom tool contract
