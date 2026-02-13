# Local MVP Launch Checklist

## Local Gate Evidence (v0.1.2-local)
- [x] `npm run doctor`
- [x] `npm run build`
- [x] `npm run test:smoke`
- [x] `npm run test:mvp`
- [x] `npm run test:mvp:onboarding`
- [x] `npm run test:mvp:feedback`
- [x] `npm run test:mvp:help-reopen`
- [x] `npm run test:mvp:mobile-toolbar`
- [x] `npm run test:qa`
- [x] Gate run timestamp (UTC): `2026-02-13 03:59:07Z` to `2026-02-13 03:59:56Z`
- [x] Gate run timestamp (local): `2026-02-12 22:59:07 EST` to `2026-02-12 22:59:56 EST`

## Local Release Tags
- [x] Baseline RC tag: `v0.1.0-mvp-rc1`
- [x] Baseline local release: `v0.1.0-local`
- [x] UX RC tag: `v0.1.1-local-ux-rc1`
- [x] UX local release: `v0.1.1-local`
- [x] Pre-launch UX RC tag: `v0.1.2-local-ux-rc1`
- [x] Pre-launch local release: `v0.1.2-local`

## Local Deliverable Freeze
- [x] Artifact: `release-artifacts/finflow_review-v0.1.2-local.tar.gz`
- [x] Checksum: `release-artifacts/finflow_review-v0.1.2-local.sha256`
- [x] SHA-256: `f7e57428994ab2ea12ee92e91cb575d149b6e6befd6733ab8263282c03635186`

## GitHub
- [ ] Open PR to `main` (pending remote cutover decision)
- [ ] Require `qa` branch protection on `main` (pending hosted Git provider access)

## Vercel
- [ ] Connect project to repository (pending)
- [ ] Configure production and preview deployments (pending)
- [ ] Set `VITE_ENABLE_AI=false` in hosted environments (pending)

## Local-Only Notes
- Release branch of record: `codex/ux-polish-prelaunch`
- Previous release branch: `codex/bootstrap-ci-gate`
- Local origin remains the source of truth for frozen local artifacts.
