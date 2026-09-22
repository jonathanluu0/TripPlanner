#!/usr/bin/env bash
# Tests the database WITHOUT Docker: applies the migrations to a throwaway
# database on a plain local Postgres (+ pgTAP), then runs the pgTAP tests.
# With Docker + the Supabase CLI you can instead run:  supabase test db
#
#   PGHOST=localhost PGPORT=5432 PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."

DB=gtp_schema_test
export PGOPTIONS='-c client_min_messages=warning'
PSQL="psql -X -q -v ON_ERROR_STOP=1"

$PSQL -d postgres -c "drop database if exists $DB" -c "create database $DB"
$PSQL -d $DB -f tests/supabase_shim.sql

# Apply every migration in order, then all of them again to prove re-running is safe.
for pass in 1 2; do
  for f in migrations/*.sql; do $PSQL -d $DB -f "$f"; done
done
echo "migrations applied twice without errors"

results=$(for t in tests/database/*.test.sql; do $PSQL -d $DB -t -A -f "$t"; done | sed -E '/^\s*$/d; s/^ //')
echo "$results"
$PSQL -d postgres -c "drop database $DB"

if grep -qE '^(not ok|# Looks like)' <<<"$results"; then
  echo "DATABASE TESTS FAILED"; exit 1
fi
echo "ALL DATABASE TESTS PASSED"
