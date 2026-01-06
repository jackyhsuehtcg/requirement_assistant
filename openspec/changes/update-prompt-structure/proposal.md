# Change: Update requirement prompt structure and reference handling

## Why
The current prompt does not enforce the requested section order or a Technical
Specifications section, and it needs stronger guidance to fully cover the
user's original requirements before adding conservative augmentations. It also
needs tighter instructions to prevent mismatched reference/link descriptions.

## What Changes
- Enforce the output section order: Menu -> User Story Narrative -> Criteria ->
  Technical Specifications -> Acceptance Criteria.
- Add a Technical Specifications（技術規格） section to the prompt template.
- Strengthen guidance to cover user requirements first, then add conservative
  augmentations only after coverage is complete.
- Tighten reference/link handling to avoid unrelated link text or purpose labels,
  allowing link text corrections when explicitly marked.

## Impact
- Affected specs: requirement-output-format (new capability)
- Affected code: backend/prompts.yaml, backend/app/services.py
