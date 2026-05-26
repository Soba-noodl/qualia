# Analytics queries — operator-emails workflow

Every query in this folder filters out operator + early-tester traffic via an `excluded_emails` CTE at the top:

```sql
WITH excluded_emails AS (
  SELECT unnest(ARRAY[
    '<your-operator-email>',
    ...
  ]::text[]) AS email
),
```

The committed queries use **placeholder values** so the repo doesn't leak operator PII. Before running, you need to substitute your real list.

## Setup (one-time)

1. Copy the example file to a local one:
   ```bash
   cp docs/analytics/queries/_operator_emails.example.sql \
      docs/analytics/queries/_operator_emails.local.sql
   ```
2. Edit `_operator_emails.local.sql` and fill in your real operator + early-user emails.
3. The `.local.sql` file is gitignored — it will never leave your machine.

## Running a query

Three workflows, pick whichever fits your tooling:

### A. Manual paste (Supabase SQL editor, ad-hoc)

Open the query, open `_operator_emails.local.sql`, copy the array contents, paste over the placeholder list in the query's `excluded_emails` CTE, run.

### B. Shell substitution (psql)

```bash
# Substitute the placeholder list with the real one before running:
sed -e "/^WITH excluded_emails AS (/,/^),/{ \
  /SELECT unnest(ARRAY\[/,/]::text\[\]) AS email/{ \
    /<your-operator-email>/d; /<additional-operator-email>/d; \
    /<early-user-email-/d; \
    /SELECT unnest(ARRAY\[/r docs/analytics/queries/_operator_emails.local.sql \
  } \
}" docs/analytics/queries/module2_user_activity.sql | psql "$DATABASE_URL"
```

(A small wrapper script under `scripts/` can do this nicely if you run analytics often.)

### C. Just maintain a personal fork of each query

Easiest for daily ops: keep your own copy of frequently-run queries in a separate gitignored folder (e.g. `docs/analytics/queries/_my-runtime/`) with the real emails baked in. Re-sync from the placeholder versions whenever they change upstream.

## Why this pattern

Two competing goals:
- **OSS-publishable:** no real emails leak via git history.
- **Daily operability:** the queries need to actually filter operator data when *you* run them.

The placeholder-in-source + gitignored local file pattern satisfies both. Fork maintainers see clear instructions, your daily ops just need one extra step (substitute or paste) per run.
