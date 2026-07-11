# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a vulnerability

Please **do not** open a public issue for security flaws that could expose API keys, enable XSS via highlight injection, or escalate extension privileges.

Prefer:

1. GitHub **Private vulnerability reporting** (if enabled on the repo), or  
2. Email the maintainers (add contact before public launch)

Include:

- Extension version  
- Browser version  
- Reproduction steps  
- Impact assessment  

## Security notes for contributors

- Never log API keys  
- Treat article text as sensitive user data  
- Sanitize any HTML before `innerHTML` (prefer `textContent`)  
- Keep permissions minimal  
