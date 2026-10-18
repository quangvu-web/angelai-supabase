# Urantia Phase 1A.2 preview verification

Use a dedicated Supabase preview project. Never reuse the production ref `ssjoetiitctqzapymtzl`.

Load `PREVIEW_DATABASE_URL`, `PREVIEW_ANON_KEY`, test-user JWTs, and `PREVIEW_SERVICE_ROLE_KEY` only through the CI/hosting secret manager; never paste them into chat, source, logs, or committed `.env` files. Set `PREVIEW_SUPABASE_PROJECT_REF` and `CONFIRM_PREVIEW=I_UNDERSTAND_PREVIEW_ONLY`.

Run `scripts/preview/apply-migration.sh` twice to prove rerunnability, then `scripts/preview/verify-security.sh`. Run the Deno role matrix for anonymous, authenticated non-admin, admin, and service-role access. Test synthetic staging, rejected activation, successful activation, concurrent activation, and data/version rollback through the RPC. Do not ingest copyrighted corpus.

Security rollback is distinct from version rollback. Only after explicit approval set `CONFIRM_SECURITY_ROLLBACK=APPROVED` and run `scripts/preview/rollback-security.sh`. It preserves all schema/data and does not make the bucket public.

