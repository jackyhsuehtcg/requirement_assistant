#!/usr/bin/env bash
set -euo pipefail

PORT=8787
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

if ! command -v uvicorn >/dev/null 2>&1; then
  echo "uvicorn not found. Activate your virtualenv and install backend/requirements.txt."
  exit 1
fi

if command -v lsof >/dev/null 2>&1; then
  if lsof -ti tcp:${PORT} >/dev/null 2>&1; then
    echo "Port ${PORT} is already in use. Stop it first."
    exit 1
  fi
fi

cd "${BACKEND_DIR}"
exec uvicorn main:app --reload --port "${PORT}"
