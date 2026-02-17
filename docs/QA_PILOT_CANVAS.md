# Canvas Pilot QA (Human + Automation)

Goal: validate the editor behaves like modern diagram tools under real interaction patterns (mouse/trackpad style input) without regressing MVP functions.

## Automated Soak Evidence (Playwright)
Run date: 2026-02-17 (local).

1. Click-off + menu lifecycle + direct-connect arming (repeat soak)
   - Command: `PW_PORT=4781 npx playwright test e2e/mouse-interactions.spec.ts --repeat-each 20`
   - Result: **80/80 passed**

2. Edge reconnect reliability (repeat soak)
   - Command: `PW_PORT=4782 npx playwright test e2e/edge-reconnect.spec.ts --repeat-each 10`
   - Result: **20/20 passed**

3. Note drag (repeat soak)
   - Command: `PW_PORT=4783 npx playwright test e2e/note-drag.spec.ts --repeat-each 10`
   - Result: **10/10 passed**

## Manual QA Script (Do This Like A User)

### 1) Selection / Deselect
1. Insert two nodes.
2. Click one node: it becomes selected.
3. Click empty canvas: selection clears.
4. Shift+click both nodes: multi-select.
5. Shift+click one again: it toggles off.

Expected:
- No unexpected selection changes from clicking menus/toolbars.
- Click-off always clears selection (no “sticky” selection).

### 2) Drag + Zoom Stability
1. Zoom to 50%, drag a node.
2. Zoom to 150%, drag a node.
3. Drag fast, release outside node bounds.

Expected:
- Node moves under pointer without drift.
- Drag does not get “stuck” if pointer exits the node (pointer capture works).

### 3) Connect + Cancel
1. In Select mode, drag from a node port to another node port.
2. Repeat but drop on empty canvas to cancel.
3. Repeat but press Escape to cancel pending connection.

Expected:
- Preview edge follows cursor.
- Drop on valid port creates edge.
- Drop on canvas cancels cleanly (no stray edge).
- Escape cancels and returns to Select behavior.

### 4) Edge Select + Reconnect
1. Click an edge: it becomes selected.
2. Drag an endpoint handle to a different node port (reconnect).
3. Drop on empty canvas (cancel reconnect).

Expected:
- Edge hit target is easy to click.
- Reconnect succeeds on valid port.
- Cancel reconnect restores original endpoint.

### 5) Notes (Text Tool)
1. Choose Text tool.
2. Click empty canvas: a note appears and enters edit.
3. Click outside: edit commits.
4. Drag the note.
5. Refresh the page.

Expected:
- Notes do not trigger pan/marquee selection when interacted with.
- Notes remain after refresh (autosave/persistence).

### 6) Import / Export / Undo / Redo (Regression)
1. Make a change.
2. Export JSON.
3. Reset.
4. Import JSON.
5. Undo and redo several steps.

Expected:
- Notes and edges survive export/import.
- Undo/redo restores moves + connects + deletes.

## What To Record (If Something Feels Off)
For any issue, capture:
- Tool mode (Select/Pan/Connect/Text)
- Zoom percent
- Whether the pointer started on: node body / port / edge / canvas
- Whether a menu/panel was open
- Repro steps with 3+ repeats

