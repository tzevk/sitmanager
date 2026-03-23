#!/usr/bin/env bash
set -euo pipefail

if [[ "${ENSURE_TABLES_CONFIRM:-}" != "YES" ]]; then
  echo "Refusing to run: set ENSURE_TABLES_CONFIRM=YES"
  exit 2
fi

node ./scripts/db/ensure_tables_from_routes_node.mjs
