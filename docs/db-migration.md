# Database Migration (Dump Import)

This repo includes a MySQL dump at `public/database.sql`.

## Important

- The dump contains `CREATE DATABASE ...` and `USE ...` for a database named `abhishek_sit`.
- The dump also contains stored routines with `DEFINER=...` which often fail to import on other servers.
- The scripts below **do not rename any tables**.
- By default, the scripts **strip `CREATE DATABASE` / `USE` statements** from the dump so the import always lands in your target `DB_NAME`.

## 1) Configure target DB connection

Set these in `.env.local` (recommended) or export them in your shell:

- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

## 2) Sanitize the dump (recommended)

This removes `DEFINER` clauses and sets `SQL SECURITY INVOKER` where needed:

```bash
./scripts/db/sanitize_dump.sh public/database.sql /tmp/database.sanitized.sql
```

### If you want to keep `CREATE DATABASE` / `USE` from the dump

```bash
KEEP_DB_STMTS=1 ./scripts/db/sanitize_dump.sh public/database.sql /tmp/database.sanitized.sql
```

## 3) Import into the target database

```bash
./scripts/db/import_dump.sh public/database.sql
```

### Simple non-destructive import (no deletes)

If you want a script that **does not drop anything** and just attempts to import the dump as-is into your current `DB_NAME`:

```bash
./scripts/db/import_dump_simple.sh public/database.sql
```

Important: if the target DB already contains some of the same tables/rows, MySQL will raise errors like “table exists” or “duplicate key”. This script is configured to **continue past those errors** and import whatever it can without deleting anything.

### Destructive reset (drop everything)

If you want to wipe the target database completely (drop **all** tables/views/routines/events), run:

```bash
DROP_ALL_CONFIRM=YES ./scripts/db/drop_all_objects.sh
```

This is irreversible.

By default, the import sanitization step runs with `SKIP_ROUTINES=1` to avoid conflicts like
`PROCEDURE ... already exists` when importing into an existing DB.

### Import without Docker and without `mysql` CLI

If your local `mysql` client fails (e.g. missing `mysql_native_password` plugin) and you don’t want to use Docker, use the Node-based importer:

```bash
USE_NODE_IMPORT=1 ./scripts/db/import_dump.sh public/database.sql
```

### If your local `mysql` client fails to authenticate (macOS + MySQL 9.x)

If you see an error like `Authentication plugin 'mysql_native_password' cannot be loaded`, rerun using a MySQL 8 client via Docker:

```bash
USE_DOCKER_MYSQL=1 ./scripts/db/import_dump.sh public/database.sql
```

### If you must import into a different DB name

If you intentionally want the dump to manage DB selection (i.e. keep `CREATE DATABASE`/`USE`) and your target database name differs from the dump’s DB name, you can rewrite **only** those statements:

```bash
KEEP_DB_STMTS=1 REWRITE_DB_NAME=1 TARGET_DB=<your_target_db_name> ./scripts/db/import_dump.sh public/database.sql
```

This does **not** rename tables.

## 4) Post-import checks

Suggested manual checks:

- Confirm you imported into the correct DB: `SELECT DATABASE();`
- Count tables: `SHOW TABLES;`
- Spot-check key tables used by the app (e.g. `course_mst`, `batch_mst`, etc.)

## Security note

A full DB dump in `public/` will be publicly accessible if the app is deployed as-is.
Before deploying, move the dump out of `public/` and keep it out of git history if it contains real data.
