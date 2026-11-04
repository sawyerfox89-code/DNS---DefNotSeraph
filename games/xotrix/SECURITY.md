# Security Policy

## Scope

XOTrix is a static, browser-only application. It does not include a server, database, authentication system, payment flow, or environment-variable configuration. Security reports should focus on vulnerabilities in the committed client-side code, unsafe handling of user-controlled values, dependency loading, or repository configuration.

## Supported versions

Only the latest commit on the `main` branch is supported for security fixes.

## Reporting a vulnerability

Please do not disclose security vulnerabilities in a public issue. Report them through the repository’s [private security advisory page](https://github.com/vincenzo-afk/XOTrix/security/advisories/new) when available. If GitHub does not provide that form, contact the repository owner through [GitHub](https://github.com/vincenzo-afk).

Include a clear description, reproducible steps, affected file or behavior, impact, and any suggested mitigation. Do not include secrets or personal data in the report.

There is no guaranteed response time or service-level agreement. Reports are reviewed as maintainer availability permits.

## Safe disclosure

Please allow the maintainer reasonable time to investigate and release a fix before publicly disclosing a confirmed vulnerability. Coordinated disclosure helps protect users of the live deployment and downstream copies.
