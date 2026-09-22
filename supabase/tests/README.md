# Database tests

- `database/*.test.sql` are **pgTAP** tests (Supabase's standard). `rls.test.sql` simulates a
  host, a friend who joins with the invite code, and an outsider, and checks who can
  see and change what (29 checks).
- `run.sh` runs them **without Docker**: it applies `../migrations/` twice (to prove
  they're safe to re-run) to a throwaway database on a plain local Postgres with pgTAP.
- `supabase_shim.sql` gives that plain Postgres the few things Supabase already has
  (sign-in roles, `auth.uid()`, storage tables, realtime). **Never run it on Supabase.**

```bash
npx supabase test db                                      # with Docker
PGHOST=localhost PGUSER=postgres ./supabase/tests/run.sh  # without Docker
```

The last line is `ALL DATABASE TESTS PASSED`, and the script exits non-zero on any failure.
