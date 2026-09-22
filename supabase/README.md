# Database (Supabase)

Standard Supabase CLI layout. **`schemas/` describes what the database should look
like; `migrations/` are the steps that get it there.**

```
supabase/
  config.toml          CLI settings; schema_paths lists schemas/ in dependency order
  schemas/             Source of truth, one file per thing (table + its policies + grants)
    functions/           is_trip_participant, create_trip, join_trip, claim_member
    tables/              trips, trip_participants, trip_entities
    realtime.sql         live updates for trip_entities
  migrations/          Timestamped changes, applied in order. Never edit one after it's pushed.
  tests/
    database/            pgTAP security tests (who can see and change what)
    run.sh               Runs those tests on plain Postgres, no Docker needed
  seed.sql             Sample data for local development (empty for now)
```

## Data model

| Table | Holds |
|---|---|
| `trips` | One row per trip + its invite code |
| `trip_participants` | Which signed-in guests are in which trip, and the name each claimed |
| `trip_entities` | The trip's contents: one JSON row per member, car, sleeping spot, receipt |

Guests (anonymous sign-in) can only see and edit trips they've joined. Joining,
creating and claiming a name go through `join_trip`, `create_trip`, `claim_member`.
Receipt photos live in the private `receipts` storage bucket at `<trip id>/<receipt id>.jpg`.

## Applying it to your Supabase project

**Option A: Supabase CLI (recommended)**
```bash
npx supabase login
npx supabase link --project-ref <your project ref>   # the "xxxx" in https://xxxx.supabase.co
npx supabase db push                                 # applies any migrations not yet applied
```

**Option B: SQL Editor.** Paste each file in `migrations/` in filename order and run it.
(The CLI then won't know they were applied; stick to one option.)

## Making a change later

1. Edit or add a file in `schemas/` (add new files to `schema_paths` in `config.toml`).
2. Generate the migration: `npx supabase db schema declarative sync`
   (needs Docker Desktop, because it compares against a local database). Without Docker,
   write the migration by hand in `migrations/` with a new timestamp.
3. Run the tests (below), then `npx supabase db push`.

Storage buckets can't be expressed in `schemas/`; add those as hand-written migrations.

## Tests

```bash
npx supabase test db                                      # with Docker (local Supabase)
PGHOST=localhost PGUSER=postgres ./supabase/tests/run.sh  # without Docker (plain Postgres + pgTAP)
```
