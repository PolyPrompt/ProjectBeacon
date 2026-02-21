#!/usr/bin/env bash
set -euo pipefail

AGENT_LABEL="${AGENT_LABEL:-${1:-}}"
if [[ -z "${AGENT_LABEL}" ]]; then
  echo "AGENT_LABEL is required" >&2
  exit 1
fi
SKIP_IN_PROGRESS_CHECK="${SKIP_IN_PROGRESS_CHECK:-false}"

emit_output() {
  local key="$1"
  local value="$2"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    echo "${key}=${value}" >> "$GITHUB_OUTPUT"
  else
    echo "${key}=${value}"
  fi
}

# Legacy output for workflow compatibility.
emit_output "HAS_IN_PROGRESS" "false"

mapfile -t candidate_numbers < <(gh issue list \
  --state open \
  --label "${AGENT_LABEL}" \
  --label "status:ready" \
  --limit 100 \
  --json number \
  --jq '.[].number')

for issue_number in "${candidate_numbers[@]:-}"; do
  [[ -z "${issue_number}" ]] && continue

  # Skip issues that already have an open PR linked via Fixes #<issue>.
  open_pr_count="$(gh pr list \
    --state open \
    --search "\"Fixes #${issue_number}\"" \
    --json number \
    --jq 'length')"
  if [[ "${open_pr_count}" != "0" ]]; then
    continue
  fi

  issue_body="$(gh issue view "${issue_number}" --json body --jq '.body // ""')"

  deps_line="$(printf '%s\n' "${issue_body}" | sed -nE 's/^deps:[[:space:]]*(.*)$/\1/p' | head -n1 || true)"
  deps_ok="true"

  if [[ -n "${deps_line}" ]]; then
    mapfile -t deps < <(printf '%s\n' "${deps_line}" | grep -oE '#[0-9]+' | tr -d '#')
    for dep in "${deps[@]:-}"; do
      [[ -z "${dep}" ]] && continue
      dep_state="$(gh issue view "${dep}" --json state --jq '.state' 2>/dev/null || echo "MISSING")"
      if [[ "${dep_state}" != "CLOSED" ]]; then
        deps_ok="false"
        break
      fi
    done
  fi

  if [[ "${deps_ok}" == "true" ]]; then
    emit_output "ISSUE_NUMBER" "${issue_number}"
    exit 0
  fi
done

emit_output "ISSUE_NUMBER" ""
