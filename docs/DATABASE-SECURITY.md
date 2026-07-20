# Database security — Row Level Security (RLS)

This app uses Supabase Postgres. Supabase exposes a public **Data API**
(PostgREST + GraphQL) for the `public` schema, and by default grants the
`anon` and `authenticated` roles CRUD on every table created by `postgres`.
Because auth here is **Firebase**, not Supabase Auth, no `auth.uid()` policies
were ever written — so without RLS, anyone with the (publishable) anon key had
read/write access to all tables. Migration `0005_enable_rls.sql` closes that.

## The model

- **RLS is enabled on all tables, with _no_ policies** → deny-by-default: the
  `anon`/`authenticated` roles see and change nothing through the Data API.
- **The app is unaffected.** It connects via Drizzle over the transaction
  pooler as the `postgres` project role, which **owns** the tables and bypasses
  RLS. We deliberately do **not** use `FORCE ROW LEVEL SECURITY`.
- **Storage uploads and the two `scripts/backfill-*.ts`** authenticate with the
  **service_role** key, which bypasses RLS and is not revoked. They keep working.
- The migration also **revokes** the `anon`/`authenticated` table/sequence/
  function grants and sets matching default privileges (belt-and-suspenders).

The Data API is intentionally left **enabled** — the backfill scripts call
`/rest/v1` with the service key. Disabling it would require porting those two
scripts to Drizzle first.

## Applying it

Preferred (keeps Drizzle's migration journal in sync), from a network that can
reach port 6543 (not Deloitte office WiFi — tether to a hotspot):

```
pnpm db:migrate
```

Alternative (no local setup, works from any network): paste the contents of
`src/lib/db/migrations/0005_enable_rls.sql` into the Supabase **SQL Editor** and
run it. Every statement is idempotent, so a later `pnpm db:migrate` is a safe
no-op. The `--> statement-breakpoint` lines are SQL comments and are ignored.

## Verify after applying

Run these in the Supabase SQL Editor.

**1. Prove the app role owns the tables and can still read** (guards against the
one catastrophic failure mode: if the pooler connected as a non-owner,
non-BYPASSRLS role, RLS-with-no-policies would silently return zero rows for the
whole app). Also just load the live site and confirm bundles still appear.

```sql
select current_user, (select count(*) from bundles) as bundle_rows;
```

**2. Confirm RLS is on for all 16 tables** (every row should be `true`):

```sql
select relname, relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by relname;
```

**3. Confirm no residual default grants to the API roles under any grantor**
(the migration's `ALTER DEFAULT PRIVILEGES` only covers grantor `postgres`; this
checks whether Supabase left future-object grants under another role such as
`supabase_admin`):

```sql
select pg_get_userbyid(defaclrole) as grantor,
       defaclnamespace::regnamespace as schema,
       defaclobjtype, defaclacl
from pg_default_acl;
```

If any row shows `anon=...` / `authenticated=...` for schema `public` under a
grantor other than `postgres`, add matching
`ALTER DEFAULT PRIVILEGES FOR ROLE <grantor> IN SCHEMA public REVOKE ...` lines.

Finally, run the **Security Advisor** (Dashboard → Advisors) — the
`rls_disabled_in_public` errors should be gone.

## Rollback

Non-destructive; only turns the lock back off. Run in the SQL Editor if the app
unexpectedly shows no data after applying:

```sql
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I disable row level security', t);
  end loop;
end $$;
```

## Convention for new tables

RLS is per-table and manual. Every new table **must** get both:

1. `.enableRLS()` on its `pgTable(...)` in `src/lib/db/schema.ts`, and
2. the resulting `ENABLE ROW LEVEL SECURITY` line in the generated migration
   (`pnpm db:generate`).

Forgetting step 1/2 re-opens the Data API for that table even though the default
privileges cover its grants. Consider a CI check that asserts every `pgTable`
call is followed by `.enableRLS()`.

## Notes / possible future hardening

- Function `EXECUTE` granted to `PUBLIC` is intentionally left in place — the
  only `public` functions are input validators and trigger functions that read
  no table data. A blanket `REVOKE ... ON ALL FUNCTIONS ... FROM PUBLIC` would
  add untestable risk for no data-exposure gain.
- Consider migrating to Supabase's new publishable/secret API keys and disabling
  the legacy JWT anon key. If you do, update `SUPABASE_SERVICE_ROLE_KEY` in
  Vercel and redeploy in the same sitting or screenshot capture silently stops.
