#!/bin/sh
set -eu
. "$(dirname "$0")/_guard.sh"
[ "${CONFIRM_SECURITY_ROLLBACK:-}" = "APPROVED" ] || { echo "SECURITY_ROLLBACK_APPROVAL_REQUIRED"; exit 2; }
psql "$PREVIEW_DATABASE_URL" -v ON_ERROR_STOP=1 -c "SET app.target_environment='preview'; SET app.phase1a2_rollback_approved='yes';" -f supabase/migrations/20260901090100_urantia_rag_foundation_rollback.sql
