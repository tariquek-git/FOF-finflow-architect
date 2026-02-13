# Local Release Handoff (v0.2.2)

## Release Identity
- Release branch of record: `codex/uiux-v022-mvp-polish`
- Local remote source of truth: `/Users/tarique/Documents/banking-diagram-mvp-origin.git`
- Release tag of record: `v0.2.2`
- Release type: Local-first MVP UI de-clutter + public-ready polish

## Engineering Rules
- Karpathy guidelines remain enforced at repo level via:
  - `.cursor/rules/karpathy-guidelines.md`
- QA/review checks for each change set:
  - assumptions are explicit,
  - implementation remains minimal/surgical,
  - success criteria are verifiable in test output.

## Gate Evidence
All commands passed with exit code `0`:
1. `npm run build`
2. `PW_PORT=4273 npx playwright test e2e/connect-human.spec.ts`
3. `PW_PORT=4273 npm run test:smoke`
4. `PW_PORT=4273 npm run test:acceptance`
5. `PW_PORT=4273 npm run test:a11y`

## QA Snapshot
- Connect-human suite: pass (7/7)
- Smoke suite: pass (7/7)
- Acceptance suite: pass (10/10)
- Accessibility suite: pass (3/3)

## Public Contract Safety
- No changes to schema or payload contracts (`nodes`, `edges`, `drawings`, layout persistence format).
- No breaking changes to import/export behavior.

## Deliverables
- QA summary docs:
  - `docs/mvp-qa-report.md`
  - `docs/CHANGELOG_v0.2.2-local.md`
- Review artifacts (generated during release cut):
  - `/Users/tarique/Downloads/banking-diagram-mvp_v0.2.2_handoff_<timestamp>.tar.gz`
  - `/Users/tarique/Downloads/banking-diagram-mvp_v0.2.2_handoff_<timestamp>.zip`

## Notes
- View controls are centralized in Inspector `Canvas` tab to reduce duplicated command surfaces.
- Topbar and bottom bar now separate global actions from status-only controls.
- Existing QA-critical labels and test IDs remain preserved.
