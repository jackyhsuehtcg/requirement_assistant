# Project Context

## Purpose
JIRA Requirement Assistant: a Chrome extension plus a FastAPI backend that helps PMs refine JIRA issue descriptions into structured BDD-style requirements (user story narrative + acceptance criteria) using RAG over past JIRA context, user story maps, and test cases.

## Tech Stack
- Backend: Python 3.10+, FastAPI, Uvicorn, Pydantic, httpx, pydantic-settings, python-dotenv
- RAG/AI: OpenRouter (via OpenAI SDK), Qdrant, FlagEmbedding (BAAI/bge-m3), torch, PyYAML
- Frontend: Chrome Extension (Manifest V3), vanilla JavaScript (ES6), CSS
- Config: .env for secrets, prompts.yaml for LLM prompt templates

## Project Conventions

### Code Style
- No formatter/linter config in repo; keep style consistent with existing files.
- Python: keep modules in backend/app, use Pydantic models for schemas, and use uvicorn logger.
- Extension: vanilla JS and direct DOM manipulation; avoid framework/build steps.

### Architecture Patterns
- FastAPI app with dependency injection for services (RAGService, LLMService, VectorService).
- RAG pipeline: embed -> Qdrant retrieval -> prompt assembly -> LLM generation.
- Prompts stored in prompts.yaml and loaded via PromptConfig.
- Extension uses MutationObserver to detect JIRA description module, injects a floating action button and modal UI.

### Testing Strategy
- No automated test suite detected; current validation is manual plus backend/test_llm.py for LLM connectivity checks.

### Git Workflow
- Not documented in repo. Default assumption: feature branches + PRs, no history rewrites on main. Please confirm or update.

## Domain Context
- Target UI: JIRA Server v9.12.24.
- Output format: BDD-style markdown with user story narrative and acceptance criteria.
- Retrieval sources: Qdrant collections usm_nodes, test_cases, jira_references (see qdrant_schema.md).
- Output languages: zh-TW, zh-CN, en.

## Important Constraints
- Internal network deployment; API currently has no auth.
- Requires Qdrant reachable at QDRANT_URL (default http://localhost:6333).
- LLM API key stored in .env; external network dependency for OpenRouter.
- Embedding model BAAI/bge-m3 loads at startup and is resource intensive.

## External Dependencies
- OpenRouter (LLM API) or LM Studio (local fallback).
- Qdrant vector database.
- BAAI/bge-m3 embedding model via FlagEmbedding/torch.
- JIRA web UI (extension target).
