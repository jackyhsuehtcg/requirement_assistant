# Development Todo List

## Phase 1: Project Setup & Documentation
- [x] Create directory structure (`backend/`, `extension/`, `docs/`)
- [x] Define API Specification (`docs/api_spec.md`)
- [x] Create initial Prompt Template (`backend/prompts.yaml`)
- [x] Create `.gitignore` and `README.md`

## Phase 2: Backend Development (FastAPI + RAG)
### Environment & Dependencies
- [x] Create `backend/requirements.txt` (FastAPI, Uvicorn, Qdrant-client, FlagEmbedding, httpx, python-dotenv, pyyaml)
- [x] Create `backend/.env.example`
- [x] Setup virtual environment and install dependencies (User action required)

### Core Services
- [x] Implement `ConfigService` to load `.env` and `prompts.yaml`
- [x] Implement `VectorService` (Embedding generation with `bge-m3`)
- [x] Implement `RAGService` (Qdrant connection & search logic)
- [x] Implement `LLMService` (OpenRouter API client with Grok 4 Fast)

### API Implementation
- [x] Create Pydantic models for Request/Response (`schemas.py`)
- [x] Implement `POST /api/v1/refine` endpoint
- [x] Implement `GET /health` endpoint
- [x] Add basic logging and error handling

### Testing (Backend)
- [x] Unit test: Vector generation (Mock model if heavy)
- [x] Integration test: RAG retrieval (Connect to local Qdrant)
- [x] Integration test: LLM output format

## Phase 3: Frontend Development (Chrome Extension)
### Configuration & Manifest
- [ ] Create `extension/manifest.json` (V3, permissions: activeTab, storage, scripting)
- [ ] Setup assets (icons, placeholders)

### Content Scripts (JIRA Interaction)
- [ ] Implement `dom_observer.js` (MutationObserver for JIRA v9.12)
- [ ] Implement `injector.js` (Inject Floating Action Button)
- [ ] Implement text scraping logic (Get current description)
- [ ] Implement text insertion logic (Replace description)

### UI Components (Shadow DOM)
- [ ] Implement `preview_modal.html` & `preview_modal.css`
- [ ] Implement `ui_manager.js` (Handle open/close, loading state)
- [ ] Implement markdown rendering (Simple converter or lightweight lib)

### API Integration
- [ ] Implement `api_client.js` (Fetch logic to Python Backend)
- [ ] Connect UI events to API calls

## Phase 4: Integration & Polish
- [ ] End-to-End Test: Edit JIRA Description -> Refine -> Preview -> Insert
- [ ] Prompt Engineering: Tune `prompts.yaml` for better output quality
- [ ] UI Polish: Ensure styles don't conflict with JIRA
- [ ] Documentation: Update `README.md` with setup instructions
