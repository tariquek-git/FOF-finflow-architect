# Release Policy (MVP)

## Tags
- `v0.1.0-mvp-rc1`: first release candidate
- `v0.1.0`: first public MVP launch tag on legacy line
- `v0.2.0`: current local modern SaaS UI/UX release tag of record
- `v0.2.1-public-rc1`: reserved next hosted public RC tag
- `v0.2.1`: reserved next hosted public launch tag

## Merge Requirements
- Protected `main`
- Required passing status check: `qa`
- PR review required before merge

## Hosted Launch Rule
- Keep local-first validation as default.
- Promote to hosted/public only after local gate is green and handoff artifacts are frozen.
