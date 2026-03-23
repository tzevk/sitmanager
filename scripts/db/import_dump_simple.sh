#!/usr/bin/env bash
set -euo pipefail

# Simple dump import (non-destructive)
# - Does NOT drop tables or delete data
# - Sanitizes the dump to remove DEFINER and DB switching
# - Skips stored routines by default (Node importer cannot run DELIMITER-based procedures)
# - Continues on errors so existing tables/rows don't abort the whole import
#
# Usage:
#   ./scripts/db/import_dump_simple.sh public/database.sql
#
# Requires DB creds in .env.local or environment:
#   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

DUMP_PATH="${1:-public/database.sql}"

if [[ ! -f "$DUMP_PATH" ]]; then
  echo "Dump file not found: $DUMP_PATH" >&2
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required in PATH." >&2
  exit 2
fi

SANITIZED_PATH="${SANITIZED_PATH:-/tmp/sitmanager.database.sanitized.sql}"

# Sanitize: keep table names intact; strip CREATE DATABASE/USE; strip DEFINER; skip routines.
KEEP_DB_STMTS=0 SKIP_ROUTINES=1 ./scripts/db/sanitize_dump.sh "$DUMP_PATH" "$SANITIZED_PATH" >/dev/null

# Import: allow non-empty DB and continue past errors (e.g., tables already exist).
ALLOW_NONEMPTY_DB=1 CONTINUE_ON_ERROR=1 node ./scripts/db/import_dump_node.mjs "$SANITIZED_PATH"

echo "Simple import finished (non-destructive)." >&2
