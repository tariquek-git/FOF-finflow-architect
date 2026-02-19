# Public Beta Launch Checklist (Session-Only MVP)

## Scope Lock
- [x] Public beta target
- [x] Session-only persistence (reload keeps state; closing tab/browser clears unless exported)
- [x] AI disabled by default in public builds (`VITE_ENABLE_AI=false`)
- [x] Cloud sync scaffold remains disabled for beta (`VITE_ENABLE_CLOUD_SYNC=false`)

## Core Gate (must be green on release candidate)
Run in order:
1. `npm run doctor`
2. `npm run build`
3. `npm run test:smoke`
4. `npm run test:mvp`
5. `npm run test:qa`

Pass criteria:
- [x] 0 failed tests
- [x] no unexpected skips (current `test:qa` has 4 intentional swimlane skips)

## Reliability Soaks (must be green before beta cut)
1. `PW_REUSE_SERVER=1 PW_PORT=5173 npx playwright test e2e/mouse-interactions.spec.ts --repeat-each=30 --workers=1`
2. `PW_REUSE_SERVER=1 PW_PORT=5173 npx playwright test e2e/edge-reconnect.spec.ts --repeat-each=20 --workers=1`
3. `PW_REUSE_SERVER=1 PW_PORT=5173 npx playwright test e2e/mvp-interactions-minimal.spec.ts --repeat-each=20 --workers=1`

Pass criteria:
- [x] 0 flakes

## Accessibility + Keyboard Coverage
- [x] `npm run test:a11y`
- [x] `PW_REUSE_SERVER=1 PW_PORT=5173 npx playwright test e2e/smoke.spec.ts --workers=1`
- [x] `PW_REUSE_SERVER=1 PW_PORT=5173 npx playwright test e2e/vpe-hand-tool.spec.ts --workers=1`

## Session-Only Contract Validation
- [x] `e2e/mvp.spec.ts` remains green
- [x] `scripts/pilot-human.mjs` reports `reloadKeepsSession: true`
- [x] manual close/reopen confirms blank canvas

## Performance + No-Noise Checks
- [x] `QA_BASE_URL='http://127.0.0.1:5181/?fresh=1' node scripts/qa-focused.mjs`
- [x] `PILOT_BASE_URL='http://127.0.0.1:5181/?fresh=1' node scripts/pilot-human.mjs`
- [x] pilot summary reports no `consoleErrors` and no `pageErrors`

## Manual QA + Real User Pilot
- [ ] Execute `/Users/tarique/Documents/banking-diagram-mvp/docs/MVP_MANUAL_QA_CHECKLIST.md`
- [ ] Run 3–5 real-user sessions
- [ ] Log all sessions in `/Users/tarique/Documents/banking-diagram-mvp/docs/LOCAL_PILOT_SESSION_LOG.csv`
- [ ] Completion rate >= 80%
- [ ] No unresolved P0 issues
- [ ] P1 issues triaged (fix now or explicit defer)

## Security/Dependency Gate
- [x] `npm audit --omit=dev --audit-level=high`
- [x] Result: 0 high / 0 critical vulnerabilities

## Hosted CI/Release Policy
- [ ] Branch protection on hosted `main` requires `qa`
- [x] RC workflow includes `test:qa` + soak subset (`beta_soak` job on `v*-public-rc*` tags)
- [x] Freeze beta branch/tag and record commit in `docs/LOCAL_RELEASE_HANDOFF.md`

## Vercel Deploy Readiness
- [ ] Production branch is `main`
- [ ] Env set in Preview + Production:
  - [ ] `VITE_ENABLE_AI=false`
  - [ ] `VITE_ENABLE_CLOUD_SYNC=false`
  - [ ] `VITE_FEEDBACK_URL=<mailto or form>`
- [ ] Production smoke completed on deployed URL:
  - [ ] blank-first load
  - [ ] insert starter template
  - [ ] connect/reconnect
  - [ ] export JSON
  - [ ] reset blank
  - [ ] import restore
  - [ ] no console errors

## Latest Evidence (update per run)
- Date: `2026-02-19` (local run window, refreshed)
- Branch: `codex/finflow-mvp-main`
- Commit: `dde236e`
- Gate results:
  - doctor: `pass`
  - build: `pass`
  - smoke: `pass` (`8/8`)
  - mvp: `pass` (`1/1`)
  - qa: `pass` (`87 passed / 4 skipped / 0 failed`)
- Soak results:
  - mouse interactions: `pass` (`80/80`)
  - edge reconnect: `pass` (`20/20`)
  - minimal interactions: `pass` (`20/20`)
- Freeze tag: `v0.3.0-rc3`
- Pilot artifacts: `/Users/tarique/Documents/banking-diagram-mvp/output/pilot/2026-02-19T05-22-43-953Z`
- Performance artifacts: `/Users/tarique/Documents/banking-diagram-mvp/qa-artifacts/2026-02-19T05-22-26-112Z`
