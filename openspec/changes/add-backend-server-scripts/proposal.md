# Change: Add backend server start/stop scripts

## Why
Make it easy to start and stop the backend server consistently during development.

## What Changes
- Add start/stop shell scripts to run the backend with `uvicorn main:app --reload` on port 8787.
- Stop script identifies the running process by port 8787 and terminates it.

## Impact
- Affected specs: manage-backend-server (new)
- Affected code: scripts/start-backend.sh, scripts/stop-backend.sh
