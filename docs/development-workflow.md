# Development workflow

Civic Signals uses small, reviewable pull requests for repository changes.

## Default workflow

1. Create a feature or fix branch from `main`.
2. Make the change on that branch.
3. Open a pull request with a clear summary.
4. Let GitHub Actions run.
5. Merge only after the change has been reviewed or approved.

Do not commit directly to `main` unless the change is a trivial emergency fix and that approach has been explicitly approved.

## Branch names

Use short branch names that describe the work:

- `feature/structured-signals`
- `feature/weekly-themes`
- `fix/signal-generation-build`
- `docs/development-workflow`

## Pull request size

Prefer small pull requests. Each pull request should focus on one feature, fix or design change.

A good pull request should explain:

- what changed
- why the change was made
- how it was checked
- any follow-up work or known limitations

## Checks

GitHub Actions should run before a pull request is merged. For site changes, the key check is that the Astro build completes successfully.

For local checks, use:

```bash
npm run build
```

For signals changes, also run:

```bash
npm run signals:generate
```

## Direct commits to main

Direct commits to `main` should be rare. They are acceptable only when:

- the user explicitly asks for a direct commit, or
- there is a trivial emergency fix and the user explicitly approves bypassing the pull request flow.

When in doubt, open a pull request.
