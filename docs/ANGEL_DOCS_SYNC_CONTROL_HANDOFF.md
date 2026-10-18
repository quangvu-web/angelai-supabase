# Angel → Docs sync controls: remaining integration

## Verified from Docs source

Read-only snapshot of FUN Ecosystem Hub, commit `a380c5aa`, inspected on 2026-10-17.

- `src/routes/api/public/sync-angel.ts` has only a POST cron callback. It authenticates using Docs public project keys, skips disabled or not-yet-due runs, and records the trigger as `cron`. It is not an authorized Angel admin “run now” or status API. Angel must not reuse a key from the snapshot to bypass partner permissions.
- `src/lib/sync.server.ts` implements `runAngelSync` and persists results in `sync_runs`. Docs owns both `sync_settings` and run history.
- No Docs sync MCP or matching runtime connector was available in the accessible catalogue/connections.
- A snapshot cannot be edited to deploy changes in Docs. No Docs private database records or hosted scheduler settings were read.

## Required work in the Docs project

1. Add a server-to-server authenticated control endpoint with narrowly scoped permission to trigger Angel-library sync and read its schedule/run history. Do not use a publishable key as the privileged control credential; keep the credential server-only and grant it specifically to Angel.
2. For a manual run, call `runAngelSync({ trigger: "manual" })` without the cron due-time gate; explicitly define behavior when automatic sync is disabled. Prevent concurrent manual/automatic runs and duplicate execution with a run identifier/idempotency key.
3. Return the persisted run ID and read that run back from `sync_runs`. Expose running/success/error, started/finished timestamps and imported/updated/skipped/failed counts. Do not return credentials or raw internal error traces.
4. Expose the authoritative enabled/frequency settings and last/next run timestamps. Only provide a next-run timestamp when it is supported by scheduler telemetry; do not derive a claimed verified schedule from the user's report.
5. Verify export completeness and exact canonical-folder mapping before granting the new execution path; see `KNOWLEDGE_NORMALIZATION_AUDIT.md`.

## Work in Angel after the endpoint exists

1. Connect the scoped credential using the supported runtime connector or server-side secrets flow.
2. Add an admin-only Edge Function proxy: validate the Angel session and protected user role before any partner call. Allow only the fixed Docs target and explicitly permitted status/run actions.
3. Replace `partnerControlConnected: false` with a server-verified availability state, not a hardcoded `true`. Wire the existing button to the proxy, disable it while running, and fetch persisted results and schedule status.
4. Verify in authenticated Angel UI with the four uploaded documents. Compare source identity/URLs, not titles alone; duplicate titles do not guarantee +4 imports.

## Current shipped scope and rollback

Angel Preview has a disabled “Sync now” control, explicit connection status, reported-versus-verified daily schedule wording, and a link to Docs admin. It does not issue a partner request or change the scheduler. Execution and live results remain blocked on the Docs control endpoint. No backend/secret/schema changes or Publish were performed. Rollback is limited to the Angel status component/policy, translations, and accompanying tests.