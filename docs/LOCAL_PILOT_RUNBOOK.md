# Local Pilot Runbook (MVP Validation)

## Goal
Run a short local validation sprint with 3 to 5 users to verify first-session MVP success.

## Pilot Scope
- Flow under test: edit -> export JSON -> reset -> import JSON -> verify recovery.
- Environment: local app (`npm run dev`, `http://127.0.0.1:5173/?fresh=1` for clean sessions).
- Data handling: anonymous user IDs only, no personal data.
- Success focus: first-session completion only.

## Facilitator Setup
1. Start app locally with `npm run dev`.
2. Open a fresh browser profile or use `?fresh=1` before each session.
3. Have `docs/LOCAL_PILOT_SESSION_LOG.csv` open to log outcomes.
4. Use a 15-minute max session timer.

## Participant Script
1. Start on blank canvas and add/edit at least one node or connector.
2. Export the diagram as JSON.
3. Reset canvas to blank.
4. Import the exported JSON.
5. Confirm restored state matches the pre-reset edit.

## Logging Rules
- Record one row per participant session in `docs/LOCAL_PILOT_SESSION_LOG.csv`.
- Track completion, duration, failed step(s), and friction notes.
- Mark severity as:
  - `high`: user cannot complete first-session flow without intervention.
  - `medium`: user completes with confusion or multiple retries.
  - `low`: minor friction without completion risk.

## Triage Rule
- Patch only `high` severity blockers before next local release.
- Defer `medium` and `low` issues to post-MVP backlog unless they cluster.

## Exit Criteria
- At least 3 sessions logged.
- At least 80% first-session completion.
- No unresolved `high` severity blocker.
