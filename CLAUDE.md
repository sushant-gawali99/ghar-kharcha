# Development Practices

## Trunk-Based Development

All development happens on `main` (trunk). There are no long-lived feature branches.

### Rules
- **Short-lived branches only**: Feature branches are allowed but must be merged within 1–2 days. Prefer committing directly to `main` for small changes.
- **Small, atomic commits**: Each commit should represent one logical change that leaves the codebase in a working state.
- **No merge commits from feature branches**: Use `git rebase main` before merging to keep history linear.
- **Feature flags over long-lived branches**: If a feature isn't ready to ship, gate it behind a flag rather than keeping it on a branch.
- **Merge (or delete) stale branches**: Any branch older than 2 days without a merge in progress should be rebased or deleted.

### Branch Naming
```
feat/<short-description>
fix/<short-description>
chore/<short-description>
```

### Workflow
1. Pull latest `main`
2. Make a small, focused change
3. Run tests (`pnpm test`)
4. Commit and push to `main` (or open a short-lived PR for review)

---

## Test-Driven Development (TDD)

Write the test first, then write the minimum code to make it pass, then refactor.

### Red → Green → Refactor
1. **Red**: Write a failing test that describes the expected behaviour
2. **Green**: Write the simplest code that makes the test pass — no more
3. **Refactor**: Clean up duplication and improve structure without changing behaviour; tests must stay green

### Test Layers

| Layer | Tool | What to test |
|---|---|---|
| Unit | Vitest (backend), Jest (mobile) | Pure functions, business logic, Zod schemas |
| Integration | Vitest + real DB (test container or SQLite) | API routes, service layer, DB queries |
| E2E (mobile) | Maestro | Critical user flows (upload PDF, view analytics) |

### Rules
- **Test behaviour, not implementation**: Test what a function does, not how it does it.
- **No mocking the database in integration tests**: Hit a real (test) database. Mock-DB divergence has caused prod failures before.
- **Each test is independent**: Tests must not share state or depend on execution order. Use `beforeEach` to reset state.
- **Coverage is a by-product**: Write tests that exercise meaningful behaviour. Do not chase a coverage number.
- **Failing tests block merge**: `pnpm test` must pass before any commit lands on `main`.

### File Conventions
- Unit/integration tests live next to the source file: `foo.ts` → `foo.test.ts`
- E2E Maestro flows live in `/e2e/`

### Example TDD cycle (backend route)
```typescript
// 1. Red — write the test
it('returns 400 when PDF is missing', async () => {
  const res = await request(app).post('/api/invoices').send({})
  expect(res.status).toBe(400)
})

// 2. Green — write minimum handler code to pass
// 3. Refactor — extract validation, add types, etc.
```
