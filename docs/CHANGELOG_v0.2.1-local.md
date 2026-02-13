# Changelog: v0.2.0-local -> v0.2.1-local

## Summary
- Scope: interaction clarity and command-surface de-clutter.
- Direction: preserve modern SaaS shell while improving connect reliability and reducing canvas occlusion.
- Contracts: no diagram schema or JSON payload changes.

## UX Delta
- Replaced heavy topbar action slab with a compact File action cluster while preserving QA-critical labels/test IDs (`Import JSON`, `Export JSON`, `Reset`, `Restore Backup`).
- Tightened bottom status bar to status-only primitives (zoom, fit, snap, grid, coordinates, selection), with a single Canvas jump action.
- Moved canvas utility toggles (ports, minimap, lane grouping) into Inspector `Canvas` tab.
- Stabilized floating context bar behavior to avoid blocking edge/minimap interactions.
- Improved connect-mode clarity with stronger source/target signaling and larger draw-mode port hit targets.
- Increased selected node/edge visual contrast and focus treatment consistency.
- Reduced sidebar visual noise and tightened density for faster scanning.

## Process Delta
- Added repo-level Karpathy rule file: `.cursor/rules/karpathy-guidelines.md` (`alwaysApply: true`).
- Updated Playwright local run config to support configurable port (`PW_PORT`) and local server reuse outside CI.

## QA Delta
- `npm run build`: PASS
- `PW_PORT=4273 npx playwright test e2e/connect-human.spec.ts`: PASS (7/7)
- `PW_PORT=4273 npm run test:smoke`: PASS (7/7)
- `PW_PORT=4273 npm run test:acceptance`: PASS (10/10)
- `PW_PORT=4273 npm run test:a11y`: PASS (3/3)

## Public Contract Safety
- No breaking changes to schema or payload contracts (`nodes`, `edges`, `drawings`, layout persistence format).
- No import/export compatibility breaks.

## Tag Metadata
- `v0.2.1` (annotated): `Local release: interaction clarity and declutter hardening`
