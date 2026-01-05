#!/usr/bin/env bash
set -euo pipefail

PORT=8787

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof not found. Install lsof to stop the server by port."
  exit 1
fi

pids="$(lsof -ti tcp:${PORT} || true)"
if [[ -z "${pids}" ]]; then
  echo "No process is listening on port ${PORT}."
  exit 0
fi

echo "Stopping process(es) on port ${PORT}: ${pids}"
kill ${pids}
