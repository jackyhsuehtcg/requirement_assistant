## ADDED Requirements
### Requirement: Output sections follow the required order
The system SHALL emit requirement output sections in the following strict order:
Menu, User Story Narrative, Criteria, Technical Specifications, Acceptance
Criteria. Each section SHALL use the configured h1 headers and be separated by
"----".

#### Scenario: Output order with technical section
- **WHEN** the system refines a draft
- **THEN** the output lists sections in the required order with Technical
  Specifications placed between Criteria and Acceptance Criteria

### Requirement: Cover draft requirements before augmenting
The system SHALL capture and restate all requirements and constraints in the
user's draft before adding any supplemental scenarios or details. Any
augmentation SHALL be conservative and limited to standard edge cases or
explicitly supported reference context.

#### Scenario: Draft coverage precedes augmentation
- **WHEN** the draft includes explicit business rules or constraints
- **THEN** those rules appear in the output before any added scenarios

### Requirement: Link text and purpose align with references
The system SHALL preserve every reference and link from the draft or reference
context and ensure that the link text and purpose label accurately describe the
linked content. If the link text is inaccurate or misleading, the system MAY
correct the link text but SHALL explicitly mark the correction. If the linkage
is unclear, the system SHALL use a generic purpose label and avoid unrelated
descriptions.

#### Scenario: Ambiguous link purpose
- **WHEN** a link appears without a clear purpose in the draft or references
- **THEN** the link is preserved with a generic purpose label and no unrelated
  description

#### Scenario: Link text corrected with marking
- **WHEN** a link's text does not match the linked content
- **THEN** the link text is corrected and explicitly marked as corrected

### Requirement: Technical specifications derive only from provided sources
The system SHALL populate the Technical Specifications section only with
technical constraints, integration details, or non-functional requirements that
are explicitly present in the draft or reference context. If no technical
details are provided, the system SHALL leave the Technical Specifications
section empty.

#### Scenario: No technical details provided
- **WHEN** the draft and references contain no technical constraints
- **THEN** the Technical Specifications section contains no bullet items
