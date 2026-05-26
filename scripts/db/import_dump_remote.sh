#!/usr/bin/env bash
set -euo pipefail

# Import a local SQL dump into a remote server over SSH.
#
# What it does:
# - sanitizes the dump using the existing helper
# - rewrites MySQL 8 collations to MariaDB-safe utf8mb4_unicode_ci
# - strips DEFINER / DB-switching statements via sanitize_dump.sh
# - uploads the sanitized dump to the remote server
# - creates the target database if missing
# - imports the dump using the remote mysql client
#
# Usage:
#   ./scripts/db/import_dump_remote.sh /path/to/dump.sql [target_db]
#
# Examples:
#   ./scripts/db/import_dump_remote.sh ./sit_2026-05-25_14-34-13.sql sit
#   REMOTE_MYSQL_CMD='mysql -uroot' ./scripts/db/import_dump_remote.sh ./sit_2026-05-25_14-34-13.sql database3
#   REMOTE_MYSQL_CMD='mysql -uadmin -p' ./scripts/db/import_dump_remote.sh ./sit_2026-05-25_14-34-13.sql sit
#
# Notes:
# - SSH password is NOT embedded here. ssh/scp will prompt interactively.
# - If remote mysql root uses socket auth, the default REMOTE_MYSQL_CMD="mysql" is often enough.
# - If the remote server needs explicit DB credentials, set REMOTE_MYSQL_CMD before running.

DUMP_PATH="${1:-}"
TARGET_DB="${2:-sit}"

if [[ -z "$DUMP_PATH" ]]; then
  echo "Usage: $0 <dump.sql> [target_db]" >&2
  exit 2
fi

if [[ ! -f "$DUMP_PATH" ]]; then
  echo "Dump file not found: $DUMP_PATH" >&2
  exit 2
fi

if ! command -v ssh >/dev/null 2>&1; then
  echo "ssh is required in PATH." >&2
  exit 2
fi

if ! command -v scp >/dev/null 2>&1; then
  echo "scp is required in PATH." >&2
  exit 2
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

REMOTE_HOST="${REMOTE_HOST:-94.103.163.250}"
REMOTE_PORT="${REMOTE_PORT:-222250}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_MYSQL_CMD="${REMOTE_MYSQL_CMD:-mysql}"

if ! [[ "$REMOTE_PORT" =~ ^[0-9]+$ ]] || (( REMOTE_PORT < 1 || REMOTE_PORT > 65535 )); then
  echo "Invalid REMOTE_PORT: $REMOTE_PORT" >&2
  echo "SSH ports must be between 1 and 65535." >&2
  echo "Example: REMOTE_PORT=22 REMOTE_HOST=$REMOTE_HOST REMOTE_USER=$REMOTE_USER $0 $DUMP_PATH $TARGET_DB" >&2
  exit 2
fi

base_name="$(basename "$DUMP_PATH")"
name_root="${base_name%.sql}"
LOCAL_SANITIZED="${SANITIZED_PATH:-/tmp/${name_root}.remote.sanitized.sql}"
REMOTE_SANITIZED="/tmp/${name_root}.remote.sanitized.sql"

echo "Sanitizing dump locally..." >&2
KEEP_DB_STMTS=0 SKIP_ROUTINES="${SKIP_ROUTINES:-0}" "$SCRIPT_DIR/sanitize_dump.sh" "$DUMP_PATH" "$LOCAL_SANITIZED" >/dev/null

# Rewrite MySQL 8 collations that commonly fail on MariaDB / older MySQL.
perl -0pi -e 's/utf8mb4_0900_ai_ci/utf8mb4_unicode_ci/g; s/utf8mb4_0900_bin/utf8mb4_bin/g;' "$LOCAL_SANITIZED"

echo "Uploading sanitized dump to ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SANITIZED} ..." >&2
scp -P "$REMOTE_PORT" "$LOCAL_SANITIZED" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SANITIZED}"

echo "Creating database ${TARGET_DB} on remote server if it does not exist..." >&2
ssh -p "$REMOTE_PORT" "${REMOTE_USER}@${REMOTE_HOST}" \
  "${REMOTE_MYSQL_CMD} -e \"CREATE DATABASE IF NOT EXISTS \\\`${TARGET_DB}\\\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\""

echo "Importing dump into ${TARGET_DB} on remote server..." >&2
ssh -p "$REMOTE_PORT" "${REMOTE_USER}@${REMOTE_HOST}" \
  "${REMOTE_MYSQL_CMD} --default-character-set=utf8mb4 ${TARGET_DB} < ${REMOTE_SANITIZED}"

echo "Cleaning up remote sanitized dump..." >&2
ssh -p "$REMOTE_PORT" "${REMOTE_USER}@${REMOTE_HOST}" "rm -f ${REMOTE_SANITIZED}"

echo "Remote import complete." >&2
echo "Target server: ${REMOTE_HOST}:${REMOTE_PORT}" >&2
echo "Target database: ${TARGET_DB}" >&2