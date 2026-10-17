#!/usr/bin/env bash
# Build first: a failed type check must never serve stale application code.
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  printf 'Usage: ./serve.sh [port]\nPrecompute roots, build TypeScript, and serve on localhost. Defaults to port 8000, or the next free port.\nRequires Node.js, npm, uv, and npm install.\n'
  exit 0
fi
if (( $# > 1 )); then
  printf 'Usage: ./serve.sh [port]\n' >&2
  exit 2
fi
site_port="${1:-8000}"
if [[ ! "$site_port" =~ ^[0-9]{1,5}$ ]] || (( 10#$site_port < 1 || 10#$site_port > 65535 )); then
  printf 'Port must be an integer from 1 to 65535.\n' >&2
  exit 2
fi
site_port=$((10#$site_port))
for required_command in node npm uv; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    printf 'Missing %s. Activate your Node.js environment and install uv before retrying.\n' "$required_command" >&2
    exit 1
  fi
done
if [[ ! -f node_modules/typescript/bin/tsc ]]; then
  printf 'Dependencies are missing. Run npm install first.\n' >&2
  exit 1
fi
npm run build
if (( $# == 0 )); then
  exec uv run --locked python scripts/serve.py "$site_port" --fallback
fi
exec uv run --locked python scripts/serve.py "$site_port"
