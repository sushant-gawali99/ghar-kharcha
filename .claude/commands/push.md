Push the current branch to remote following trunk-based development rules.

Steps:
1. Run `git status` — confirm there are no uncommitted changes. If there are, stop and ask the user to commit first (or run /commit).
2. Run `pnpm test` — if tests fail, stop and report. Do NOT push until tests pass.
3. Check the current branch:
   - If on `main`: run `git pull --rebase origin main` first, then `git push origin main`
   - If on a feature branch: check when the branch was created. Warn if it is more than 2 days old (stale branch — should be merged or rebased). Then run `git rebase main` and `git push origin <branch> --force-with-lease`
4. Confirm the push succeeded and show the remote URL or branch link.

Never use `--force` (only `--force-with-lease`). Never push to a branch that isn't yours.
