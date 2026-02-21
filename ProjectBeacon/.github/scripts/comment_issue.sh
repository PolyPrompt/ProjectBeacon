#!/usr/bin/env bash
set -euo pipefail

ISSUE_NUMBER="${ISSUE_NUMBER:-${1:-}}"
MESSAGE="${MESSAGE:-${2:-}}"
if [[ -z "${ISSUE_NUMBER}" ]]; then
  echo "ISSUE_NUMBER is required" >&2
  exit 1
fi
if [[ -z "${MESSAGE}" ]]; then
  echo "MESSAGE is required" >&2
  exit 1
fi

gh issue comment "${ISSUE_NUMBER}" --body "${MESSAGE}"
