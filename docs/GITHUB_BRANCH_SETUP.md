# GitHub Branch Setup (FOF-finflow-architect)

This repo currently uses `codex/finflow-mvp-main` as the MVP mainline branch.

## Set Default Branch
1. Open the GitHub repo settings for `tariquek-git/FOF-finflow-architect`.
2. Go to **Branches**.
3. Change the default branch to: `codex/finflow-mvp-main`.

Why: the existing `main` branch points to a different history, so PRs and CI should target the MVP branch.

## Protect The Mainline Branch
1. In **Settings → Branches**, add a branch protection rule for `codex/finflow-mvp-main`.
2. Require status checks to pass before merging:
   - Require the `qa` workflow/check (the required check name depends on the workflow configuration).
3. Recommended:
   - Require pull request reviews before merging.
   - Require branches to be up to date before merging.

## PR Targeting
When opening PRs, set the base branch to `codex/finflow-mvp-main`.

## Optional Cleanup (Later)
If you want the canonical branch to be called `main`, do this after you confirm everything is stable:
1. Keep a backup branch for the old `main` (already created as `main-legacy-2026-02-17`).
2. Rename `codex/finflow-mvp-main` to `main` in GitHub UI.
3. Re-apply branch protection on the new `main`.

