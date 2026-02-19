# MVP Manual QA Checklist (Local, Session-Only)

Target URL (dev): `http://127.0.0.1:5173/?fresh=1`

Notes:
- Storage is **session-only**: reload keeps state, closing the tab/browser clears state unless exported.
- Swimlanes are **off** for MVP.

## Setup

1. Open the app at the target URL.
2. Open DevTools console.
3. Confirm there are no red errors on initial load.

## Core Flow (Happy Path)

1. Insert starter template (File menu -> Insert Starter Template).
Expected: Nodes + edges appear.

2. Select a node.
Expected: Inspector shows `Node` mode and `#node-field-label`, `#node-field-type`, `#node-field-notes` exist.

3. Create a new edge by connecting two nodes (select-mode drag handle-to-handle).
Expected: Edge appears; no accidental panning/marquee selection; edge is selectable.

4. Export JSON (File menu -> Export JSON).
Expected: Download starts and completes; toast "Diagram exported successfully." appears.

5. Reset (File menu -> Reset Workspace).
Expected: Canvas becomes blank; toast "Canvas reset to blank. Backup saved." appears.

6. Import the exported JSON.
Expected: Diagram returns; toast "Diagram imported successfully. Backup saved." appears.

## Notes (Isolation + Persistence)

1. Select a node, type a unique note into `#node-field-notes`, blur the field.
Expected: Note persists on re-select; no metadata tags are injected into notes.

2. Export JSON and inspect the downloaded JSON.
Expected: Node notes are in `node.data.notes` (raw text).

3. Refresh the page.
Expected: Diagram persists (same session); notes still present.

4. Close the tab/browser, reopen the URL.
Expected: Blank canvas (new session).

## Edge UX (Select + Reconnect)

1. Click an edge (not a node).
Expected: Edge selection is easy (hit target feels >= 12px); Inspector switches to `Edge`.

2. Reconnect an edge endpoint.
Expected: Drag endpoint handle to a new node port; edge updates; undo restores previous endpoint.

3. Undo/redo edge style edits in Inspector (thickness, style, path, arrowheads).
Expected: Undo/redo works; no console errors.

## Input / Click-Off / Escape Behavior

1. Open the File menu, click outside.
Expected: Menu closes.

2. Open the View menu, press Escape.
Expected: Menu closes.

3. Select a node, then click empty canvas.
Expected: Selection clears; Inspector shows "Nothing selected".

## Mobile Sanity (390px wide)

1. Set viewport to ~390px width.
2. Confirm bottom tool dock visible and usable.
3. Use More actions (if present) and confirm it does not block canvas taps outside the sheet.

## Performance Smoke (Large Diagram)

1. Import a large diagram JSON (200+ nodes).
Expected: Pan/zoom/drag remain usable; no obvious 1-2s UI freezes; no console errors.

## Latest Execution Evidence

- Date (UTC): `2026-02-19T05:50:26Z`
- URL used: `http://127.0.0.1:5181/?fresh=1`
- Results summary:
  - [x] Core flow validated (insert starter -> edit/connect -> export -> reset -> import)
  - [x] Notes isolation and session reload persistence validated
  - [x] Close/reopen clears session validated (`closeReopenBlank: true`)
  - [x] Edge reconnect + selection reliability validated via repeat soaks
  - [x] Mobile overflow and click-off behavior validated
  - [x] Large graph interaction sanity validated (`scripts/qa-focused.mjs`)
- Supporting runs:
  1. `PW_REUSE_SERVER=1 PW_PORT=5181 npm run test:smoke`
  2. `PW_REUSE_SERVER=1 PW_PORT=5181 npm run test:mvp`
  3. `PW_REUSE_SERVER=1 PW_PORT=5181 npx playwright test e2e/mouse-interactions.spec.ts --repeat-each=20 --workers=1`
  4. `PW_REUSE_SERVER=1 PW_PORT=5181 npx playwright test e2e/edge-reconnect.spec.ts --repeat-each=10 --workers=1`
  5. `PW_REUSE_SERVER=1 PW_PORT=5181 npx playwright test e2e/mvp-interactions-minimal.spec.ts --repeat-each=20 --workers=1`
  6. `QA_BASE_URL='http://127.0.0.1:5181/?fresh=1' node scripts/qa-focused.mjs`
  7. `PILOT_BASE_URL='http://127.0.0.1:5181/?fresh=1' node scripts/pilot-human.mjs`
