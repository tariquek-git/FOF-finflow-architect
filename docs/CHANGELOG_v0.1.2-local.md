# Changelog: v0.1.1-local -> v0.1.2-local

## Summary
- Comparison range: `v0.1.1-local..v0.1.2-local`
- Source tag commit: `04550ef2dc810386390a53f2d2648bc0f0c81e94`
- Target tag commit: `b8d4f1045c51d9e5e955866c5f0af52e50aafab9`
- Scope: focused pre-launch UX polish and expanded MVP UX/a11y coverage.

## UX Delta
- Updated mobile toolbar structure to keep primary actions text-first and avoid clipping.
- Added persistent `Help` control to reopen Quick Start after dismissal.
- Expanded backup status copy to include inline recency context when metadata is available.
- Standardized mobile touch targets to a minimum 40px with visible keyboard focus outlines.

## Test and CI Delta
- Added new suites:
  - `e2e/mvp-mobile-toolbar.spec.ts`
  - `e2e/mvp-help-reopen.spec.ts`
- Extended existing suites:
  - `e2e/mvp-recovery-status.spec.ts` for backup recency metadata assertions.
  - `e2e/a11y.spec.ts` for updated control names and keyboard focus visibility.
- Added npm scripts:
  - `test:mvp:mobile-toolbar`
  - `test:mvp:help-reopen`
- Updated `.github/workflows/qa.yml` to run the new pre-launch UX tests.

## Commit Delta
1. `b8d4f10` feat: polish prelaunch ux controls and guidance
2. `7b9d68a` docs: finalize v0.1.1 local handoff and release metadata

## File Delta
- `.github/workflows/qa.yml`
- `App.tsx`
- `docs/CHANGELOG_v0.1.1-local.md`
- `docs/LAUNCH_CHECKLIST.md`
- `docs/LOCAL_RELEASE_HANDOFF.md`
- `e2e/a11y.spec.ts`
- `e2e/mvp-help-reopen.spec.ts`
- `e2e/mvp-mobile-toolbar.spec.ts`
- `e2e/mvp-recovery-status.spec.ts`
- `index.css`
- `package.json`
- `release-artifacts/finflow_review-v0.1.1-local.sha256`

## Tag Metadata
- `v0.1.2-local-ux-rc1`: 2026-02-12 23:00:17 -0500 (`Local UX release candidate`)
- `v0.1.2-local`: 2026-02-12 23:00:17 -0500 (`Local UX MVP release`)
