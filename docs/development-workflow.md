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
npm run signals:generate:rules
```

## Gemini signal generation

The rules engine remains authoritative for selecting signals, supporting links and counts. Gemini only enhances the pattern, summary and `what_to_notice` fields from existing public link metadata.

Rules-only generation is the default and does not need any Gemini configuration:

```bash
npm run signals:generate:rules
```

To exercise Gemini locally, provide an API key through the environment (never commit it) and use the production model unless deliberately testing another model:

```bash
SIGNALS_PROVIDER=gemini \
GEMINI_API_KEY=your_key \
GEMINI_MODEL=gemini-2.5-flash \
npm run signals:generate
```

`GEMINI_API_KEY` is required only for Gemini generation. `GEMINI_MODEL` is optional locally and defaults to `gemini-2.5-flash`. The scheduled workflow pins that same model in source control. A production model change must be an intentional reviewed code change, rather than a moving `latest` alias or repository-variable update.

Every generated `src/data/signals/latest.json` records a public-safe `generation_diagnostics` object with the requested and used provider, outcome, model, attempts, and (for a fallback) a safe failure category and HTTP status. It never stores prompts, response bodies, keys, URLs, headers or stack traces.

Gemini uses structured output, bounded retries for transient failures and complete-ID validation. If it is unavailable or produces an invalid response, generation uses the rules output instead. The site still builds and deploys; the weekly GitHub Actions job emits a warning and adds the outcome to its job summary when that fallback occurs.

## Direct commits to main

Direct commits to `main` should be rare. They are acceptable only when:

- the user explicitly asks for a direct commit, or
- there is a trivial emergency fix and the user explicitly approves bypassing the pull request flow.

When in doubt, open a pull request.
