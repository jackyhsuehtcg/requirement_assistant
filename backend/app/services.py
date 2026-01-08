import logging
import re
from typing import Dict, List, Optional, get_args
from openai import AsyncOpenAI, APIConnectionError, RateLimitError, APIStatusError
from FlagEmbedding import FlagModel
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from app.config import get_settings, PromptConfig
from app.schemas import RefineRequest, RetrievedReference

logger = logging.getLogger("uvicorn")
settings = get_settings()

LANGUAGE_CONFIG = {
    "zh-TW": {
        "language_instruction": "Traditional Chinese (繁體中文)",
        "menu_header": "Menu（功能路徑）",
        "user_story_header": "User Story Narrative（使用者故事敘述）",
        "criteria_header": "Criteria",
        "technical_header": "Technical Specifications（技術規格）",
        "acceptance_header": "Acceptance Criteria（驗收標準）",
        "questions_header": "Developer Questions（開發者提問）",
        # QA Headers
        "env_header": "Environment（環境資訊）",
        "steps_header": "Steps to Reproduce（重現步驟）",
        "actual_header": "Actual Result（錯誤結果）",
        "expected_header": "Expected Result（預期結果）",
        "probability_header": "Occurrence Probability（發生機率）"
    },
    "zh-CN": {
        "language_instruction": "Simplified Chinese (简体中文)",
        "menu_header": "Menu（功能路径）",
        "user_story_header": "User Story Narrative（用户故事叙述）",
        "criteria_header": "Criteria",
        "technical_header": "Technical Specifications（技术规格）",
        "acceptance_header": "Acceptance Criteria（验收标准）",
        "questions_header": "Developer Questions（开发者提问）",
        # QA Headers
        "env_header": "Environment（环境信息）",
        "steps_header": "Steps to Reproduce（重现步骤）",
        "actual_header": "Actual Result（实际结果）",
        "expected_header": "Expected Result（预期结果）",
        "probability_header": "Occurrence Probability（发生机率）"
    },
    "en": {
        "language_instruction": "English",
        "menu_header": "Menu",
        "user_story_header": "User Story Narrative",
        "criteria_header": "Criteria",
        "technical_header": "Technical Specifications",
        "acceptance_header": "Acceptance Criteria",
        "questions_header": "Developer Questions",
        # QA Headers
        "env_header": "Environment",
        "steps_header": "Steps to Reproduce",
        "actual_header": "Actual Result",
        "expected_header": "Expected Result",
        "probability_header": "Occurrence Probability"
    }
}

def resolve_language_config(output_language: str) -> Dict[str, str]:
    return LANGUAGE_CONFIG.get(output_language, LANGUAGE_CONFIG["zh-TW"])

class VectorService:
    _model = None

    @classmethod
    def get_model(cls):
        if cls._model is None:
            logger.info("Loading Embedding Model: BAAI/bge-m3...")
            cls._model = FlagModel('BAAI/bge-m3', use_fp16=True) 
            logger.info("Embedding Model loaded.")
        return cls._model

    @classmethod
    def embed_query(cls, text: str) -> List[float]:
        model = cls.get_model()
        return model.encode(text).tolist()

