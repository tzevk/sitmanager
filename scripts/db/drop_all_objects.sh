#!/usr/bin/env bash
set -euo pipefail

# Drop ALL tables/views/routines/events from the target DB in .env.local.
# This is destructive and irreversible.

if ! command -v node >/dev/null 2>&1; then
  echo "node is required in PATH." >&2
  exit 2
fi

DROP_ALL_CONFIRM=${DROP_ALL_CONFIRM:-}
if [[ "$DROP_ALL_CONFIRM" != "YES" ]]; then
  echo "Refusing to run without DROP_ALL_CONFIRM=YES" >&2
  exit 2
fi

node ./scripts/db/drop_all_objects_node.mjs
