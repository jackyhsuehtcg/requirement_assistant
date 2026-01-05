## 1. Implementation
- [x] 1.1 Add extension options page UI to edit the API base URL and register it in the manifest.
- [x] 1.2 Persist the base URL in Chrome storage with default `http://10.80.1.49:8787`.
- [x] 1.3 Update `extension/src/content.js` to read the stored base URL and call `${baseUrl}/api/v1/refine`.
- [x] 1.4 Add a test connection button that reports detailed failure reasons.
- [ ] 1.5 Validate manually: default loads on first open, saved value persists, API requests use the new base URL, test connection reports success and failure details.
