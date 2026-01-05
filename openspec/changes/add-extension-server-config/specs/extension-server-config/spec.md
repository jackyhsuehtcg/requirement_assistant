## ADDED Requirements
### Requirement: Extension server base URL configuration
The extension SHALL provide an options page that lets the user view and edit the backend API base URL. The extension SHALL persist the configured base URL between browser sessions. The default value SHALL be `http://10.80.1.49:8000`.

#### Scenario: Default base URL on first open
- **WHEN** the user opens the extension options page with no prior settings
- **THEN** the base URL field shows `http://10.80.1.49:8000`

#### Scenario: Persisted base URL
- **WHEN** the user saves a new base URL
- **THEN** the options page shows that value on the next open

### Requirement: Use configured base URL for requests
The extension SHALL send API requests to `${baseUrl}/api/v1/refine` using the configured base URL.

#### Scenario: Updated base URL used for API requests
- **WHEN** the user updates the base URL
- **THEN** subsequent API requests target the updated base URL
