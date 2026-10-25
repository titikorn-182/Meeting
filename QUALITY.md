# Quality checks (phases 1–3)

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

Five existing React warnings are temporarily allowed, with a warning ceiling of five. New files retain the normal recommended rules. Scoped warnings remain visible; do not raise the ceiling to accommodate new violations.

- `resolution-detail.tsx`, `resolutions.tsx`, `settings.tsx`, `team.tsx`: effect-driven UI state synchronization (phase 4).
- `supabase-workspace-provider.tsx`: the request serial is intentionally advanced during effect cleanup to invalidate outstanding reads; the effect dependency analyzer warns about the mutable ref.

Fix these with focused UI regression coverage during the corresponding refactor, then remove the scoped overrides and reduce the ceiling. Security and type rules are not downgraded.

## API contracts

`workspace-schema.ts` validates all populated collections and nested values. The Supabase read RPC deliberately returns different projections depending on page permissions. The decoder selects the permitted full, summary or selector schema first; invalid full data cannot fall back to a summary.

Only after validation, omitted protected fields are adapted to empty presentation values for the existing screen model. These values are not actual stored data and do not authorize mutations. Raw SQL projections remain redacted and SQL remains authoritative. The normalized API response is validated again in the client. Both adapters share neutral WorkspaceState and WorkspaceSettings names; demo projections supply the same safe empty presentation fields without asserting partial objects as complete types.

`workspace-commands.ts` links each operation to its payload type and validates operation-specific RPC results. The existing input whitelist continues enforcing UUIDs, dates, allowed fields and business input constraints before the typed envelope is produced. Invalid result payloads produce `INVALID_RESPONSE`; uncertain command outcomes keep their idempotency key for safe retries.

Database suites validate actual migration-produced snapshots and command results against these same application contracts. `database.types.ts` remains an explicitly hand-maintained RPC-only database surface, with typed operation names. No remote schema was introspected or represented as generated types. Generated Supabase types can be compared after migration synchronization; JSON-returning RPCs still need the runtime contracts here.

No SQL migration, authorization policy, hosted account or deployment is changed by this work.

## Adapter boundary (phase 3)

- Shared screens consume useWorkspace from components/workspace-context.tsx. WorkspaceProvider in providers/ selects the adapter explicitly. Supabase errors never fall back to demo data.
- Demo fixtures, persistence, persona permissions, local display numbering and the demo provider live under src/demo/. Its provider is dynamically imported only in demo mode, with SSR disabled because its initial state comes from browser storage. The production adapter does not read demo storage or load its JavaScript chunk.
- Existing polubu-ui-demo-v1 and polubu-ui-demo-access-v1 keys remain compatible. Storage is read and validated before the first demo render. Invalid state cannot discard otherwise valid policies. Render-time permissions use the React state snapshot; event handlers read the latest access reference.
- WorkflowRole describes secretary/owner/reviewer/executive duties; AccessRole controls admin/user/executive/staff page access. Existing wire and persisted role fields remain unchanged.
- Shared date and metric helpers require an explicit reference day, and deadline approval requires an explicit timestamp. Fixed demo dates and display years are confined to the demo adapter and its tests.
- Settings receives defaultSettings from its adapter instead of importing fixtures. The reset control remains demo-only; connected settings continue coming from the API.
- npm test includes storage compatibility, redaction, explicit-clock and production import-boundary regressions. The demo provider's three React warnings are resolved and their lint overrides removed.
- npm run test:workspace-ui exercises demo workflows against WORKSPACE_SMOKE_BASE_URL. npm run test:connected-ui exercises the Supabase adapter against CONNECTED_SMOKE_BASE_URL with intercepted workspace responses and no real account or database mutation. Run its app server with NEXT_PUBLIC_DATA_MODE=supabase, a test Supabase URL and public key. This checks connected reads/writes, error handling, absence of demo storage access and unloaded demo JavaScript.
