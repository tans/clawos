# Test Directory (Stage A)

This repository centralizes all automated tests under `test/`.

## Layered layout

- `test/unit/`: fast, isolated logic tests.
- `test/integration/`: cross-module integration tests (gateway/api/tasks/system/mcp/desktop).
- `test/contract/`: schema and manifest contract checks.
- `test/e2e/`: end-to-end workflow tests.
- `test/smoke/`: release-blocking smoke tests.
- `test/fixtures/`: shared test data.
- `test/helpers/`: shared test utilities.

## Standard entry

Run all tests:

```bash
bun test test
```

Run contracts only:

```bash
bun test test/contract
```

Run integrations only:

```bash
bun test test/integration
```

## Commit-time trigger

A git `pre-commit` hook is provided at `.githooks/pre-commit` and runs:

```bash
bun test test
```

Hook path is auto-configured by `npm/bun/pnpm install` via `prepare` (`scripts/setup-git-hooks.sh`).

If you need a one-time bypass for emergency commits:

```bash
SKIP_TEST_ON_COMMIT=1 git commit -m "..."
```
