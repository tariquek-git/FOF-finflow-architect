# Changelog: v0.2.1-local -> v0.2.2-local

## Summary
- Scope: MVP UI de-clutter + public-ready polish.
- Direction: reduce duplicated command surfaces and keep canvas interactions unobstructed.
- Contracts: no diagram schema, payload, or import/export format changes.

## UX Delta
- Topbar de-cluttered to global actions only (history, compact file actions, help, theme), with QA-critical labels/test IDs preserved.
- Removed view controls from the topbar and centralized them in Inspector `Canvas` tab.
- Kept bottom surface status-only (zoom, fit/reset, snap, grid, coordinates, selection count, Canvas jump).
- Made floating context bar anchor-aware and less occluding; connect mode now uses a minimal command surface.
- Reduced sidebar visual noise and removed duplicated swimlane/lane-grouping controls.
- Strengthened node/edge selected-state visual contrast and connect-mode hit affordances.

## Launch Hardening Delta
- Updated `vercel.json` with SPA rewrite and security headers for hosted readiness.

## QA Delta
- `npm run build`: PASS
- `PW_PORT=4273 npx playwright test e2e/connect-human.spec.ts`: PASS (7/7)
- `PW_PORT=4273 npm run test:smoke`: PASS (7/7)
- `PW_PORT=4273 npm run test:acceptance`: PASS (10/10)
- `PW_PORT=4273 npm run test:a11y`: PASS (3/3)
- `PW_PORT=4273 npm run test:mvp:mobile-actions`: PASS (1/1)
- `PW_PORT=4273 npm run test:mvp:mobile-toolbar`: PASS (1/1)

## Public Contract Safety
- No changes to `types.ts` payload contracts (`nodes`, `edges`, `drawings`, `layout`).
- No import/export compatibility breaks in `lib/diagramIO.ts`.

## Tag Metadata
- Target tag: `v0.2.2` (annotated)
- Message: `Local release: MVP UI polish and de-clutter`
