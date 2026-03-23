#!/usr/bin/env bash
set -euo pipefail

# Sanitizes a MySQL dump for safer import on another server.
# - Strips DEFINER clauses (common cause of import failures when the definer user doesn't exist)
# - Optionally rewrites the DB name used by CREATE DATABASE / USE (disabled by default)
#
# Usage:
#   ./scripts/db/sanitize_dump.sh public/database.sql /tmp/database.sanitized.sql
#   TARGET_DB=abhishek_sit ./scripts/db/sanitize_dump.sh public/database.sql /tmp/database.sanitized.sql
#   REWRITE_DB_NAME=1 TARGET_DB=sit ./scripts/db/sanitize_dump.sh public/database.sql /tmp/database.sanitized.sql
#   KEEP_DB_STMTS=1 ./scripts/db/sanitize_dump.sh public/database.sql /tmp/database.sanitized.sql
#   SKIP_ROUTINES=1 ./scripts/db/sanitize_dump.sh public/database.sql /tmp/database.sanitized.sql

IN_PATH="${1:-}"
OUT_PATH="${2:-}"

if [[ -z "$IN_PATH" || -z "$OUT_PATH" ]]; then
  echo "Usage: $0 <input.sql> <output.sql>" >&2
  exit 2
fi

if [[ ! -f "$IN_PATH" ]]; then
  echo "Input dump not found: $IN_PATH" >&2
  exit 2
fi

TARGET_DB="${TARGET_DB:-}"          # only used when REWRITE_DB_NAME=1
REWRITE_DB_NAME="${REWRITE_DB_NAME:-0}"
KEEP_DB_STMTS="${KEEP_DB_STMTS:-0}"
SKIP_ROUTINES="${SKIP_ROUTINES:-0}"

# 1) Strip definers + force invoker security when present.
#    NOTE: This does NOT rename any tables.
perl -pe '
  s/CREATE\s+DEFINER=`[^`]*`@`[^`]*`\s+/CREATE /gi;
  s/\bDEFINER=`[^`]*`@`[^`]*`\s+//gi;
  s/SQL\s+SECURITY\s+DEFINER/SQL SECURITY INVOKER/gi;
' "$IN_PATH" > "$OUT_PATH"

# 1b) Strip CREATE DATABASE / USE statements by default.
#     This prevents the dump from switching databases mid-import and ensures tables are created
#     in the database explicitly selected by the mysql client.
if [[ "$KEEP_DB_STMTS" != "1" ]]; then
  tmp_out="$OUT_PATH.tmp"
  # Remove only top-level DB selection statements; do not touch table names.
  perl -ne '
    next if /^\s*CREATE\s+DATABASE\b/i;
    next if /^\s*DROP\s+DATABASE\b/i;
    next if /^\s*USE\s+`[^`]+`\s*;\s*$/i;
    print;
  ' "$OUT_PATH" > "$tmp_out"
  mv "$tmp_out" "$OUT_PATH"
fi

# 1c) Optionally remove stored routines / triggers / views / events.
#     This is useful when importing into a DB that already has these objects.
if [[ "$SKIP_ROUTINES" == "1" ]]; then
  tmp_out="$OUT_PATH.tmp"
  perl -ne '
    our $in_delim;
    our $delim_token;
    BEGIN { $in_delim = 0; $delim_token = ""; }

    # When SKIP_ROUTINES=1, drop ALL custom-delimiter blocks and delimiter directives.
    # This reliably removes PROCEDURE/FUNCTION/TRIGGER/EVENT definitions which are not safe
    # to import with a simple statement-splitting importer.

    if (!$in_delim) {
      if (/^\s*DELIMITER\s+(\S+)\s*$/i) {
        my $tok = $1;
        # If delimiter is being reset to semicolon, just drop the directive.
        next if $tok eq ";";

        # Start dropping everything until the delimiter is reset.
        $in_delim = 1;
        $delim_token = $tok;
        next;
      }

      # Drop any stray DELIMITER directives.
      next if /^\s*DELIMITER\b/i;

      print;
      next;
    }

    # We are inside a custom delimiter block; keep dropping until reset.
    if (/^\s*DELIMITER\s+;\s*$/i) {
      $in_delim = 0;
      $delim_token = "";
    }
    next;
  ' "$OUT_PATH" > "$tmp_out"
  mv "$tmp_out" "$OUT_PATH"

  # Some dumps may emit routines without explicit DELIMITER blocks.
  # Remove those blocks as well (procedures/functions/triggers/events) to keep the output
  # safe for simple statement splitters.
  tmp_out="$OUT_PATH.tmp"
  perl -ne '
    our $skipping;
    BEGIN { $skipping = 0; }

    if (!$skipping) {
      # Drop explicit drops for these objects too.
      next if /^\s*DROP\s+(?:PROCEDURE|FUNCTION|TRIGGER|EVENT)\b/i;

      if (/^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:DEFINER=`[^`]*`@`[^`]*`\s+)?\s*(PROCEDURE|FUNCTION|TRIGGER|EVENT)\b/i) {
        $skipping = 1;
        next;
      }

      print;
      next;
    }

    # Inside a routine-ish block: skip until an END terminator.
    if (/^\s*END\s*;;\s*$/i || /^\s*END\s*;\s*$/i) {
      $skipping = 0;
    }
    next;
  ' "$OUT_PATH" > "$tmp_out"
  mv "$tmp_out" "$OUT_PATH"
fi
# 2) Optionally rewrite the database name used by CREATE DATABASE / USE.
#    This is OFF by default to respect the dump DB name.
if [[ "$REWRITE_DB_NAME" == "1" ]]; then
  if [[ -z "$TARGET_DB" ]]; then
    echo "REWRITE_DB_NAME=1 requires TARGET_DB to be set" >&2
    exit 2
  fi

  if [[ "$KEEP_DB_STMTS" != "1" ]]; then
    echo "REWRITE_DB_NAME=1 requires KEEP_DB_STMTS=1 (since DB statements are stripped by default)" >&2
    exit 2
  fi
  tmp_out="$OUT_PATH.tmp"
  perl -pe '
    my $db = $ENV{TARGET_DB};
    s/^CREATE DATABASE IF NOT EXISTS\s+`[^`]+`/CREATE DATABASE IF NOT EXISTS `$db`/i;
    s/^USE\s+`[^`]+`/USE `$db`/i;
  ' "$OUT_PATH" > "$tmp_out"
  mv "$tmp_out" "$OUT_PATH"
fi

echo "Wrote sanitized dump: $OUT_PATH" >&2
