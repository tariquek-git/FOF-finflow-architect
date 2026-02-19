# FinFlow Builder

## MVP Definition

Canonical MVP scope and acceptance criteria live in `MVP_DEFINITION.md`.

## MVP Run Path (canonical)

1. `npm install`
2. `npm run doctor`
3. `npm run dev`
4. Open `http://127.0.0.1:5173`
5. Optional clean session: open `http://127.0.0.1:5173/?fresh=1`

Notes:
- Public MVP ships with AI disabled by default (`VITE_ENABLE_AI=false`).
- Core editor works without any API key.
- Storage for this MVP is **session-only**: your work autosaves while the tab is open (including reloads), but closing the tab/browser clears it unless you exported JSON.
- For local AI-only experiments, set:
  - `VITE_ENABLE_AI=true`
  - `VITE_GEMINI_API_KEY=<key>`

## Editor Shortcuts

- `Cmd/Ctrl + Z`: Undo
- `Cmd/Ctrl + Shift + Z` (or `Ctrl + Y`): Redo
- `Cmd/Ctrl + D`: Duplicate selected nodes
- `Delete` / `Backspace`: Delete selected node or edge
- Arrow keys: Nudge selected nodes (`Shift` = larger step)
- Hold `Space` + drag (or middle mouse drag): Pan canvas

## QA Gates

Install browsers once:

- `npm run test:smoke:install`

Minimum pre-merge gate:

- `npm run test:smoke`
- `npm run test:mvp`
- `npm run test:mvp:onboarding`
- `npm run test:mvp:feedback`

Acceptance flow coverage:

- `npm run test:acceptance`

Accessibility checks:

- `npm run test:a11y`

Full gate (all e2e suites):

- `npm run test:qa`

Beta reliability soaks:

- `npm run test:soak:mouse`
- `npm run test:soak:edge`
- `npm run test:soak:minimal`

## Vercel Launch Defaults

- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`
- Preview deploys: enabled for PRs
- Env defaults (preview + production):
  - `VITE_ENABLE_AI=false`
  - `VITE_ENABLE_CLOUD_SYNC=false` (default off until Supabase is configured)

## Launch Operations

- Release/tag policy: `docs/RELEASE_POLICY.md`
- Launch checklist: `docs/LAUNCH_CHECKLIST.md`
- Local pilot runbook: `docs/LOCAL_PILOT_RUNBOOK.md`
- Local pilot log template: `docs/LOCAL_PILOT_SESSION_LOG.csv`
- Hosted migration checklist: `docs/HOSTED_MIGRATION_CHECKLIST.md`
- Vercel setup guide: `docs/VERCEL_SETUP.md`
- Supabase setup guide: `docs/SUPABASE_SETUP.md`
