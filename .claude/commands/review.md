Review all uncommitted changes (staged + unstaged) before they are committed.

Steps:
1. Run `git diff HEAD` to get the full diff
2. For each changed file, review:
   - **Correctness**: does the logic do what the commit message / task says?
   - **Tests**: are there tests for the new behaviour? If not, flag the gap.
   - **TDD compliance**: was this written test-first? If new logic has no corresponding test file changes, call it out.
   - **Security**: check for hardcoded secrets, SQL injection, unvalidated user input, XSS vectors
   - **Scope creep**: flag any changes unrelated to the stated task
   - **Code quality**: obvious duplication, unclear naming, missing error handling at system boundaries
3. Summarise findings as:
   - Blockers (must fix before committing)
   - Suggestions (worth fixing but not blocking)
   - Looks good (nothing to flag)

Be concise. Only comment on things that actually matter. Do not suggest adding comments, docstrings, or abstractions that aren't needed.
