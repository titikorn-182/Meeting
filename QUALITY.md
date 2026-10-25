# Quality checks (phases 1–2)

Run `npm ci`, then `npm run check` before submitting changes. The GitHub workflow runs these checks and a production build on pushes and pull requests. It needs no hosted database credentials. The workflow runs on GitHub only after the changes are pushed.

## Commands

- `npm run format` formats application source, configuration and test scripts. SQL migration history, Markdown documents, lock files and generated/private files are excluded.
- `npm run format:check` checks formatting without writing files.
- `npm run lint` applies Next.js, React and TypeScript rules, including a ban on explicit `any`, `@ts-ignore` and `@ts-nocheck`. Negative type tests may use a documented `@ts-expect-error`.
- `npm run typecheck` checks types without generating an incremental cache.
- `npm test` runs unit and boundary-contract tests.
- `npm run test:db` runs workflow, role-access, personnel and setup SQL suites in isolated PGlite databases. Auth tables are test stubs; these tests do not authenticate against hosted Supabase. Personal setup checks are skipped when the intentionally untracked local SQL file is absent.
- `npm run check` runs all of the above checks in sequence and stops on failure.
- `npm run build` checks production compilation separately.

## Existing React warnings

Eight existing React warnings are temporarily allowed, with a warning ceiling of eight. New files retain the normal recommended rules. Scoped warnings remain visible; do not raise the ceiling to accommodate new violations.

- `demo-provider.tsx`: local-storage hydration in an effect and two render-time ref reads (phase 3).
- `resolution-detail.tsx`, `resolutions.tsx`, `settings.tsx`, `team.tsx`: effect-driven UI state synchronization (phase 4).
- `supabase-workspace-provider.tsx`: the request serial is intentionally advanced during effect cleanup to invalidate outstanding reads; the effect dependency analyzer warns about the mutable ref.

Fix these with focused UI regression coverage during the corresponding refactor, then remove the scoped overrides and reduce the ceiling. Security and type rules are not downgraded.

## API contracts

`workspace-schema.ts` validates all populated collections and nested values. The Supabase read RPC deliberately returns different projections depending on page permissions. The decoder selects the permitted full, summary or selector schema first; invalid full data cannot fall back to a summary.

Only after validation, omitted protected fields are adapted to empty presentation values for the existing screen model. These values are not actual stored data and do not authorize mutations. Raw SQL projections remain redacted and SQL remains authoritative. The normalized API response is validated again in the client. Separating screen models further belongs to phase 3.

`workspace-commands.ts` links each operation to its payload type and validates operation-specific RPC results. The existing input whitelist continues enforcing UUIDs, dates, allowed fields and business input constraints before the typed envelope is produced. Invalid result payloads produce `INVALID_RESPONSE`; uncertain command outcomes keep their idempotency key for safe retries.

Database suites validate actual migration-produced snapshots and command results against these same application contracts. `database.types.ts` remains an explicitly hand-maintained RPC-only database surface, with typed operation names. No remote schema was introspected or represented as generated types. Generated Supabase types can be compared after migration synchronization; JSON-returning RPCs still need the runtime contracts here.

No SQL migration, authorization policy, hosted account or deployment is changed by this work.
