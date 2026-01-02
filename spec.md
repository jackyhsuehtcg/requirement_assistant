# Project Specification: JIRA Requirement Assistant

## 1. Overview
A Chrome Extension paired with a Python Backend to assist Product Managers in refining JIRA issue descriptions. It utilizes RAG (Retrieval-Augmented Generation) to fetch relevant User Stories and Test Cases from a Qdrant vector database, ensuring consistency and completeness in requirements using BDD format.

## 2. Technology Stack

### 2.1 Backend (API Server)
*   **Language:** Python 3.10+
*   **Web Framework:** **FastAPI** (Async, Auto-documentation)
*   **Server:** Uvicorn
*   **HTTP Client:** `httpx` (Async client for calling OpenRouter)
*   **Configuration Management:**
    *   Environment Variables (`.env`) for secrets (API Keys, DB URLs).
    *   YAML (`prompts.yaml`) for prompt templates.

### 2.2 AI & Data (RAG Pipeline)
*   **LLM Provider:** **OpenRouter**
    *   **Model:** Grok 4 Fast (Targeting low latency & precision)
    *   **Settings:** Temperature ~0.1 (High determinism)
*   **Vector Database:** **Qdrant**
    *   **Endpoint:** Configurable (Default: `http://localhost:6333`)
    *   **Collections:** `usm_nodes` (User Story Map), `test_cases` (BDD Scenarios), `jira_references` (JIRA History)
    *   **Vector Config:** Size 1024, Distance Cosine.
*   **Embedding Model:**
    *   **Model Name:** `BAAI/bge-m3`
    *   **Library:** `FlagEmbedding` (or `sentence-transformers`)
    *   **Mode:** Dense Vector (1024 dimensions) to match existing Qdrant indices.

### 2.3 Frontend (Chrome Extension)
*   **Manifest Version:** V3
*   **Core Logic:** Vanilla JavaScript (ES6+)
    *   *Rationale:* To keep the extension lightweight and avoid complex build steps for simple DOM manipulation.
*   **DOM Interaction:**
    *   **Target:** JIRA Server v9.12.24
    *   **Detection Strategy:** `MutationObserver` (Passive monitoring) to detect when the Description editor renders.
    *   **Component:** Floating Action Button (FAB) injected into the editor toolbar or container.
*   **UI/UX:**
    *   **Preview Modal:** HTML/CSS injected via Shadow DOM (to isolate styles from JIRA).
    *   **Interaction:** Direct text editing in the modal before insertion.

## 3. Architecture & Data Flow

1.  **User Action:** User types draft description in JIRA -> Clicks Floating Button.
2.  **Extension:** Scrapes draft text -> POST `/api/v1/refine` to Backend.
3.  **Backend (RAG):**
    *   Embeds draft text using `bge-m3`.
    *   Queries Qdrant (`usm_nodes`, `test_cases`, `jira_references`) for relevant context.
4.  **Backend (LLM):**
    *   Constructs prompt with: Draft + Retrieved Context + `prompts.yaml` Template.
    *   Calls OpenRouter (Grok 4 Fast).
5.  **Response:** Returns formatted Markdown (User Story + AC + Tech Specs).
6.  **Extension:** Displays Preview Modal -> User edits -> Inserts back into JIRA.

## 4. Development Environment
*   **Local Backend:** `http://localhost:8000`
*   **Local Qdrant:** `http://localhost:6333`
*   **Security:**
    *   Internal Network Deployment.
    *   No API Token authentication required for the internal API Service.
    *   OpenRouter API Key stored securely in Backend `.env`.

## 5. Artifacts
*   `prompts.yaml`: Hot-reloadable prompt templates.
*   `qdrant_schema.md`: Reference for vector DB payload structure.
*   `api_spec.md`: Detailed API interface definition.
