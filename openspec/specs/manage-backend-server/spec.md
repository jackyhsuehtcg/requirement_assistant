# manage-backend-server Specification

## Purpose
TBD - created by archiving change add-backend-server-scripts. Update Purpose after archive.
## Requirements
### Requirement: Backend server start/stop scripts
The system SHALL provide shell scripts to start and stop the backend server using `uvicorn main:app --reload` on port 8787. The stop script SHALL identify the running process by port 8787 and terminate it.

#### Scenario: Start backend server
- **WHEN** a user runs the start script
- **THEN** the backend server starts with `uvicorn main:app --reload` on port 8787

#### Scenario: Stop backend server
- **WHEN** a user runs the stop script
- **THEN** the process listening on port 8787 is terminated

