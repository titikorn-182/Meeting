# Quality checks (phases 1–5)

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

Two existing React warnings are temporarily allowed, with a warning ceiling of two. New feature files retain the normal recommended rules. Scoped warnings remain visible; do not raise the ceiling to accommodate new violations.

- `resolutions.tsx`, `settings.tsx`: effect-driven UI state synchronization remains in the listing and settings screens, outside the three detail/personnel screens refactored in phase 4.
- The connected provider's mutable-ref cleanup warning is resolved in phase 5: a session controller owns cancellation and a captured controller instance is stopped during effect cleanup.

Fix these with focused UI regression coverage during the corresponding refactor, then remove the scoped overrides and reduce the ceiling. Security and type rules are not downgraded.

## Auth and workspace lifetime (phase 5)

- `lib/workspace-http.ts` handles JSON/error envelopes, same-origin cookies, no-store requests, and a 30-second timeout combined with caller cancellation.
- `lib/workspace-session.ts` owns the connected loading/ready/error state and typed command execution. `providers/connected/use-workspace-session.ts` subscribes through `useSyncExternalStore` and manages focus, online, visibility and 60-second visible-tab refreshes. Its cleanup cancels requests and removes listeners/timers; Strict Mode restarts are supported.
- A new read cancels the previous read. Starting a command cancels older reads; background refreshes and duplicate commands wait while a write is pending. Request generations also ignore late results from transports that cannot be canceled. Aborting the client wait does **not** roll back a command already executing on the server.
- Idempotency keys survive uncertain write responses within the same session, scoped to account, organization, operation and payload. A confirmed write consumes its key. Logout, access loss, unmount or identity change discards old keys and pending completions. Detached form callbacks cannot issue commands in a later session, even after logging back in as the same person.
- `providers/connected/workspace-actions.ts` maps screen commands to the existing API payloads and row versions. The provider composes the typed context, `workspace-gate.tsx` and `workspace-toasts.tsx`; toast timers are cleaned up. Identity changes remount screen children and clear previous notices/forms.
- Password login and the shared `features/auth/sign-out-form.tsx` use existing server actions for credential/cookie operations, then navigate using the returned safe local path. Browser hints announce session changes to this tab and other same-origin tabs. The hints store only an event name and random nonce, never tokens, email, identity, data or permissions. They invalidate local state; only a fresh authenticated API response can reopen the workspace.
- Logout hides data before the action completes. A missing completion hint has a bounded 30-second pause so later focus/poll refresh can recover. Storage-disabled browsers retain focus/visibility/poll recovery. Callback/verification links continue to exchange codes on the server and benefit from that same revalidation path. Supabase remains responsible for token refresh and cookies; the API still verifies `getUser()` and database membership/RLS on every request.
- Network failures and temporary Auth service/rate-limit errors return a retryable connection error rather than incorrectly reporting an expired session. Missing/rejected sessions remain 401 and remove the cached workspace.
- `npm test` covers cancellation, competing reads/writes, account/organization switches, stale form continuations, auth expiry, stale versions, failed reloads and idempotent retries, plus Auth error classification.
- `npm run test:auth-session-ui` exercises real Next server actions, cookies and proxy refresh against a loopback Auth/RPC double. Start Next with `NEXT_PUBLIC_DATA_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_local_session_test`, `NEXT_PUBLIC_SUPABASE_ORGANIZATION_ID=11111111-1111-4111-8111-111111111111`, and port 3103. The test starts/stops the fake Auth server itself. `AUTH_SESSION_BASE_URL` may select another **local** app URL. The suite checks wrong passwords, safe redirects, token refresh, cross-tab login/logout, account-specific form reset, revoked/expired session handling and recoverable logout failure. It performs no hosted account changes, email sends or database writes; actual Supabase email delivery, verification and production behavior still require deployment checks.

## Feature screens (phase 4)

The existing routes and screen export names remain stable. The three screen entry files now delegate to feature modules:

```text
src/features/
  personnel/
    screen.tsx                 # Tabs and composition
    use-team.ts                # Filters, selection, role-change confirmation
    use-add-personnel.ts       # Form validation and submission
    use-role-permissions.ts    # Draft policy, version reconciliation, save
    members-panel.tsx          # Personnel table and filters
    member-workload.tsx        # Selected person's workload
    add-personnel.tsx
    role-permissions.tsx
    role-change-dialog.tsx
    personnel-model.ts
    team.module.css
  tasks/
    detail-screen.tsx          # Lookup, empty state, keyed detail view
    use-task-detail.ts         # Progress, evidence, work transitions
    task-progress.tsx
    task-evidence.tsx
    task-actions.tsx
    task-assignment.tsx
    task-requirements.tsx
    task-history.tsx
    submit-task-dialog.tsx
    task-status.ts
  resolutions/
    detail-screen.tsx          # Lookup, tabs, keyed detail view
    use-resolution-detail.ts   # Assignment, authorization, closure
    assign-task-form.tsx
    resolution-overview.tsx
    resolution-evidence.tsx
    resolution-history.tsx
    resolution-closure.tsx
    resolution-summary.tsx
```

- Controllers use the shared workspace adapter. UI components receive a typed subset of the controller model using `Pick`; they do not implement database commands or import demo fixtures. `ReturnType` keeps each model in sync with its controller without weakening it to `any`.
- Detail views are keyed by the entity ID, so task/resolution form state belongs to that entity. The resolution route awaits Next.js `searchParams` and supplies `initialAddTask`, removing effect-driven URL initialization and preserving direct assignment links.
- Role-policy drafts reconcile against the authoritative policy version before rendering. External updates discard stale edits with an explanation; the current role stays selected. The existing version check and server authorization remain authoritative.
- The Team stylesheet moved unchanged with its feature. Markup, labels, authorization rules, storage keys, API contracts and SQL remain unchanged.
- `npm run test:detail-ui` uses `WORKSPACE_SMOKE_BASE_URL` (default port 3101) with a demo-mode server. It checks stale policy drafts across tabs, progress, rejected unsafe link protocols, evidence, draft reset during navigation, submission, assignment links and closure criteria. The existing workspace suite covers member creation/roles, restricted page access, own-data scope and review workflows.
- The connected UI suite additionally renders all three features with intercepted API data and checks server-supplied permissions, disabled file upload and unavailable closure. This is connected-adapter coverage, not a test against a live Supabase project.

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
