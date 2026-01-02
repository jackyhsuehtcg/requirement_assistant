# API Specification

## Base URL
`http://localhost:8000`

## Endpoints

### 1. Refine Description
**URL:** `/api/v1/refine`
**Method:** `POST`
**Description:** Refines the provided JIRA description using RAG (User Story Map + Test Cases + JIRA References) and LLM.

**Request Header:**
`Content-Type: application/json`

**Request Body:**
```json
{
  "current_description": "User wants to login with google.",
  "issue_type": "Story",
  "summary": "Implement Google Login",
  "project_key": "PROJ",
  "issue_key": "PROJ-123", // Optional
  "component_name": "TAD TAC UI", // Optional
  "component_team": "TAD", // Optional
  "restrict_to_team": true, // Optional
  "output_language": "zh-TW", // Optional: zh-TW | zh-CN | en
  "selected_references": [ // Optional: use provided refs only
    {
      "source_type": "jira_reference",
      "title": "Login with Google OAuth",
      "content_excerpt": "JIRA: PROJ-88\nSummary: ...\nDesc: ...\nAC: ...",
      "relevance_score": 0.82
    }
  ]
}
```

**Response Body:**
```json
{
  "original_text": "User wants to login with google.",
  "refined_content": "## User Story\nAs a **Guest User**,\nI want to **Login with my Google Account**,\nSo that **I can access the system quickly without creating a new password**.\n\n## Acceptance Criteria\n...",
  "references": [
    {
      "source_type": "usm_node",
      "title": "Member Login Flow",
      "content_excerpt": "..."
    },
    {
      "source_type": "test_case",
      "title": "TC-Login-001: Google OAuth Success",
      "content_excerpt": "Given user is on login page..."
    },
    {
      "source_type": "jira_reference",
      "title": "Login with Google OAuth",
      "content_excerpt": "JIRA: PROJ-88\nSummary: ...\nDesc: ...\nAC: ..."
    }
  ]
}
```

**Error Response (500):**
```json
{
  "detail": "Failed to connect to Qdrant service."
}
```

---


### 2. Health Check
**URL:** `/health`
**Method:** `GET`
**Description:** Checks if the backend and dependencies (Qdrant) are reachable.

**Response Body:**
```json
{
  "status": "ok",
  "services": {
    "qdrant": "connected",
    "llm": "ready"
  }
}
```
