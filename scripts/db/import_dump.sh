#!/usr/bin/env bash
set -euo pipefail

# Imports a MySQL dump into a target database safely.
# - Sanitizes dump to remove DEFINER clauses (prevents import errors)
# - Uses env vars (or .env.local) for DB credentials
#
# Usage:
#   ./scripts/db/import_dump.sh public/database.sql
#
# Env vars (recommended):
#   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
#
# Notes:
# - This script does NOT rename tables.
# - By default the sanitization step strips `CREATE DATABASE` / `USE` statements from the dump,
#   so the import always lands in DB_NAME (selected via the mysql client).
# - If you need to keep DB statements, set KEEP_DB_STMTS=1.
# - If you need to rewrite DB statements, set KEEP_DB_STMTS=1 REWRITE_DB_NAME=1 TARGET_DB=<name>.

# If your local mysql client cannot authenticate (e.g. macOS + MySQL 9.x lacking mysql_native_password),
# you can import via Node.js using mysql2:
#   USE_NODE_IMPORT=1 ./scripts/db/import_dump.sh public/database.sql

DUMP_PATH="${1:-public/database.sql}"

if [[ ! -f "$DUMP_PATH" ]]; then
  echo "Dump file not found: $DUMP_PATH" >&2
  exit 2
fi

USE_DOCKER_MYSQL="${USE_DOCKER_MYSQL:-0}"
MYSQL_DOCKER_IMAGE="${MYSQL_DOCKER_IMAGE:-mysql:8.0}"
USE_NODE_IMPORT="${USE_NODE_IMPORT:-0}"

if [[ "$USE_NODE_IMPORT" == "1" ]]; then
  if ! command -v node >/dev/null 2>&1; then
    echo "USE_NODE_IMPORT=1 but node is not available in PATH." >&2
    exit 2
  fi
elif [[ "$USE_DOCKER_MYSQL" == "1" ]]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo "USE_DOCKER_MYSQL=1 but docker is not available in PATH." >&2
    exit 2
  fi
else
  if ! command -v mysql >/dev/null 2>&1; then
    echo "mysql client not found in PATH." >&2
    echo "Install MySQL client or rerun with USE_NODE_IMPORT=1." >&2
    exit 2
  fi
fi

# Load .env.local if present (without printing secrets)
if [[ -f .env.local ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env.local | grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)=' | xargs -0 2>/dev/null || true)
  # fallback for macOS where xargs -0 may not work with plain text
  if [[ -z "${DB_HOST:-}" ]]; then
    while IFS='=' read -r k v; do
      case "$k" in
        DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME) export "$k"="$v" ;;
      esac
    done < <(grep -v '^#' .env.local | grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)=')
  fi
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_NAME="${DB_NAME:-}"

if [[ -z "$DB_NAME" ]]; then
  echo "DB_NAME is required (target database name)." >&2
  exit 2
fi

SANITIZED_PATH="${SANITIZED_PATH:-/tmp/sitmanager.database.sanitized.sql}"

# Sanitization: strip DEFINER, strip DB statements by default; optionally keep/rewrite CREATE DATABASE/USE.
KEEP_DB_STMTS="${KEEP_DB_STMTS:-0}"
SKIP_ROUTINES="${SKIP_ROUTINES:-1}"
REWRITE_DB_NAME="${REWRITE_DB_NAME:-0}"
TARGET_DB="${TARGET_DB:-$DB_NAME}"

if [[ "$REWRITE_DB_NAME" == "1" ]]; then
  KEEP_DB_STMTS="$KEEP_DB_STMTS" SKIP_ROUTINES="$SKIP_ROUTINES" REWRITE_DB_NAME=1 TARGET_DB="$TARGET_DB" ./scripts/db/sanitize_dump.sh "$DUMP_PATH" "$SANITIZED_PATH" >/dev/null
else
  KEEP_DB_STMTS="$KEEP_DB_STMTS" SKIP_ROUTINES="$SKIP_ROUTINES" ./scripts/db/sanitize_dump.sh "$DUMP_PATH" "$SANITIZED_PATH" >/dev/null
fi

echo "Importing into database: $DB_NAME" >&2

if [[ "$USE_NODE_IMPORT" == "1" ]]; then
  node ./scripts/db/import_dump_node.mjs "$SANITIZED_PATH"
elif [[ "$USE_DOCKER_MYSQL" == "1" ]]; then
  # Run a compatible mysql client via Docker (useful on macOS with MySQL 9.x client,
  # which may lack the mysql_native_password plugin).
  # Avoid leaking passwords into process list: use MYSQL_PWD env.
  docker run --rm -i \
    -e MYSQL_PWD="$DB_PASSWORD" \
    "$MYSQL_DOCKER_IMAGE" \
    mysql \
      --protocol=tcp \
      --host="$DB_HOST" \
      --port="$DB_PORT" \
      --user="$DB_USER" \
      --database="$DB_NAME" \
      --default-character-set=utf8mb4 \
      --max-allowed-packet=1G \
      < "$SANITIZED_PATH"
else
  # Avoid leaking passwords into process list: use MYSQL_PWD env.
  # (Still treat it as sensitive; don't commit.)
  MYSQL_PWD="$DB_PASSWORD" \
  mysql \
    --protocol=tcp \
    --host="$DB_HOST" \
    --port="$DB_PORT" \
    --user="$DB_USER" \
    --database="$DB_NAME" \
    --default-character-set=utf8mb4 \
    --max-allowed-packet=1G \
    < "$SANITIZED_PATH"
fi

echo "Import complete." >&2
