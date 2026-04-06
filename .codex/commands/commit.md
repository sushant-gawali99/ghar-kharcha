Commit all staged and unstaged changes following trunk-based development rules.

Steps:
1. Run `git status` to see what has changed
2. Run `pnpm test` — if any tests fail, stop and report the failures. Do NOT commit until tests pass.
3. Run `git diff` (staged + unstaged) to understand what changed
4. Stage all relevant files (avoid `.env`, secrets, large binaries)
5. Write a concise commit message:
   - First line: imperative mood, ≤72 chars (for example `fix: align mobile home screen with stitch export`)
   - Use `feat:`, `fix:`, `chore:`, `test:`, or `refactor:` prefix
   - Add a short body only if the why is not obvious from the title
6. Commit using the message
7. Run `git status` to confirm the working tree is clean

Do not push. Do not amend previous commits.
