#!/usr/bin/env bash
set -euo pipefail

if [[ "${FIX_EXAM_TAKEN_CONFIRM:-}" != "YES" ]]; then
  echo "Refusing to run: set FIX_EXAM_TAKEN_CONFIRM=YES"
  exit 2
fi

node ./scripts/db/fix_s_exam_taken_master_pk_node.mjs
