# Change: Add extension server configuration page

## Why
Users need to change the backend API base URL without editing source code, especially outside localhost.

## What Changes
- Add a Chrome extension options page to view and edit the backend API base URL (default `http://10.80.1.49:8000`).
- Persist the base URL and use it to build the `/api/v1/refine` endpoint for requests.
- Update the extension manifest to register the options page.

## Impact
- Affected specs: extension-server-config (new)
- Affected code: extension/manifest.json, extension/src/content.js, new options page files
