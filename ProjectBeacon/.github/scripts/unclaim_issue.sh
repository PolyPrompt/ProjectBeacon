#!/usr/bin/env bash
set -euo pipefail

ISSUE_NUMBER="${ISSUE_NUMBER:-${1:-}}"
if [[ -z "${ISSUE_NUMBER}" ]]; then
  echo "ISSUE_NUMBER is required" >&2
  exit 1
fi

gh issue edit "${ISSUE_NUMBER}" \
  --add-label "status:ready" \
  --remove-label "status:in-progress"
