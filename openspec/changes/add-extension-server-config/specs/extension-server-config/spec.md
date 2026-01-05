## ADDED Requirements
### Requirement: Extension server base URL configuration
The extension SHALL provide an options page that lets the user view and edit the backend API base URL. The extension SHALL persist the configured base URL between browser sessions. The default value SHALL be `http://10.80.1.49:8787`.

#### Scenario: Default base URL on first open
- **WHEN** the user opens the extension options page with no prior settings
- **THEN** the base URL field shows `http://10.80.1.49:8787`

#### Scenario: Persisted base URL
- **WHEN** the user saves a new base URL
- **THEN** the options page shows that value on the next open

### Requirement: Use configured base URL for requests
The extension SHALL send API requests to `${baseUrl}/api/v1/refine` using the configured base URL.

#### Scenario: Updated base URL used for API requests
- **WHEN** the user updates the base URL
- **THEN** subsequent API requests target the updated base URL

### Requirement: Test backend connection
The extension SHALL provide a test connection action on the options page that calls `${baseUrl}/health` and reports the result. The UI SHALL display detailed failure reasons, including network errors, HTTP status, or invalid response content.

#### Scenario: Successful connection test
- **WHEN** the user runs the test connection action and the health endpoint responds with HTTP 200 and `status: ok`
- **THEN** the options page shows a success message

#### Scenario: Failed connection test
- **WHEN** the test connection action encounters a network error, non-2xx response, or invalid health response
- **THEN** the options page shows a failure message with the reason details