class RAGService:
    def __init__(self):
        self.client = QdrantClient(url=settings.QDRANT_URL)
        self.vector_service = VectorService()

    def _build_min_should_value(self, count: int, field_info, conditions):
        field_type = getattr(field_info, "annotation", None) or getattr(field_info, "type_", None)
        if field_type is int:
            return count, False
        if field_type is not None:
            args = get_args(field_type) or ()
            if int in args:
                return count, False

        min_should_cls = getattr(qdrant_models, "MinShould", None)
        if not min_should_cls:
            return count, False

        min_should_fields = (
            getattr(min_should_cls, "model_fields", None)
            or getattr(min_should_cls, "__fields__", None)
        )
        candidate_fields = []
        conditions_field = None
        if min_should_fields:
            for name in ("conditions", "condition"):
                if name in min_should_fields:
                    conditions_field = name
                    break
            for name in ("min_count", "count", "value"):
                if name in min_should_fields:
                    candidate_fields.append(name)
            if not candidate_fields:
                candidate_fields = [next(iter(min_should_fields.keys()))]
        else:
            candidate_fields = ["min_count", "count", "value"]

        if conditions_field:
            min_count_field = candidate_fields[0] if candidate_fields else "min_count"
            payload = {conditions_field: conditions or [], min_count_field: count}
            try:
                return min_should_cls(**payload), True
            except Exception:
                return payload, True

        for name in candidate_fields:
            try:
                return min_should_cls(**{name: count}), False
            except Exception:
                continue

        return ({candidate_fields[0]: count} if candidate_fields else {"min_count": count}), False

    def _derive_component_team(self, component_name: Optional[str]) -> str:
        if not component_name:
            return ""
        primary = component_name.split(",")[0].strip()
        if not primary:
            return ""
        letters_only = re.sub(r"[^A-Za-z]", "", primary)
        if len(letters_only) >= 3:
            return letters_only[:3].upper()
        return primary[:3].upper()

    def _build_team_filter(self, team: str) -> Optional[qdrant_models.Filter]:
        if not team:
            return None
        should_conditions = [
            qdrant_models.FieldCondition(
                key="team_name",
                match=qdrant_models.MatchValue(value=team)
            ),
            qdrant_models.FieldCondition(
                key="component_team",
                match=qdrant_models.MatchValue(value=team)
            )
        ]
        filter_kwargs = {"should": should_conditions}
        filter_fields = getattr(qdrant_models.Filter, "model_fields", None) or getattr(qdrant_models.Filter, "__fields__", None)
        if filter_fields and "min_should" in filter_fields:
            min_should_value, uses_conditions = self._build_min_should_value(
                1,
                filter_fields["min_should"],
                should_conditions
            )
            filter_kwargs["min_should"] = min_should_value
            if uses_conditions:
                filter_kwargs.pop("should", None)
        return qdrant_models.Filter(**filter_kwargs)

    def _compute_limits(self, total_limit: int) -> Dict[str, int]:
        weights = {
            "jira": 2,
            "test": 2,
            "usm": 1
        }
        weight_sum = sum(weights.values())
        unit = max(total_limit // weight_sum, 0)
        limits = {key: value * unit for key, value in weights.items()}
        remainder = total_limit - sum(limits.values())
        for key in ("jira", "test", "usm"):
            if remainder <= 0:
                break
            limits[key] += 1
            remainder -= 1
        return limits

    def _extract_text_section(self, text: str, patterns: List[str]) -> str:
        if not text:
            return ""
        for pattern in patterns:
            match = re.search(pattern, text, flags=re.IGNORECASE | re.DOTALL)
            if match:
                return match.group(1).strip()
        return ""

    def _build_jira_content(self, payload: dict) -> str:
        jira_key = payload.get("jira_ticket") or payload.get("issue_key") or payload.get("jira_key")
        title = payload.get("summary") or payload.get("title")
        component = payload.get("component") or payload.get("component_name")
        description = (
            payload.get("description")
            or payload.get("desc")
            or self._extract_text_section(
                payload.get("text", ""),
                [
                    r"(?:描述|Description|Desc)\s*[:：]\s*(.*)",
                ]
            )
        )
        acceptance_criteria = (
            payload.get("acceptance_criteria")
            or payload.get("ac")
            or self._extract_text_section(
                payload.get("text", ""),
                [
                    r"(?:AC|Acceptance\s*Criteria)\s*[:：]\s*(.*)",
                ]
            )
        )
        text_fallback = payload.get("text", "")
        if not description and text_fallback:
            description = text_fallback

        content_parts = [
            f"JIRA: {jira_key}",
            f"Summary: {title}",
        ]
        if component:
            content_parts.append(f"Component: {component}")
        if description:
            content_parts.append(f"Desc: {description}")
        if acceptance_criteria:
            content_parts.append(f"AC: {acceptance_criteria}")
        return "\n".join(content_parts)

    def _search_collection(
        self,
        collection_name: str,
        vector: List[float],
        limit: int,
        team_hint: str,
        label: str,
        restrict_to_team: bool
    ):
        if limit <= 0:
            return []

        team_filter = self._build_team_filter(team_hint)
        if not team_filter:
            try:
                return self.client.search(
                    collection_name=collection_name,
                    query_vector=vector,
                    limit=limit
                )
            except Exception as e:
                logger.error(f"Qdrant {label} search failed: {e}")
                return []

        if restrict_to_team:
            try:
                return self.client.search(
                    collection_name=collection_name,
                    query_vector=vector,
                    limit=limit,
                    query_filter=team_filter
                )
            except Exception as e:
                logger.error(f"Qdrant {label} team search failed: {e}")
                return []

        hits = []
        seen_ids = set()
        try:
            hits = self.client.search(
                collection_name=collection_name,
                query_vector=vector,
                limit=limit,
                query_filter=team_filter
            )
            seen_ids = {hit.id for hit in hits}
        except Exception as e:
            logger.error(f"Qdrant {label} team search failed: {e}")
            hits = []

        if len(hits) < limit:
            try:
                more_hits = self.client.search(
                    collection_name=collection_name,
                    query_vector=vector,
                    limit=limit - len(hits)
                )
                for hit in more_hits:
                    if hit.id not in seen_ids:
                        hits.append(hit)
                        seen_ids.add(hit.id)
            except Exception as e:
                logger.error(f"Qdrant {label} fallback search failed: {e}")

        return hits

    def search_context(
        self,
        query_text: str,
        total_limit: int = 15,
        component_team: Optional[str] = None,
        component_name: Optional[str] = None,
        restrict_to_team: bool = True
    ) -> List[RetrievedReference]:
        vector = self.vector_service.embed_query(query_text)
        results = []

        team_hint = (component_team or "").strip().upper()
        if not team_hint:
            team_hint = self._derive_component_team(component_name)

        limits = self._compute_limits(total_limit)

        usm_hits = self._search_collection(
            collection_name=settings.QDRANT_COLLECTION_USM,
            vector=vector,
            limit=limits["usm"],
            team_hint=team_hint,
            label="USM",
            restrict_to_team=restrict_to_team
        )
        for hit in usm_hits:
            payload = hit.payload
            content = f"Story: {payload.get('title')}\nDesc: {payload.get('description')}\nI want: {payload.get('i_want')}"
            results.append(RetrievedReference(
                source_type="usm_node",
                title=payload.get("title", "Unknown Story"),
                content_excerpt=content,
                relevance_score=hit.score
            ))

        test_hits = self._search_collection(
            collection_name=settings.QDRANT_COLLECTION_TEST,
            vector=vector,
            limit=limits["test"],
            team_hint=team_hint,
            label="Test Case",
            restrict_to_team=restrict_to_team
        )
        for hit in test_hits:
            payload = hit.payload
            content = f"TestCase: {payload.get('title')}\nPre: {payload.get('precondition')}\nSteps: {payload.get('steps')}"
            results.append(RetrievedReference(
                source_type="test_case",
                title=payload.get("title", "Unknown Test Case"),
                content_excerpt=content,
                relevance_score=hit.score
            ))

        jira_hits = self._search_collection(
            collection_name=settings.QDRANT_COLLECTION_JIRA,
            vector=vector,
            limit=limits["jira"],
            team_hint=team_hint,
            label="JIRA",
            restrict_to_team=restrict_to_team
        )
        for hit in jira_hits:
            payload = hit.payload
            content = self._build_jira_content(payload)
            results.append(RetrievedReference(
                source_type="jira_reference",
                title=payload.get("summary") or payload.get("title") or "Unknown JIRA",
                content_excerpt=content,
                relevance_score=hit.score
            ))

        results.sort(key=lambda x: x.relevance_score, reverse=True)
        return results

class LLMService:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER.lower()
        self.model = settings.LLM_MODEL
        
        logger.info(f"LLM Service initialized. Provider: {self.provider}, Model: {self.model}")

        # Default Config (OpenAI Compatible)
        api_key = "dummy"
        base_url = None
        self.extra_headers = {}

        if self.provider == "lmstudio":
            base_url = settings.LM_STUDIO_URL
            api_key = "lm-studio"
        elif self.provider == "openrouter":
            base_url = "https://openrouter.ai/api/v1"
            api_key = settings.OPENROUTER_API_KEY
            self.extra_headers = {
                "HTTP-Referer": "https://github.com/hideman/requirement_assistant",
                "X-Title": "JIRA Requirement Assistant",
            }
        else:
            logger.warning(f"Unknown LLM provider '{self.provider}'. Defaulting to OpenRouter.")
            base_url = "https://openrouter.ai/api/v1"
            api_key = settings.OPENROUTER_API_KEY

        # Initialize OpenAI Client (Single instance is better for connection pooling, 
        # but here we init per request or per service lifecycle depending on DI scope.
        # FastAPI Depends() defaults to request scope, but we can cache it.)
        self.client = AsyncOpenAI(
            base_url=base_url,
            api_key=api_key
        )

    async def refine_description(self, request: RefineRequest, context_refs: List[RetrievedReference]) -> str:
        # Format context
        context_str = ""
        for ref in context_refs:
            context_str += f"[{ref.source_type.upper()}] {ref.title}:\n{ref.content_excerpt}\n---\n"
        
        if not context_str:
            context_str = "No specific references found. Rely on general best practices."

        lang_config = resolve_language_config(request.output_language)
        
        # Decide prompt based on issue type
        issue_type_lower = (request.issue_type or "").lower()
        if "bug" in issue_type_lower:
            prompt_config = PromptConfig.get("qa")
        else:
            prompt_config = PromptConfig.get("pm")
        
        # Fallback if config is missing (safety check)
        if not prompt_config:
            logger.warning("Prompt configuration not found, falling back to default PM prompt.")
            # Depending on how logic evolved, if 'pm' key missing in yaml, this might fail.
            # But we just overwrote yaml with both keys.
            prompt_config = PromptConfig.get("pm") or {}

        system_prompt_raw = prompt_config.get("system_prompt", "")
        # Apply strict formatting only if prompt exists
        system_prompt = system_prompt_raw.format(**lang_config) if system_prompt_raw else ""
        
        user_template = prompt_config.get("user_prompt_template", "")
        
        user_prompt = user_template.format(
            issue_type=request.issue_type,
            summary=request.summary,
            context=context_str,
            draft=request.current_description,
            output_language=lang_config["language_instruction"]
        )

        try:
            completion = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,
                extra_headers=self.extra_headers,
                # max_tokens=2048 # Optional: Add constraint if needed
            )
            return completion.choices[0].message.content

        except RateLimitError:
            return "Error: Rate limit exceeded (429). Please try again later."
        except APIConnectionError as e:
            logger.error(f"Connection error: {e}")
            return "Error: Could not connect to LLM provider."
        except APIStatusError as e:
            logger.error(f"API Error {e.status_code}: {e.message}")
            return f"Error: Provider returned {e.status_code}"
