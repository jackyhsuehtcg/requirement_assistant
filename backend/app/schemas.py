from pydantic import BaseModel
from typing import List, Optional, Literal

class RetrievedReference(BaseModel):
    source_type: Literal["usm_node", "test_case", "jira_reference"]
    title: str
    content_excerpt: str
    relevance_score: float

class RefineRequest(BaseModel):
    current_description: str
    issue_type: str = "Story"
    summary: str
    project_key: str = "PROJ"
    issue_key: Optional[str] = None
    component_name: Optional[str] = None
    component_team: Optional[str] = None
    restrict_to_team: bool = True
    output_language: Literal["zh-TW", "zh-CN", "en"] = "zh-TW"
    selected_references: Optional[List[RetrievedReference]] = None

class RefineResponse(BaseModel):
    original_text: str
    refined_content: str
    references: List[RetrievedReference]

class HealthCheckResponse(BaseModel):
    status: str
    services: dict
