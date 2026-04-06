Guide a TDD cycle (Red → Green → Refactor) for a given piece of behaviour.

Usage: /tdd <description of the behaviour to implement>
Example: /tdd "POST /api/invoices returns 400 when no PDF is attached"

Steps:
1. **Red** — Write a failing test that describes the behaviour exactly:
   - Place the test file next to the source file (`foo.ts` → `foo.test.ts`)
   - Use descriptive test names ("returns 400 when PDF is missing", not "test1")
   - Run `pnpm test` and confirm the test fails for the right reason
2. **Green** — Write the minimum production code to make the test pass:
   - No extra logic, no future-proofing, no refactoring yet
   - Run `pnpm test` and confirm all tests pass
3. **Refactor** — Clean up without changing behaviour:
   - Remove duplication, improve naming, extract helpers only if clearly needed
   - Run `pnpm test` after every change to stay green
4. Summarise what was built and what the test covers

Rules:
- Never skip the Red step — the test must fail first
- Never write more production code than is needed to pass the current test
- Do not mock the database in integration tests; use a real test DB
