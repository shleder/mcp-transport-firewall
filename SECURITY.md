

This repository implements a fail-closed MCP transport firewall. Security reports are especially relevant when they involve:

- auth bypass
- scope bypass
- trust-boundary bypass
- replay or preflight bypass
- data exfiltration bypass
- response sanitization bypass
- failures that allow unsafe traffic to reach the stdio target or HTTP companion service


Security fixes are expected on:

- the latest tagged release
- the `main` branch

Older releases may not receive backports.


Do not publish full exploit details in a public issue if the issue could expose active users.

Preferred path:

1. Use GitHub private vulnerability reporting or a security advisory if available for this repository.
2. If that path is unavailable, open a minimal public issue requesting a private follow-up and exclude proof-of-concept details, secrets, and exploit instructions.

Include:

- affected version or commit
- trust gate or component affected
- reproduction steps
- expected behavior
- observed behavior
- impact assessment


- Provide enough detail to reproduce the issue safely.
- Avoid posting live credentials, private datasets, or third-party secrets.
- Give maintainers reasonable time to validate and patch before broad public disclosure.
