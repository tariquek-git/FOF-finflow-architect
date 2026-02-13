# Changelog: v0.1.2-local -> v0.2.0-local

## Summary
- Scope: modern SaaS UI/UX consolidation (single-cut release).
- Direction: clean fintech visual language, balanced density, subtle utility motion.
- Contracts: no diagram schema or JSON payload changes.

## UX Delta
- Introduced expanded design tokens and reusable UI utility classes in `index.css`.
- Modernized shell and toolbar grouping with clearer hierarchy while preserving existing control labels.
- Refined sidebar visual hierarchy, category cards, and search affordances.
- Refined inspector panel cards, field rhythm, helper text, and focus behavior.
- Improved canvas node readability and selected-state clarity without changing interaction semantics.
- Harmonized toast and panel visual consistency.

## QA Delta
- `npm run build`: PASS
- `npm run test:qa`: PASS (24/24)
- Accessibility and mobile toolbar suites remain passing.

## Files Changed
- `App.tsx`
- `components/FlowCanvas.tsx`
- `components/Inspector.tsx`
- `components/Sidebar.tsx`
- `index.css`
- `docs/mvp-qa-e2e-report.md`
- `docs/mvp-qa-e2e-report.json`
- `docs/mvp-qa-report.md`
- `docs/CHANGELOG_v0.2.0-local.md`
- `docs/LOCAL_RELEASE_HANDOFF.md`
- `docs/LAUNCH_CHECKLIST.md`
- `docs/RELEASE_POLICY.md`

## Tag Metadata
- `v0.2.0` (annotated): `Local release: modern SaaS UI/UX consolidation`
