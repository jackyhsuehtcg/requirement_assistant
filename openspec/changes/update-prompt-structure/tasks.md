## 1. Implementation
- [x] Update the system prompt in `backend/prompts.yaml` to enforce coverage-first
  refinement, the new section order, and reference/link alignment.
- [x] Add a Technical Specifications（技術規格） header to the language config
  in `backend/app/services.py` and update the prompt format to include it.
- [x] Define the Technical Specifications section content rules in the prompt
  template (sourced only from the draft or reference context, and allow empty).
- [x] Ensure link text corrections are explicitly marked in the output when
  applied.

## 2. Validation
- [ ] Manually run a sample refine request to confirm section order, the
  Technical Specifications section behavior, and link/purpose alignment.
