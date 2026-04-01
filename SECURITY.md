# Security Reporting

Use private reporting if GitHub security reporting or advisories are available for this repository.
If private reporting is not available, open a minimal issue, keep exploit detail out of the thread, and ask for a private follow-up.

The most relevant findings here are:

- auth bypass
- scope bypass
- trust-boundary bypass
- replay or preflight bypass
- data exfiltration bypass
- response sanitization bypass
- any failure that lets unsafe traffic reach the stdio target or HTTP companion service

Include:

- affected version or commit
- trust gate or component involved
- exact reproduction steps
- expected behavior
- observed behavior
- impact

Please avoid live credentials, private datasets, or third-party secrets in reports.
Fixes are expected on `main` and, when practical, on the latest supported tagged line.

If you need workflow intake or trust-gate help rather than reporting a vulnerability, use [workflow intake notes](docs/GUIDED_SETUP_AND_AUDITS.md) instead of `SECURITY.md`.
