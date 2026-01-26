# Rubric System Flow Documentation

## Overview

The Rubric System in EduVision is a comprehensive evaluation framework that allows educators to create, manage, and apply structured grading rubrics for student assessments. This document explains the complete lifecycle of a rubric, from creation to application.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Data Models](#data-models)
3. [Rubric Lifecycle](#rubric-lifecycle)
4. [Creation Process](#creation-process)
5. [Storage Structure](#storage-structure)
6. [Evaluation Process](#evaluation-process)
7. [API Endpoints](#api-endpoints)
8. [Rule Types](#rule-types)

---

## Architecture Overview

The rubric system follows a modular architecture:

```
apps/rubrics/
├── models.py           # Data models (Rubric, RubricVersion)
├── serializers.py      # DRF serializers with Pydantic validation
├── schemas.py          # Pydantic schemas for validation
├── views.py            # ViewSet with CRUD + custom actions
├── services.py         # Evaluation logic (rule evaluators)
└── urls.py             # API routing
```

**Key Design Principles:**
- **State Machine**: Rubrics follow a strict state lifecycle (draft → published → archived)
- **Versioning**: Automatic version snapshots on significant changes
- **Immutability**: Published rubrics become read-only
- **Validation**: Multi-layer validation using Django + Pydantic
- **PostgreSQL JSONB**: Flexible evaluation rules storage

---

## Data Models

### Rubric Model

**Database Table:** `rubrics`

**Primary Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key (auto-generated) |
| `version` | Integer | Current version number |
| `state` | CharField | Current lifecycle state (draft/published/archived) |
| `title` | TextField | Rubric title |
| `subject` | TextField | Subject area (indexed) |
| `question_text` | TextField | The actual question |
| `reference_answer` | TextField | Model/reference answer |
| `total_marks` | Decimal | Maximum possible marks |
| `evaluation_rules` | JSONField | List of evaluation rules (JSONB) |
| `created_by` | UUID | User who created the rubric |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Last update timestamp |

**Indexes:**
- `(created_by, state)` - For user's rubrics by state
- `(subject, state)` - For subject-based filtering
- `created_at` (descending) - For chronological listing

### RubricVersion Model

**Database Table:** `rubric_versions`

**Purpose:** Maintains historical snapshots of rubric changes

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary key |
| `rubric` | ForeignKey | Reference to parent rubric |
| `version_number` | Integer | Version number |
| `snapshot` | JSONField | Complete rubric state at this version |
| `created_at` | DateTime | Snapshot creation time |

**Unique Constraint:** `(rubric, version_number)`

---

## Rubric Lifecycle

### State Diagram

```
┌─────────┐     publish()      ┌───────────┐     archive()      ┌──────────┐
│  DRAFT  │ ───────────────→   │ PUBLISHED │ ───────────────→   │ ARCHIVED │
└─────────┘                    └───────────┘                    └──────────┘
    ↓                                ↓                                ↓
 Editable                       Read-only                        Read-only
 Deletable                   Cannot edit/delete               Cannot edit/delete
```

### State Transitions

1. **DRAFT State:**
   - Initial state when created
   - Fully editable (PUT/PATCH allowed)
   - Deletable
   - Can be published

2. **PUBLISHED State:**
   - Reached via `POST /api/rubrics/{id}/publish/`
   - Completely read-only
   - Cannot be edited or deleted
   - Can only be archived
   - Used for active evaluations

3. **ARCHIVED State:**
   - Reached via `POST /api/rubrics/{id}/archive/`
   - Permanently read-only
   - Historical record
   - Cannot be unarchived (business logic decision)

---

## Creation Process

### Step-by-Step Flow

#### 1. **Create Draft Rubric**

**Endpoint:** `POST /api/rubrics/`

**Request Example:**
```json
{
  "title": "Physics - Newton's Second Law",
  "subject": "Physics",
  "question_text": "State and explain Newton's Second Law of Motion. Include the mathematical formula.",
  "reference_answer": "Newton's Second Law states that force equals mass times acceleration (F=ma). The net force on an object is equal to the rate of change of its momentum.",
  "total_marks": 10.0,
  "evaluation_rules": [
    {
      "id": "rule-1",
      "type": "keyword",
      "marks": 4.0,
      "config": {
        "required_keywords": ["force", "mass", "acceleration", "F=ma"],
        "scoring_mode": "proportional"
      },
      "feedback": {
        "on_success": "All key concepts identified",
        "on_failure": "Missing key concepts",
        "on_partial": "Some concepts present"
      }
    },
    {
      "id": "rule-2",
      "type": "keyword",
      "marks": 3.0,
      "config": {
        "required_keywords": ["momentum", "rate of change"],
        "scoring_mode": "proportional"
      },
      "feedback": {
        "on_success": "Advanced understanding shown",
        "on_failure": "Missing deeper explanation"
      }
    },
    {
      "id": "rule-3",
      "type": "stepwise",
      "marks": 3.0,
      "config": {
        "step_description": "Mathematical explanation",
        "expected_patterns": ["F\\s*=\\s*m\\s*[*x]\\s*a", "force.*equals.*mass.*acceleration"],
        "allow_partial_credit": true
      },
      "feedback": {
        "on_success": "Formula correctly stated",
        "on_failure": "Formula missing or incorrect"
      }
    }
  ]
}
```

**Validation (Serializer + Pydantic):**
- Title: 1-500 characters
- Total marks: > 0, ≤ 1000
- Evaluation rules: Must be non-empty list
- Each rule validated against Pydantic schemas
- Sum of rule marks ≤ total marks

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "version": 1,
  "state": "draft",
  "title": "Physics - Newton's Second Law",
  "subject": "Physics",
  "question_text": "...",
  "reference_answer": "...",
  "total_marks": "10.00",
  "evaluation_rules": [...],
  "created_by": "user-uuid",
  "created_at": "2026-01-20T10:00:00Z",
  "updated_at": "2026-01-20T10:00:00Z",
  "versions": []
}
```

#### 2. **Edit Draft (Optional)**

**Endpoint:** `PUT/PATCH /api/rubrics/{id}/`

- Only works when `state = "draft"`
- Returns 400 error if state is published/archived
- Significant changes increment version number
- Creates version snapshot automatically

#### 3. **Test Rubric (Optional)**

**Endpoint:** `POST /api/rubrics/test/`

Test evaluation logic without saving:

```json
{
  "rubric": {
    "evaluation_rules": [...],
    "total_marks": 10.0
  },
  "answer_text": "Force equals mass times acceleration. F=ma."
}
```

**Response:**
```json
{
  "total_score": 7.5,
  "max_score": 10.0,
  "rule_results": [
    {
      "rule_id": "rule-1",
      "rule_type": "keyword",
      "max_marks": 4.0,
      "score_awarded": 3.0,
      "matched": false,
      "feedback_message": "Partial match: 3/4 keywords found."
    }
  ],
  "feedback": "Overall Score: 7.5/10.0 (75.0%)\n--------------------------------------------------\nRule 1 (keyword): 3.0/4.0 marks - Partial match: 3/4 keywords found.\n..."
}
```

#### 4. **Publish Rubric**

**Endpoint:** `POST /api/rubrics/{id}/publish/`

**Pre-publish Validation:**
- Must be in `draft` state
- At least one evaluation rule required
- Sum of rule marks **must equal** total_marks (tolerance: 0.01)

**Actions Performed:**
1. Validate marks equality
2. Change state to `published`
3. Increment version number (automatic via model save)
4. Create version snapshot (automatic via model save)

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "version": 2,
  "state": "published",
  ...
}
```

**After Publishing:**
- Rubric becomes immutable
- PUT/PATCH/DELETE return 400 errors
- Can only be archived

---

## Storage Structure

### Primary Storage (PostgreSQL)

#### Rubrics Table Structure

```sql
CREATE TABLE rubrics (
    id UUID PRIMARY KEY,
    version INTEGER NOT NULL CHECK (version >= 1),
    state VARCHAR(20) NOT NULL CHECK (state IN ('draft', 'published', 'archived')),
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    question_text TEXT NOT NULL,
    reference_answer TEXT NOT NULL,
    total_marks DECIMAL(10, 2) NOT NULL CHECK (total_marks > 0),
    evaluation_rules JSONB NOT NULL DEFAULT '[]',
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes
CREATE INDEX idx_rubrics_created_by_state ON rubrics(created_by, state);
CREATE INDEX idx_rubrics_subject_state ON rubrics(subject, state);
CREATE INDEX idx_rubrics_created_at_desc ON rubrics(created_at DESC);
```

#### Rubric Versions Table Structure

```sql
CREATE TABLE rubric_versions (
    id UUID PRIMARY KEY,
    rubric_id UUID NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL CHECK (version_number >= 1),
    snapshot JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(rubric_id, version_number)
);

-- Indexes
CREATE INDEX idx_rubric_versions_rubric_version ON rubric_versions(rubric_id, version_number DESC);
CREATE INDEX idx_rubric_versions_created_at_desc ON rubric_versions(created_at DESC);
```

### JSONB Storage Format

**evaluation_rules Field:**

```json
[
  {
    "id": "rule-uuid-1",
    "type": "keyword",
    "marks": 4.0,
    "config": {
      "required_keywords": ["force", "mass", "acceleration"],
      "scoring_mode": "proportional"
    },
    "feedback": {
      "on_success": "All keywords present",
      "on_failure": "Missing keywords",
      "on_partial": "Partial match"
    }
  },
  {
    "id": "rule-uuid-2",
    "type": "numeric",
    "marks": 3.0,
    "config": {
      "expected_value": 9.8,
      "tolerance": 0.1
    },
    "feedback": {
      "on_success": "Correct value",
      "on_failure": "Incorrect value"
    }
  }
]
```

**snapshot Field (in rubric_versions):**

```json
{
  "version": 2,
  "state": "published",
  "title": "Physics - Newton's Second Law",
  "subject": "Physics",
  "question_text": "...",
  "reference_answer": "...",
  "total_marks": "10.00",
  "evaluation_rules": [...],
  "created_by": "user-uuid",
  "updated_at": "2026-01-20T10:00:00+00:00"
}
```

---

## Evaluation Process

### How Evaluation Works

When a student submits an answer, the rubric is applied via the `apply_rubric()` function in `services.py`.

#### Evaluation Flow

```
1. Load rubric (from database)
2. Extract evaluation_rules list
3. Loop through rules in order
4. For each rule:
   a. Identify rule type (keyword/numeric/stepwise)
   b. Call appropriate evaluator function
   c. Receive score and feedback
   d. Accumulate total score
5. Generate combined feedback
6. Return evaluation result
```

#### Evaluator Functions

**1. Keyword Evaluator** (`evaluate_keyword_rule`)

- **Purpose:** Match required keywords in answer
- **Modes:**
  - `proportional`: Score = (matched/total) × marks
  - `all_or_nothing`: Full marks only if all matched

**Example:**
```python
# Rule config
{
  "required_keywords": ["force", "mass", "acceleration"],
  "scoring_mode": "proportional"
}

# Answer: "Force is related to mass."
# Result: 2/3 keywords matched → 66.7% of marks awarded
```

**2. Numeric Evaluator** (`evaluate_numeric_rule`)

- **Purpose:** Extract and validate numeric values
- **Tolerance:** Allows acceptable deviation

**Example:**
```python
# Rule config
{
  "expected_value": 9.8,
  "tolerance": 0.1
}

# Answer: "The value is 9.75 m/s²"
# Result: Within tolerance → Full marks awarded
```

**3. Stepwise Evaluator** (`evaluate_stepwise_rule`)

- **Purpose:** Check for step-by-step work using regex patterns
- **Partial Credit:** Optional

**Example:**
```python
# Rule config
{
  "step_description": "Derivation step 1",
  "expected_patterns": ["F\\s*=\\s*m\\s*a", "force.*equals.*mass"],
  "allow_partial_credit": true
}

# Answer: "F = ma"
# Result: Pattern matched → Full marks awarded
```

### Evaluation Result Structure

```json
{
  "total_score": 7.5,
  "max_score": 10.0,
  "rule_results": [
    {
      "rule_id": "rule-1",
      "rule_type": "keyword",
      "max_marks": 4.0,
      "score_awarded": 3.0,
      "matched": false,
      "feedback_message": "Partial match: 3/4 keywords found."
    },
    {
      "rule_id": "rule-2",
      "rule_type": "numeric",
      "max_marks": 3.0,
      "score_awarded": 3.0,
      "matched": true,
      "feedback_message": "Correct value"
    },
    {
      "rule_id": "rule-3",
      "rule_type": "stepwise",
      "max_marks": 3.0,
      "score_awarded": 1.5,
      "matched": false,
      "feedback_message": "Partial: 1/2 elements found"
    }
  ],
  "feedback": "Overall Score: 7.5/10.0 (75.0%)\n--------------------------------------------------\nRule 1 (keyword): 3.0/4.0 marks - Partial match: 3/4 keywords found.\nRule 2 (numeric): 3.0/3.0 marks - Correct value\nRule 3 (stepwise): 1.5/3.0 marks - Partial: 1/2 elements found"
}
```

---

## API Endpoints

### Base URL: `/api/rubrics/`

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/` | Create new draft rubric | Yes |
| GET | `/` | List all rubrics (with filters) | Yes |
| GET | `/{id}/` | Retrieve specific rubric | Yes |
| PUT | `/{id}/` | Update draft rubric (full update) | Yes |
| PATCH | `/{id}/` | Partially update draft rubric | Yes |
| DELETE | `/{id}/` | Delete draft rubric | Yes |
| POST | `/{id}/publish/` | Publish draft rubric | Yes |
| POST | `/{id}/archive/` | Archive published rubric | Yes |
| GET | `/{id}/versions/` | Get version history | Yes |
| POST | `/test/` | Test rubric without saving | Yes |

### Query Parameters (List Endpoint)

```
GET /api/rubrics/?state=published&subject=Physics&created_by={uuid}
```

---

## Rule Types

### 1. Keyword Rule

**Use Case:** Check for presence of specific terms/concepts

**Configuration:**
```json
{
  "type": "keyword",
  "marks": 4.0,
  "config": {
    "required_keywords": ["photosynthesis", "chlorophyll", "glucose"],
    "scoring_mode": "proportional"
  }
}
```

**Scoring Modes:**
- `proportional`: Partial credit based on matched keywords
- `all_or_nothing`: Full marks only if all keywords present

### 2. Numeric Rule

**Use Case:** Validate numeric answers (calculations, measurements)

**Configuration:**
```json
{
  "type": "numeric",
  "marks": 5.0,
  "config": {
    "expected_value": 3.14159,
    "tolerance": 0.001
  }
}
```

**Features:**
- Extracts numbers from text using regex
- Accepts answer if within tolerance range
- Useful for physics/math problems

### 3. Stepwise Rule

**Use Case:** Check for step-by-step work, derivations, proofs

**Configuration:**
```json
{
  "type": "stepwise",
  "marks": 6.0,
  "config": {
    "step_description": "Step 1: Apply chain rule",
    "expected_patterns": [
      "d/dx\\s*\\(f\\(g\\(x\\)\\)\\)",
      "chain rule"
    ],
    "allow_partial_credit": true
  }
}
```

**Features:**
- Uses regex pattern matching
- Multiple patterns can be specified
- Partial credit for matching some patterns
- Case-insensitive, multiline matching

---

## Version Management

### Automatic Versioning

Versions are automatically created when:

1. **State Changes:**
   - draft → published
   - published → archived

2. **Content Changes** (only in draft state):
   - question_text modified
   - reference_answer modified
   - total_marks changed
   - evaluation_rules updated

### Version Snapshot Contents

Each snapshot contains:
```json
{
  "version": 2,
  "state": "published",
  "title": "...",
  "subject": "...",
  "question_text": "...",
  "reference_answer": "...",
  "total_marks": "10.00",
  "evaluation_rules": [...],
  "created_by": "user-uuid",
  "updated_at": "2026-01-20T10:00:00+00:00"
}
```

### Retrieving Versions

**Endpoint:** `GET /api/rubrics/{id}/versions/`

**Response:**
```json
[
  {
    "id": "version-uuid-2",
    "version_number": 2,
    "snapshot": {...},
    "created_at": "2026-01-20T11:00:00Z"
  },
  {
    "id": "version-uuid-1",
    "version_number": 1,
    "snapshot": {...},
    "created_at": "2026-01-20T10:00:00Z"
  }
]
```

---

## Best Practices

### Creating Effective Rubrics

1. **Start with Clear Questions:**
   - Be specific in question_text
   - Provide comprehensive reference_answer

2. **Design Balanced Rules:**
   - Break evaluation into logical components
   - Ensure rule marks sum to total_marks exactly
   - Use appropriate rule types for each aspect

3. **Write Helpful Feedback:**
   - Customize on_success, on_failure, on_partial messages
   - Make feedback instructive, not just evaluative

4. **Test Before Publishing:**
   - Use `/test/` endpoint with sample answers
   - Verify scoring logic works as expected
   - Check edge cases

5. **Use Proportional Scoring:**
   - Prefer `proportional` over `all_or_nothing`
   - Rewards partial understanding
   - More fair to students

### Rule Distribution Example

For a 10-mark question:
```
- Conceptual understanding (keyword): 4 marks
- Formula/equation (keyword/stepwise): 3 marks  
- Numerical calculation (numeric): 3 marks
Total: 10 marks
```

---

## Integration Points

### With Evaluation App

Rubrics are used by the evaluation app to:
- Grade student submissions automatically
- Provide detailed feedback
- Generate evaluation reports

### With Intelligence App

The intelligence app can:
- Analyze rubric effectiveness
- Suggest rubric improvements
- Generate rubrics from question text using AI

---

## Error Handling

### Common Errors

**1. State Violation:**
```json
{
  "detail": "Cannot edit published rubrics. Only draft rubrics can be modified."
}
```

**2. Marks Mismatch:**
```json
{
  "detail": "Cannot publish: Sum of rule marks (12.0) must equal total marks (10.0)"
}
```

**3. Invalid Rule:**
```json
{
  "evaluation_rules": [
    "Rule 1 validation error: required_keywords must be a list"
  ]
}
```

**4. Missing Rules:**
```json
{
  "detail": "Cannot publish: At least one evaluation rule is required"
}
```

---

## Performance Considerations

### Database Optimization

1. **JSONB Indexing:**
   - PostgreSQL JSONB is optimized for queries
   - Can add GIN indexes if needed: `CREATE INDEX idx_gin_eval_rules ON rubrics USING GIN (evaluation_rules);`

2. **Selective Loading:**
   - Use `select_related()` and `prefetch_related()` for versions
   - Avoid N+1 queries

3. **Caching:**
   - Published rubrics rarely change
   - Consider Redis caching for frequently used rubrics

### Evaluation Performance

- Regex compilation is cached in Python
- Large answers may need chunking
- Consider async evaluation for bulk operations

---

## Security Considerations

1. **Authorization:**
   - Verify user permissions before CRUD operations
   - created_by field tracks ownership

2. **Input Validation:**
   - Pydantic schemas prevent injection
   - Regex patterns are sanitized with `re.escape()`

3. **Audit Trail:**
   - Version history provides complete audit log
   - created_at, updated_at timestamps

---

## Future Enhancements

Potential improvements:

1. **AI-Assisted Rule Generation:**
   - Generate evaluation rules from reference answers
   - Use LLMs to suggest appropriate keywords

2. **Rule Templates:**
   - Predefined rule sets for common question types
   - Subject-specific templates

3. **Collaborative Rubrics:**
   - Share rubrics between educators
   - Public rubric library

4. **Analytics Dashboard:**
   - Track rubric usage statistics
   - Analyze scoring distributions
   - Identify ineffective rules

5. **Advanced Rule Types:**
   - Semantic similarity rules (using embeddings)
   - Diagram/image recognition rules
   - Code evaluation rules

---

## Summary

The EduVision Rubric System provides:

✅ **Structured Evaluation:** Consistent, objective grading  
✅ **Flexibility:** Multiple rule types for different assessment needs  
✅ **Immutability:** Published rubrics ensure fairness  
✅ **Version Control:** Complete audit trail of changes  
✅ **Scalability:** PostgreSQL JSONB for efficient storage  
✅ **Extensibility:** Easy to add new rule types  

**Key Takeaways:**
- Rubrics move through draft → published → archived lifecycle
- Stored in PostgreSQL with JSONB for evaluation rules
- Three rule types: keyword, numeric, stepwise
- Automatic versioning on significant changes
- Published rubrics are immutable
- Comprehensive API for full lifecycle management

For more details, see:
- [EVALUATION_README.md](./apps/rubrics/EVALUATION_README.md)
- [APPLY_RUBRIC_GUIDE.md](./apps/rubrics/APPLY_RUBRIC_GUIDE.md)
- [API_REFERENCE.md](./API_REFERENCE.md)
