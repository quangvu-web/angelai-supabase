#!/bin/sh
set -eu
: "${PREVIEW_SUPABASE_PROJECT_REF:?Set PREVIEW_SUPABASE_PROJECT_REF from the preview project settings}"
: "${PREVIEW_DATABASE_URL:?Load PREVIEW_DATABASE_URL through the secret manager}"
[ "${CONFIRM_PREVIEW:-}" = "I_UNDERSTAND_PREVIEW_ONLY" ] || { echo "PREVIEW_CONFIRMATION_REQUIRED"; exit 2; }
[ "$PREVIEW_SUPABASE_PROJECT_REF" != "ssjoetiitctqzapymtzl" ] || { echo "PRODUCTION_PROJECT_REF_REJECTED"; exit 2; }
case "$PREVIEW_DATABASE_URL" in *"$PREVIEW_SUPABASE_PROJECT_REF"*) ;; *) echo "PROJECT_REF_URL_MISMATCH"; exit 2;; esac
