#!/bin/sh
set -eu
. "$(dirname "$0")/_guard.sh"
psql "$PREVIEW_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260901090000_urantia_rag_foundation.sql
