from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import RefineRequest, RefineResponse, HealthCheckResponse
from app.services import RAGService, LLMService, VectorService
from app.config import get_settings
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("uvicorn")

app = FastAPI(title="JIRA Requirement Assistant API")

# CORS (Allow extension to call)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict to Extension ID
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency Injection
def get_rag_service():
    return RAGService()

def get_llm_service():
    return LLMService()

@app.on_event("startup")
async def startup_event():
    # Preload Embedding Model
    logger.info("Server starting... preloading resources.")
    VectorService.get_model()

@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    settings = get_settings()
    # Check Qdrant connectivity
    qdrant_status = "unknown"
    try:
        from qdrant_client import QdrantClient
        client = QdrantClient(url=settings.QDRANT_URL)
        collections = client.get_collections()
        qdrant_status = "connected"
    except Exception as e:
        qdrant_status = f"error: {str(e)}"

    return {
        "status": "ok",
        "services": {
            "qdrant": qdrant_status,
            "llm": "ready"
        }
    }

@app.post("/api/v1/refine", response_model=RefineResponse)
async def refine_description(
    request: RefineRequest,
    rag_service: RAGService = Depends(get_rag_service),
    llm_service: LLMService = Depends(get_llm_service)
):
    logger.info(f"Refining request for issue: {request.summary}")
    
    # 1. Retrieve Context
    query = f"{request.summary} {request.current_description}"
    if request.selected_references is not None:
        references = request.selected_references
    else:
        references = rag_service.search_context(
            query,
            component_team=request.component_team,
            component_name=request.component_name,
            restrict_to_team=request.restrict_to_team
        )
    
    # 2. Call LLM
    refined_text = await llm_service.refine_description(request, references)
    
    return {
        "original_text": request.current_description,
        "refined_content": refined_text,
        "references": references
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
