#!/bin/sh
set -eu
. "$(dirname "$0")/_guard.sh"
psql "$PREVIEW_DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT grantee,table_name,privilege_type FROM information_schema.role_table_grants WHERE table_schema='public' AND table_name LIKE 'knowledge_%' ORDER BY 1,2,3; SELECT schemaname,tablename,policyname,roles FROM pg_policies WHERE tablename LIKE 'knowledge_%' ORDER BY 2,3;"
