---
name: document-codebase
description: Generate comprehensive GitBook-compatible documentation for the entire codebase using parallel subagents for research, writing, and review. Organized by topic (Overview, Setup, Codebase) with interactive API reference.
argument-hint: [optional output-path]
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, Task, AskUserQuestion, Skill, WebFetch
user-invocable: true
---

# Codebase Documentation Generator

Generate comprehensive, GitBook-compatible documentation using parallel subagents for research, writing, and review. Documentation is organized into three topic areas that naturally serve different stakeholders:

- **Overview** - What is this and why does it matter? (CEO, investors, new hires day 1)
- **Setup** - How do I run, deploy, and operate this? (Engineers, DevOps, SREs)
- **Codebase** - How do I work in this code? (Engineers, contributors)

## Usage

- `/document-codebase` - Full documentation generation
- `/document-codebase docs/` - Output to specific directory

---

## Pipeline

```
Phase 0: Collect existing docs (README.md, spec/, CLAUDE.md)
    |
Phase 1: Discovery interview (/interview-me)
    |
Phase 2: Parallel research ─┬─ Agent 1: Product & business context
                             ├─ Agent 2: Frontend architecture
                             ├─ Agent 3: Backend architecture
                             ├─ Agent 4: API contracts → OpenAPI spec
                             ├─ Agent 5: Infrastructure & deployment
                             └─ Agent 6: Security posture
    |
Phase 3: Parallel writing ──┬─ Agent 7: Overview section (3 pages)
                             ├─ Agent 8: Setup section (5 pages)
                             └─ Agent 9: Codebase section (4 pages + OpenAPI)
    |
Phase 4: Parallel review ───┬─ Agent 10: Accuracy & completeness
                             ├─ Agent 11: Security scan
                             └─ Agent 12: Placeholder resolution
    |
Phase 5: Assemble GitBook output
```

---

## Target Output Structure

```
docs/
├── .gitbook.yaml
├── README.md                          # Landing page with role-based navigation
├── SUMMARY.md                         # GitBook table of contents
│
├── overview/
│   ├── README.md                      # Value Delivered
│   ├── examples.md                    # Real usage examples & user flows
│   └── cost-and-performance.md        # Third-party costs, scaling, benchmarks
│
├── setup/
│   ├── README.md                      # Quick Setup (stepper)
│   ├── architecture.md                # Architecture & Tech Stack
│   ├── environments.md                # Environment matrix & configuration
│   ├── monitoring.md                  # Monitoring & Logging
│   └── failure-modes.md               # Failure Modes & Recovery (runbooks)
│
├── codebase/
│   ├── README.md                      # Repository Structure
│   ├── models-and-code.md             # Architecture patterns, DB schema, conventions
│   ├── testing.md                     # Testing & Validation
│   └── api-reference.md               # API guide (links to interactive spec)
│
├── api-reference/
│   └── openapi.yaml                   # OpenAPI 3.0 spec for GitBook interactive mode
│
└── .gitbook/
    └── assets/
```

---

## Phase 0: Collect Existing Documentation

Before doing anything, gather everything that already exists. This prevents contradictions and gives subagents real context.

**Collect into a variable `EXISTING_DOCS`:**

1. **Read all README.md files** (exclude `.claude/`, `node_modules/`, `.git/`, `Pods/`)
   ```
   Glob: **/README.md (filter out excluded dirs)
   Read each file, prefix with its path
   ```

2. **Read all spec files**
   ```
   Glob: spec/**/*.md
   Glob: backend/spec/**/*.md
   Read each file, prefix with its path
   ```

3. **Read CLAUDE.md** at repo root (if exists)

4. **Read package/dependency files** (for version info)
   ```
   Glob: **/package.json, **/Podfile, **/pyproject.toml, **/requirements*.txt
   Glob: **/*.xcconfig (for iOS environment config)
   Read each, prefix with path
   ```

5. **Check for existing docs/ or .gitbook.yaml**
   - If `docs/` exists, read its structure and warn user before overwriting
   - If `.gitbook.yaml` exists, read it and extend rather than replace

**Store all collected content as `EXISTING_DOCS` to inject into every subagent prompt.**

---

## Phase 1: Discovery Interview

Invoke the `/interview-me` skill to gather context that code alone cannot reveal.

```
/interview-me "I'm generating comprehensive documentation for this codebase. I need to understand things the code doesn't tell me: the business context, deployment procedures, team structure, operational pain points, and anything a new person joining would need to know. The docs will cover three areas: product overview, setup & operations, and codebase deep-dive."
```

**The interview should surface:**
- What the product does in business terms (not just technical terms)
- Who the customers are and what problem this solves for them
- How deployments work (CI/CD, manual steps, approval processes)
- What environments exist and how to access them
- What monitoring/alerting is in place
- What breaks most often and how it gets fixed
- What the team structure looks like (bus factor, on-call)
- What compliance/regulatory requirements exist
- What technical debt is known
- What's on the roadmap

**After interview completes**, store the output as `INTERVIEW_NOTES` for injection into research agents.

---

## Phase 2: Parallel Research (6 Subagents)

**CRITICAL: Launch ALL 6 in a SINGLE message with multiple Task tool calls.**

Every research agent receives `EXISTING_DOCS` and `INTERVIEW_NOTES` in its prompt. Every agent must cite file paths for every claim. Mark genuinely unknown items with `[UNKNOWN - reason]`.

---

### Research Agent 1: Product & Business Context

```
subagent_type: Explore
max_turns: 30

Prompt:
You are researching a codebase to extract product and business context for documentation.

EXISTING DOCS:
${EXISTING_DOCS}

INTERVIEW NOTES:
${INTERVIEW_NOTES}

RESEARCH TASKS - use Glob and Grep to find evidence for each:

1. **Product identity**: Search for app name, description, tagline in README.md, Info.plist, package.json, CLAUDE.md, marketing copy
2. **Features inventory**: Search spec/SPEC.md and backend/spec/SPEC.md for "Completed Features" sections. Cross-reference with actual code directories under Presentation/Scenes/ or similar
3. **User-facing flows**: Find all View/Screen files (Glob: **/*View.swift, **/*Screen.swift, **/pages/**). List each screen with a one-line description
4. **Tech stack summary**: Read package managers (Podfile, pyproject.toml, Package.swift) for all dependencies. Categorize each as: Core Framework, Networking, Auth, UI, Analytics, AI/ML, Database, DevOps
5. **Third-party services**: Grep for API base URLs, SDK initializations, service client constructors. Build a table: Service | Purpose | Where Configured
6. **Data collected**: Search for database models/schemas. List what user data is stored (PII, health data, preferences, activity)
7. **Costs**: Look for pricing-relevant config (LLM model names → approximate per-call cost, cloud service references, paid SDK usage)

OUTPUT: Raw structured markdown. Every claim must include a file path reference. No opinions, just facts.
```

---

### Research Agent 2: Frontend/iOS Architecture

```
subagent_type: Explore
max_turns: 30

Prompt:
You are researching the iOS/frontend architecture for documentation.

EXISTING DOCS:
${EXISTING_DOCS}

RESEARCH TASKS:

1. **Entry point & lifecycle**: Find the @main App struct or AppDelegate. Read it. Trace the app launch flow
2. **Architecture layers**:
   - Glob: Nouri/Presentation/**  → list all Coordinators, Scenes (Views + ViewModels)
   - Glob: Nouri/Domain/**  → list all UseCases, Entities, Abstractions (protocols)
   - Glob: Nouri/Data/**  → list all Repositories, Networking files, Mappers
3. **Navigation**: Find the coordinator files. How does navigation work? Read 1-2 coordinator files fully
4. **Dependency injection**: Grep for "Container" or "@Injected" or "Factory". Find the DI container file and read it
5. **Networking layer**: Find APIClient, APIConfiguration, APIAuthenticator. Read them. Document the request flow
6. **Auth flow**: Find auth-related files. Trace: login → token storage → token refresh → authenticated request
7. **Key patterns** - Read ONE representative example of each and capture the actual code:
   - A ViewModel (pick the simplest complete one)
   - A UseCase
   - A Repository protocol + implementation pair
   - A Mapper
8. **Build config**: Read all .xcconfig files. Read the project.pbxproj for scheme names. Document scheme → bundle ID → environment mapping
9. **Testing**: Glob: NouriTests/**. List test files. Read 1-2 test files to understand patterns (mocking, assertions)
10. **Assets**: Check for asset catalogs, localization files, font files

OUTPUT: Raw structured markdown with actual code snippets (not summaries). Include file paths for everything.
```

---

### Research Agent 3: Backend Architecture

```
subagent_type: Explore
max_turns: 30

Prompt:
You are researching the backend architecture for documentation.

EXISTING DOCS:
${EXISTING_DOCS}

RESEARCH TASKS:

1. **Entry point**: Find and read the FastAPI app initialization (app/main.py or similar). Document middleware, CORS, route mounting
2. **Route inventory**: Glob: backend/app/api/**/*.py. For each route file, extract ALL endpoints (method, path, handler name, auth requirement). Build a complete endpoint table
3. **Service layer**: Glob: backend/app/services/**/*.py. List every service class and its public methods. Read 1 representative service fully
4. **Data models**: Glob: backend/app/db/models/**/*.py. For EVERY model, extract: table name, all columns (name, type, nullable, default), relationships, indexes
5. **Repository layer**: Glob: backend/app/db/repositories/**/*.py or similar. List each repository and its key operations
6. **AI/ML pipeline**: Search backend/app/intelli/ or similar AI directory. Document: LLM providers, model names, prompt patterns, task processing flow
7. **Background tasks**: Grep for "celery" or "@task" or "BackgroundTask". Document task definitions, queue names, scheduling
8. **Middleware**: Find all middleware (auth, CORS, error handling, logging). Read each
9. **Database migrations**: Check for alembic/ or migrations/. Count migrations, read the latest 2
10. **Testing**: Glob: backend/tests/**/*.py. List test files. Read 1-2 tests to capture fixture patterns, assertion styles
11. **Config & secrets**: Find .env.example, config files, settings classes. Document all expected environment variables (names only, NOT values)

OUTPUT: Raw structured markdown with actual code snippets. Include file paths. Build a complete endpoint table with EVERY route.
```

---

### Research Agent 4: API Contracts → OpenAPI Spec

```
subagent_type: Explore
max_turns: 40

Prompt:
You are extracting API contracts and generating an OpenAPI 3.0 specification.

EXISTING DOCS:
${EXISTING_DOCS}

PRIMARY SOURCE: Read backend/spec/APICONTRACTS.md fully (this is the authoritative API contract document).

SECONDARY SOURCES: Cross-reference with actual route files:
- Glob: backend/app/api/**/*.py - read each route file for endpoint definitions
- Glob: backend/app/schemas/**/*.py or backend/app/api/**/schemas.py - read for Pydantic models

TASKS:

1. **Build endpoint inventory** from APICONTRACTS.md:
   - Every endpoint: method, path, description, auth requirement
   - Request schema: headers, query params, path params, body (field name, type, required, validation)
   - Response schema: status codes, body structure (field name, type, description)
   - Error responses: error codes and their meanings

2. **Extract common patterns**:
   - Response envelope structure (data/meta wrapper)
   - Pagination pattern (cursor-based) with field names
   - Error response format with all documented error codes
   - Authentication header formats for each auth method

3. **Generate OpenAPI 3.0 YAML**:
   - Valid, parseable OpenAPI 3.0.0 specification
   - Group endpoints by tags (matching domain areas: Auth, Users, Meals, Nutrition, etc.)
   - Define all schemas in components/schemas (reuse shared DTOs)
   - Define securitySchemes for each auth method
   - Include realistic examples for request/response bodies
   - Add x-code-samples with curl examples for key endpoints
   - Use tag descriptions to add context per domain area

OUTPUT in TWO parts clearly separated:
---PART 1: ENDPOINT SUMMARY---
[Markdown table of all endpoints]

---PART 2: OPENAPI SPEC---
[Complete, valid OpenAPI 3.0 YAML - ready to write to file]
```

---

### Research Agent 5: Infrastructure & Deployment

```
subagent_type: Explore
max_turns: 25

Prompt:
You are researching infrastructure and deployment configuration.

EXISTING DOCS:
${EXISTING_DOCS}

INTERVIEW NOTES:
${INTERVIEW_NOTES}

RESEARCH TASKS:

1. **CI/CD config**: Search for: Bitrise yml, .github/workflows/, Fastfile, Makefile, bitrise.yml, cloudbuild.yaml, Dockerfile, docker-compose.yml. Read each found
2. **Environment config**:
   - iOS: Read all .xcconfig files. Extract per-environment values (API host, bundle ID, etc.)
   - Backend: Read .env.example or settings/config files. List all env vars by environment
   - Build schemes: Extract from CLAUDE.md or project config
3. **Cloud infrastructure**: Grep for GCP, AWS, Azure, Cloud Run, Cloud Storage, Cloud Tasks references. Build inventory table
4. **Database hosting**: Search for database connection config. Note: PostgreSQL version, hosting service, connection pooling
5. **Cache & queues**: Search for Redis config, Celery config (broker URL patterns, worker settings). Read celery config files
6. **Monitoring**: Search for: Crashlytics setup, Sentry DSN, logging config, health check endpoints. Grep for "/health" or "healthcheck"
7. **Secrets management**: How are secrets loaded? (.env, xcconfig, GCP Secret Manager, etc.) List all secret sources (NOT values)
8. **Deployment process**: Read any Makefile, scripts/ directory, deployment docs. What commands deploy to staging? To prod?
9. **Scaling config**: Look for autoscaling settings, worker counts, connection pool sizes, rate limits

OUTPUT: Raw structured markdown. Include file paths. Build tables for: environments, cloud resources, monitoring endpoints, secret sources.
```

---

### Research Agent 6: Security Posture

```
subagent_type: Explore
max_turns: 25

Prompt:
You are auditing the codebase security posture for documentation purposes.

EXISTING DOCS:
${EXISTING_DOCS}

RESEARCH TASKS:

1. **Authentication**: Find auth implementation files. Document each auth method (JWT, Firebase, magic link). Trace token lifecycle: creation → storage → refresh → expiry → revocation
2. **SSL/Certificate pinning**: Find SSL pinning config. Read the implementation. Document: what's pinned (public key vs cert), rotation procedure, backup pins
3. **API security**: Check for rate limiting middleware, CORS config, input validation patterns, request size limits
4. **Database security**: Search for RLS policies, database permissions, parameterized queries (ORM usage patterns)
5. **Secrets in code**: Grep for patterns that might be secrets: API keys, tokens, passwords hardcoded (report file paths if found - flag as [SECURITY CONCERN])
6. **Data protection**: Where is PII stored? Is it encrypted at rest? What about health/nutrition data? Document data flow: collection → storage → processing → deletion
7. **Dependency security**: Check for dependency audit config (npm audit, safety, dependabot). Note any known vulnerability scanning
8. **Compliance-relevant features**: Search for: data export, account deletion, consent collection, data retention. Document what exists vs what's missing
9. **Third-party data sharing**: For each external service (LLM providers, analytics, crash reporting), document: what data is sent, where it's processed, data retention

OUTPUT: Raw structured markdown. Flag concerns with [SECURITY CONCERN: description]. Include file paths for everything.
CRITICAL: Do NOT include any actual secret values, API keys, tokens, or passwords in your output.
```

---

## Phase 3: Parallel Writing (3 Subagents)

**CRITICAL: Launch ALL 3 in a SINGLE message with multiple Task tool calls.**

Each writer receives ALL Phase 2 research outputs + INTERVIEW_NOTES + EXISTING_DOCS.

**IMPORTANT instruction for all writers:**
- Use REAL data from research. Do not write `[insert X here]` - if data is available in the research, use it.
- For genuinely unknown items, write `[UNKNOWN - could not determine from codebase]`.
- Do NOT contradict existing README.md files. Extend them.
- Use GitBook syntax: `{% hint %}`, `{% tabs %}`, `{% stepper %}`, `<details>`.
- Every page must be a complete, self-contained markdown file.
- Output each page as a clearly separated section with the filename as header.

---

### Writer Agent 7: Overview Section (3 pages)

```
subagent_type: general-purpose
max_turns: 15

Prompt:
You are writing the Overview section of project documentation. This section answers "What is this and why does it matter?" Write for a mixed audience: a CEO should understand it, but don't dumb it down.

ALL RESEARCH DATA:
${ALL_PHASE_2_OUTPUTS}

INTERVIEW NOTES:
${INTERVIEW_NOTES}

Write THREE complete GitBook-compatible markdown files. Use the actual project name, real feature names, real service names. No placeholder text.

===FILE: overview/README.md===

# Value Delivered

## What This Product Does

[Write 2-3 paragraphs: what it is, who uses it, what problem it solves. Use business language but be specific. Reference actual features by name.]

## Feature Summary

[Table with EVERY feature from SPEC.md. Columns: Feature | What It Does | Status (Shipped/In Progress/Planned)]

## Technology at a Glance

[Table: Component | Technology | Purpose. E.g.: "Mobile App | SwiftUI (iOS) | Native iPhone app for meal tracking and coaching"]

## Key Metrics

[Table of quantitative facts about the system:]
| Metric | Value |
|--------|-------|
| API Endpoints | [count from research] |
| Database Tables | [count from research] |
| Third-Party Integrations | [count from research] |
| Supported Auth Methods | [count from research] |
| AI Models Used | [list from research] |

---

===FILE: overview/examples.md===

# Examples

## User Flows

Describe the key user journeys through the product, based on the screens and API endpoints found:

### [Flow 1: e.g., "Track a Meal"]
{% stepper %}
{% step %}
### [Step name]
[What the user does and what happens behind the scenes. Reference actual endpoints and screens.]
{% endstep %}
[...more steps...]
{% endstepper %}

### [Flow 2: e.g., "Get AI Coaching"]
[Same stepper format]

### [Flow 3: e.g., "View Weekly Progress"]
[Same stepper format]

## Demo Data

[If demo/sandbox data exists, document: how to access it, what it contains, test credentials (if public/sandbox only)]

## API Quick Examples

[Show 2-3 curl examples for the most common API operations. Use actual endpoints and response formats from research.]

{% tabs %}
{% tab title="Track a Meal" %}
```bash
curl -X POST [actual endpoint] \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '[actual request body from API contracts]'
```

Response:
```json
[actual response format]
```
{% endtab %}
{% tab title="Get Dashboard" %}
[similar]
{% endtab %}
{% endtabs %}

---

===FILE: overview/cost-and-performance.md===

# Cost & Performance

## Third-Party Services

[Build this table from research. Include EVERY external service.]

| Service | Purpose | Pricing Model | Estimated Cost | What Happens If Down |
|---------|---------|---------------|----------------|----------------------|
[e.g.: "OpenAI GPT-5.1 | Meal image analysis | Per-token | ~$X per analysis | Meal tracking degrades to manual entry"]
[e.g.: "Firebase | Authentication | Free tier + per-auth | Free at current scale | Users cannot log in"]
[e.g.: "Google Cloud Run | API hosting | Per-request + compute | [UNKNOWN] | API unavailable"]

{% hint style="info" %}
Costs marked [UNKNOWN] require checking the cloud provider billing dashboard.
{% endhint %}

## Performance Characteristics

| Operation | Expected Latency | Bottleneck | Notes |
|-----------|-----------------|------------|-------|
[e.g.: "Meal analysis (AI)" | "5-15 seconds" | "LLM inference" | "Async via Celery task queue"]
[e.g.: "Dashboard load" | "<500ms" | "Multiple DB queries" | "Aggregates weight, nutrition, activity"]

## Scaling Limits

[What's the current architecture designed to handle? Reference from ARCHITECTURE.md or LEARNINGS.md]
- Current: [e.g., "Monolith designed for up to 100k users"]
- Next threshold: [e.g., "At 500k+ users, extract meal processing to separate service"]
- Database: [current scaling, connection pooling]
- Workers: [Celery worker count, task throughput]

## Vendor Risk Matrix

| Vendor | Lock-in Risk | Migration Difficulty | Alternative |
|--------|-------------|---------------------|-------------|
[e.g.: "Firebase Auth" | "Medium" | "Moderate - token migration needed" | "WorkOS (partially implemented)"]
[e.g.: "OpenAI" | "Low" | "Easy - multi-provider supported" | "Groq Llama (already integrated)"]

OUTPUT: Three complete markdown files, clearly separated with ===FILE: path=== headers.
```

---

### Writer Agent 8: Setup Section (5 pages)

```
subagent_type: general-purpose
max_turns: 20

Prompt:
You are writing the Setup section of project documentation. This answers "How do I get this running and keep it running?" Write for engineers and DevOps. Be precise - every command must be copy-pasteable, every config value must be real.

ALL RESEARCH DATA:
${ALL_PHASE_2_OUTPUTS}

INTERVIEW NOTES:
${INTERVIEW_NOTES}

EXISTING READMES:
${EXISTING_READMES}

IMPORTANT: The existing README.md files are the source of truth for setup steps. Do NOT contradict them. Extend and organize their content into the structure below.

Write FIVE complete GitBook-compatible markdown files:

===FILE: setup/README.md===

# Quick Setup

Get the full stack running locally.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
[List exact versions from research: Xcode, Python, uv, Node, Docker, etc. with install commands]

## iOS App

{% stepper %}
{% step %}
### Clone & Open
```bash
git clone [repo URL]
cd [repo name]
open Nouri.xcodeproj
```
{% endstep %}
{% step %}
### Configure Environment
[What xcconfig values need to be set. Where to get them. DO NOT include actual keys.]
{% endstep %}
{% step %}
### Build & Run
```bash
[exact build command from CLAUDE.md - use iPhone 17 Pro simulator]
```
{% endstep %}
{% step %}
### Verify
[How to confirm the iOS app is working - what screen should appear, what to tap]
{% endstep %}
{% endstepper %}

## Backend API

{% stepper %}
{% step %}
### Setup Environment
```bash
cd backend
uv venv && source .venv/bin/activate
uv sync
```
{% endstep %}
{% step %}
### Configure
```bash
cp .env.example .env
# Edit .env with required values (see table below)
```

| Variable | Purpose | Where to Get It |
|----------|---------|-----------------|
[List ALL env vars from .env.example with descriptions - NO actual values]
{% endstep %}
{% step %}
### Start Services
```bash
# Start dependencies
docker-compose up -d  # PostgreSQL, Redis

# Run migrations
[migration command]

# Start API
make dev  # or: uvicorn app.main:app --reload

# Start worker (separate terminal)
make worker  # or: celery command
```
{% endstep %}
{% step %}
### Verify
```bash
curl http://localhost:8000/health
# Expected: {"status": "ok"}

# Or open Swagger UI:
open http://localhost:8000/docs
```
{% endstep %}
{% endstepper %}

---

===FILE: setup/architecture.md===

# Architecture & Tech Stack

## System Overview

[Text-based architecture diagram showing all components and connections:]
```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   iOS App   │────▶│   FastAPI Backend │────▶│   PostgreSQL    │
│  (SwiftUI)  │     │  (Cloud Run)     │     │                 │
└─────────────┘     └──────┬───────────┘     └─────────────────┘
                           │
                    ┌──────┴───────────┐
                    │                  │
              ┌─────▼──────┐    ┌─────▼──────┐
              │   Redis    │    │   Celery   │
              │  (Cache)   │    │  (Workers) │
              └────────────┘    └─────┬──────┘
                                      │
                              ┌───────┴────────┐
                              │                │
                        ┌─────▼──┐      ┌──────▼─────┐
                        │ OpenAI │      │   Groq     │
                        │ GPT-5  │      │  Llama-4   │
                        └────────┘      └────────────┘
```
[Adjust to match actual architecture from research]

## iOS Architecture (MVVM + Clean Architecture)

### Layers

| Layer | Folder | Responsibility | Key Pattern |
|-------|--------|---------------|-------------|
| Presentation | `Nouri/Presentation/` | UI + navigation | Coordinators + SwiftUI Views + @MainActor ViewModels |
| Domain | `Nouri/Domain/` | Business logic | UseCases (Result<T, Error>) + Entity models + Repository protocols |
| Data | `Nouri/Data/` | External data | Repository implementations + Alamofire networking + DTO Mappers |

### Key Patterns with Real Code

{% tabs %}
{% tab title="ViewModel" %}
[Paste an ACTUAL ViewModel from the codebase - the simplest complete example found by research agent]
{% endtab %}
{% tab title="UseCase" %}
[Paste an ACTUAL UseCase]
{% endtab %}
{% tab title="Repository" %}
[Paste ACTUAL Repository protocol + implementation]
{% endtab %}
{% tab title="Coordinator" %}
[Paste an ACTUAL Coordinator]
{% endtab %}
{% endtabs %}

### Dependency Injection

[How Factory DI works in this project. Show the container registration and @Injected usage with real code.]

## Backend Architecture

### Layers

| Layer | Folder | Responsibility |
|-------|--------|---------------|
| API | `backend/app/api/` | Route handlers, request validation, response serialization |
| Services | `backend/app/services/` | Business logic, orchestration |
| Repositories | `backend/app/db/repositories/` | Database queries |
| Models | `backend/app/db/models/` | SQLAlchemy ORM models |
| AI/ML | `backend/app/intelli/` | LLM integration, prompt engineering |

### Request Lifecycle

```
HTTP Request
  → CORS middleware
  → Auth middleware (verify JWT/Firebase token)
  → Route handler (validate request, call service)
  → Service (business logic, orchestration)
  → Repository (database query)
  → Response serialization (Pydantic model → JSON envelope)
```

### Key Patterns with Real Code

{% tabs %}
{% tab title="Route Handler" %}
[Paste an ACTUAL route handler]
{% endtab %}
{% tab title="Service" %}
[Paste an ACTUAL service method]
{% endtab %}
{% tab title="SQLAlchemy Model" %}
[Paste an ACTUAL model]
{% endtab %}
{% tab title="Celery Task" %}
[Paste an ACTUAL background task]
{% endtab %}
{% endtabs %}

## Technology Stack

{% tabs %}
{% tab title="iOS" %}
| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
[Full table from Podfile/Package.swift research]
{% endtab %}
{% tab title="Backend" %}
| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
[Full table from pyproject.toml research]
{% endtab %}
{% tab title="Infrastructure" %}
| Service | Provider | Purpose |
|---------|----------|---------|
[Full table of cloud services, databases, etc.]
{% endtab %}
{% endtabs %}

---

===FILE: setup/environments.md===

# Environments

## Environment Matrix

| Attribute | Development | Staging | Production | Sandbox |
|-----------|-------------|---------|------------|---------|
| iOS Scheme | [from xcconfig] | [from xcconfig] | [from xcconfig] | - |
| Bundle ID | [from xcconfig] | [from xcconfig] | [from xcconfig] | - |
| API Base URL | localhost:8000 | [staging URL] | [prod URL] | [sandbox URL] |
| Database | Local Docker | [staging DB] | [prod DB] | [sandbox DB] |
| Redis | Local Docker | [staging] | [prod] | - |
| Celery Workers | Local process | [staging count] | [prod count] | - |
| LLM Provider | [dev config] | [staging config] | [prod config] | Mock data |
| SSL Pinning | Disabled | Enabled | Enabled | - |

## iOS Environment Configuration

| Scheme | Bundle ID | API Host | Purpose |
|--------|-----------|----------|---------|
[From CLAUDE.md and xcconfig files]

{% hint style="info" %}
Always use **iPhone 17 Pro** simulator for builds.
{% endhint %}

### Switching Environments
[How to switch between schemes in Xcode]

## Backend Environment Configuration

### Required Environment Variables

| Variable | Description | Example Format | Required |
|----------|-------------|----------------|----------|
[EVERY env var from .env.example - no actual values, just format examples like "sk-..." or "postgresql://user:pass@host/db"]

### Local Development Setup
```bash
# Start local services
docker-compose up -d

# Verify services
docker-compose ps
```

## API Base URLs

| Environment | URL | Auth Required | Notes |
|-------------|-----|--------------|-------|
[All URLs from APICONTRACTS.md]

---

===FILE: setup/monitoring.md===

# Monitoring & Logging

## Health Checks

| Endpoint | Method | Expected Response | Purpose |
|----------|--------|-------------------|---------|
[All health endpoints from research]

## iOS Monitoring

### Crashlytics (Firebase)
- **What it captures**: Crashes, non-fatal errors, ANRs
- **Dashboard**: [Firebase Console URL pattern]
- **Setup**: [How Crashlytics is initialized - reference actual code file]

### Analytics
[What analytics events are tracked, where they're defined]

## Backend Logging

### Log Configuration
[Where logging is configured, log format, log levels]

### Log Locations

| Environment | Location | Retention | Access |
|-------------|----------|-----------|--------|
| Development | stdout (console) | Session | Terminal |
| Staging | [cloud logging service] | [retention] | [how to access] |
| Production | [cloud logging service] | [retention] | [how to access] |

### Useful Log Queries

<details>
<summary>Find errors in the last hour</summary>

```
[actual log query syntax for the logging platform used]
```
</details>

<details>
<summary>Track a specific request</summary>

```
[actual log query]
```
</details>

## Alerting

[Document what alerting exists or should exist based on research]

| Condition | Severity | Action |
|-----------|----------|--------|
| API 5xx error rate > 5% | Critical | [response procedure] |
| Celery queue depth > 100 | Warning | Scale workers |
| Database connections > 80% | Warning | Check for connection leaks |
| SSL certificate expiry < 30 days | Warning | Begin certificate rotation |

---

===FILE: setup/failure-modes.md===

# Failure Modes & Recovery

## Failure Scenarios

### API Unavailable

{% hint style="danger" %}
Impact: Users cannot use the app. All features require API connectivity.
{% endhint %}

**Diagnosis:**
```bash
# Check if API is responding
curl -v [health endpoint]

# Check Cloud Run status (if applicable)
[cloud provider status command]

# Check recent deployments
[deployment log command]
```

**Recovery:**
{% stepper %}
{% step %}
### Check service status
[Commands to check if the service is running]
{% endstep %}
{% step %}
### Check logs for errors
[Commands to view recent error logs]
{% endstep %}
{% step %}
### Rollback if recent deploy
[Rollback commands]
{% endstep %}
{% step %}
### Verify recovery
[Health check commands]
{% endstep %}
{% endstepper %}

### Database Connection Failure
[Same structure: hint with impact, diagnosis commands, recovery stepper]

### AI/LLM Service Down
[Same structure - note: app should degrade gracefully if AI service configured with fallbacks]

### Celery Workers Not Processing
[Same structure]

### Redis Cache Down
[Same structure]

### Certificate Pinning Failure (iOS)

{% hint style="warning" %}
Certificate rotation requires a coordinated iOS app update. Plan at least 2 weeks ahead.
{% endhint %}

[Document the certificate rotation procedure from LEARNINGS.md]

## Deployment & Rollback

### Backend Deployment

{% stepper %}
{% step %}
### Deploy to Staging
[Exact deployment commands/process from research]
{% endstep %}
{% step %}
### Verify Staging
```bash
curl [staging health endpoint]
# Run smoke tests if available
```
{% endstep %}
{% step %}
### Deploy to Production
[Exact production deployment commands]
{% endstep %}
{% step %}
### Post-Deploy Verification
[What to check: health endpoint, error rate, key user flows]
{% endstep %}
{% endstepper %}

### Backend Rollback
```bash
[Exact rollback commands]
```

### iOS Deployment
[Build → TestFlight → App Store process from research]

## Operational Runbooks

<details>
<summary>Clear Redis Cache</summary>

```bash
[Exact commands]
```
</details>

<details>
<summary>Scale Celery Workers</summary>

```bash
[Exact commands]
```
</details>

<details>
<summary>Run Database Migration</summary>

```bash
[Exact commands]
```
</details>

<details>
<summary>Purge Failed Celery Tasks</summary>

```bash
[Exact commands]
```
</details>

<details>
<summary>Rotate SSL Certificate</summary>

[Step-by-step from LEARNINGS.md SSL section]
</details>

<details>
<summary>Rotate Secrets</summary>

| Secret | Location | Rotation Steps |
|--------|----------|---------------|
[Table from research - NO actual values]
</details>

## Security Incident Response

{% stepper %}
{% step %}
### Detect & Assess
- Check monitoring dashboards for anomalies
- Review access logs for unauthorized access
- Determine scope: what data/systems are affected?
{% endstep %}
{% step %}
### Contain
- Rotate compromised credentials immediately
- Revoke affected API keys/tokens
- If needed, disable affected endpoints
{% endstep %}
{% step %}
### Recover
- Deploy patched code
- Verify fix with monitoring
- Restore from backup if data affected
{% endstep %}
{% step %}
### Post-Mortem
- Document: timeline, root cause, impact, remediation
- Update monitoring/alerting to catch similar incidents
- Review and update security procedures
{% endstep %}
{% endstepper %}

OUTPUT: Five complete markdown files, clearly separated with ===FILE: path=== headers.
```

---

### Writer Agent 9: Codebase Section (4 pages)

```
subagent_type: general-purpose
max_turns: 20

Prompt:
You are writing the Codebase section of project documentation. This answers "How do I work in this code?" Write for engineers who will be reading and modifying code daily. Be precise, use real code, show real file paths.

ALL RESEARCH DATA:
${ALL_PHASE_2_OUTPUTS}

INTERVIEW NOTES:
${INTERVIEW_NOTES}

EXISTING READMES:
${EXISTING_READMES}

Write FOUR complete GitBook-compatible markdown files:

===FILE: codebase/README.md===

# Repository Structure

## Directory Layout

```
[Actual top-level directory tree from research, with descriptions]
├── Nouri/                    # iOS app source code
│   ├── Presentation/         # UI layer: Coordinators, Scenes (Views + ViewModels)
│   ├── Domain/               # Business logic: UseCases, Entities, Abstractions
│   ├── Data/                 # Data layer: Repositories, Networking, Mappers
│   └── ...
├── NouriTests/               # iOS unit tests
├── backend/                  # Python FastAPI backend
│   ├── app/
│   │   ├── api/              # Route handlers
│   │   ├── services/         # Business logic
│   │   ├── db/               # Models, repositories, migrations
│   │   └── intelli/          # AI/ML pipeline
│   └── tests/
├── spec/                     # iOS specifications
├── backend/spec/             # Backend specifications
└── ...
```

## Key Files

| File | Purpose |
|------|---------|
[Table of the most important files a new engineer should know about: entry points, config, DI containers, main routers, etc.]

## Code Conventions

### iOS

| Convention | Pattern | Example |
|-----------|---------|---------|
| ViewModels | `@MainActor` class with `async` methods | [actual class name] |
| Repositories | Protocol in Domain + Implementation in Data | [actual protocol name] |
| UseCases | Single `execute()` returning `Result<T, Error>` | [actual use case name] |
| DI | `@Injected(\.propertyName)` via Factory | See [container file path] |
| Naming | Features in `Presentation/Scenes/[Feature]/` | [actual example] |

### Backend

| Convention | Pattern | Example |
|-----------|---------|---------|
| Routes | FastAPI router with typed params | [actual route file] |
| Services | Class with `async` methods | [actual service file] |
| Models | SQLAlchemy 2.0 declarative | [actual model file] |
| Type hints | Always required | PEP 8 compliant |
| API style | snake_case endpoints | `/api/v1/meal_tracking` |

### Git Workflow

[Branch naming, commit message conventions, PR process - from research or interview]

## Adding a New Feature

{% stepper %}
{% step %}
### Plan
- Read relevant `spec/SPEC.md` section
- Check `spec/ARCHITECTURE.md` for existing patterns
{% endstep %}
{% step %}
### iOS Implementation
1. Create Entity in `Domain/Entities/`
2. Create Repository protocol in `Domain/Abstractions/`
3. Create UseCase in `Domain/UseCases/`
4. Create Repository implementation in `Data/Repositories/`
5. Create ViewModel in `Presentation/Scenes/[Feature]/`
6. Create View in `Presentation/Scenes/[Feature]/`
7. Register in Factory DI container
{% endstep %}
{% step %}
### Backend Implementation
1. Create/update SQLAlchemy model in `app/db/models/`
2. Create database migration
3. Create repository in `app/db/repositories/`
4. Create service in `app/services/`
5. Create route handler in `app/api/`
6. Add route to router
{% endstep %}
{% step %}
### Test & Document
1. Write tests (iOS: NouriTests/, Backend: tests/)
2. Update `spec/SPEC.md` or `backend/spec/SPEC.md`
3. Update `spec/ARCHITECTURE.md` if new patterns introduced
4. Update `spec/LEARNINGS.md` with any gotchas discovered
{% endstep %}
{% endstepper %}

---

===FILE: codebase/models-and-code.md===

# Models & Code

## Database Schema

### Tables Overview

| Table | Rows Managed By | Purpose |
|-------|----------------|---------|
[EVERY table from research with its purpose]

### Entity Relationship Summary

[Group related tables and describe their relationships:]

**User Domain:**
- `users` → `user_profiles` (1:1)
- `users` → `user_settings` (1:1)
- `users` → `user_goals` (1:many)
- `users` → `user_preferences` (1:1)
[...continue for all tables]

### Table Definitions

[For EVERY table, create a subsection:]

#### `table_name`

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
[All columns from model research]

**Foreign Keys:** [list]
**Indexes:** [list if found]

[Repeat for every table - do not skip any]

## iOS Code Architecture

### Module Map

| Module | Path | Key Files | Description |
|--------|------|-----------|-------------|
[Every feature/module with its folder path and key files]

### Authentication Flow

```
[Trace the actual auth flow from research:]
App Launch
  → Check Keychain for stored tokens
  → If valid: navigate to main app
  → If expired: refresh via Firebase
  → If no token: show login screen

Login (Email/Password):
  → FirebaseAuth.signIn()
  → Get Firebase ID token
  → POST /api/v1/auth/login with Firebase token
  → Receive JWT access + refresh tokens
  → Store in Keychain via Keychain.tokens
  → Navigate to main app

Token Refresh:
  → Alamofire authenticator intercepts 401
  → POST /api/v1/auth/refresh with refresh token
  → Store new tokens
  → Retry original request
```

### Networking Layer

[Document the actual networking setup: APIClient → APIConfiguration → Alamofire session → SSL pinning → error handling. Reference actual file paths.]

## Backend Code Architecture

### Service Map

| Service | Path | Key Methods | Dependencies |
|---------|------|-------------|-------------|
[Every service from research]

### AI/ML Pipeline

[Document the LLM integration architecture:]
- Models used: [list from research with purpose]
- Prompt patterns: [how prompts are structured]
- Task processing: [Celery flow for async AI tasks]
- Fallback strategy: [what happens when LLM fails]

## Troubleshooting & Gotchas

{% hint style="warning" %}
These are real issues encountered during development. Read before debugging.
{% endhint %}

### iOS Gotchas

[Extract EVERY item from spec/LEARNINGS.md and format as problem/solution pairs:]

<details>
<summary>[Gotcha title from LEARNINGS.md]</summary>

**Problem:** [description]
**Solution:** [what to do]
**File:** [relevant file path]
</details>

[Repeat for each gotcha]

### Backend Gotchas

[Extract EVERY item from backend/spec/LEARNINGS.md:]

<details>
<summary>[Gotcha title]</summary>

**Problem:** [description]
**Solution:** [what to do]
**File:** [relevant file path]
</details>

[Repeat for each gotcha - there are 29+ items, include ALL of them]

---

===FILE: codebase/testing.md===

# Testing & Validation

## iOS Tests

### Running Tests

```bash
xcodebuild test -scheme Nouri-DEV -destination 'platform=iOS Simulator,name=iPhone 17 Pro'
```

### Test Structure

```
NouriTests/
[Actual directory tree from research]
```

### Test Patterns

[Show actual test code from research:]

{% tabs %}
{% tab title="Unit Test" %}
```swift
[Actual unit test example]
```
{% endtab %}
{% tab title="Mock Setup" %}
```swift
[Actual mocking pattern]
```
{% endtab %}
{% endtabs %}

### Writing a New iOS Test
[Step-by-step following existing patterns]

## Backend Tests

### Running Tests

```bash
cd backend
[exact test command - pytest or similar]
```

### Test Structure

```
backend/tests/
[Actual directory tree from research]
```

### Test Patterns

{% tabs %}
{% tab title="Integration Test" %}
```python
[Actual integration test example]
```
{% endtab %}
{% tab title="Unit Test" %}
```python
[Actual unit test example]
```
{% endtab %}
{% tab title="Fixtures" %}
```python
[Actual fixture/factory example]
```
{% endtab %}
{% endtabs %}

### Writing a New Backend Test
[Step-by-step following existing patterns]

## CI/CD Validation

[What automated checks run on PR/push:]

| Check | Trigger | What It Validates | Blocking? |
|-------|---------|-------------------|-----------|
| SwiftLint | iOS build | Code style | Yes |
| [other checks from research] | | | |

## Spec Tracking (Required)

{% hint style="danger" %}
Every code change MUST update specification files. This is a hard requirement from CLAUDE.md.
{% endhint %}

| Change Type | Update spec/SPEC.md | Update spec/ARCHITECTURE.md | Update spec/LEARNINGS.md |
|-------------|--------------------|-----------------------------|--------------------------|
[Table from CLAUDE.md's "Required Updates After Code Changes"]

---

===FILE: codebase/api-reference.md===

# API Reference

## Interactive Documentation

{% hint style="info" %}
For the full interactive API reference with "Try it" functionality, see the [OpenAPI specification](../api-reference/openapi.yaml).
{% endhint %}

## Base URLs

| Environment | URL |
|-------------|-----|
[From APICONTRACTS.md]

## Authentication

[Document each auth method with actual curl examples:]

{% tabs %}
{% tab title="Email/Password (JWT)" %}
```bash
# Step 1: Login
curl -X POST [base]/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "..."}'

# Response: {"data": {"access_token": "...", "refresh_token": "..."}}

# Step 2: Use token
curl [base]/users/me \
  -H "Authorization: Bearer <access_token>"
```
{% endtab %}
{% tab title="Firebase" %}
```bash
# Step 1: Get Firebase token via Firebase SDK
# Step 2: Exchange for API token
curl -X POST [base]/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Token-Type: firebase" \
  -d '{"token": "<firebase_id_token>"}'
```
{% endtab %}
{% tab title="Magic Link" %}
```bash
# Step 1: Request magic link
curl -X POST [base]/auth/magic-link \
  -d '{"email": "user@example.com"}'

# Step 2: User clicks email link
# Step 3: Exchange code for token
curl -X POST [base]/auth/magic-link/verify \
  -d '{"code": "<code_from_email>"}'
```
{% endtab %}
{% endtabs %}

## Response Format

### Success Envelope
```json
{
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO-8601"
  }
}
```

### Paginated Response
```json
{
  "data": [ ... ],
  "meta": {
    "cursor": "opaque-cursor-string",
    "has_more": true,
    "total": 42
  }
}
```

### Error Response
```json
{
  "error": {
    "code": "CATEGORY/SPECIFIC",
    "message": "Human-readable description",
    "details": { "field": "error details" }
  }
}
```

## Endpoint Quick Reference

[Complete table of ALL endpoints:]

| Method | Path | Auth | Description |
|--------|------|------|-------------|
[EVERY endpoint from research, grouped by domain]

**Auth**
| POST | /auth/login | No | Authenticate user |
| POST | /auth/refresh | No | Refresh access token |
[...etc for every domain...]

OUTPUT: Four complete markdown files, clearly separated with ===FILE: path=== headers.
```

---

## Phase 4: Parallel Review (3 Subagents)

**CRITICAL: Launch ALL 3 in a SINGLE message with multiple Task tool calls.**

Each reviewer receives ALL Phase 3 writer outputs.

---

### Review Agent 10: Accuracy & Completeness

```
subagent_type: general-purpose
max_turns: 15

Prompt:
You are a documentation reviewer. Cross-check the documentation against the original research data and existing docs.

DOCUMENTATION TO REVIEW:
${ALL_PHASE_3_OUTPUTS}

ORIGINAL RESEARCH DATA:
${ALL_PHASE_2_OUTPUTS}

EXISTING DOCUMENTATION:
${EXISTING_DOCS}

CHECK:

1. **Every claim has evidence**: Cross-reference file paths, endpoint names, table names, technology versions against research. Flag anything that was fabricated or assumed.

2. **Nothing was missed**:
   - Every API endpoint from research appears in the endpoint table
   - Every database table from research has a definition
   - Every feature from SPEC.md is mentioned
   - Every LEARNINGS.md gotcha is included
   - All third-party services are listed
   - All environment variables are documented

3. **No contradictions**:
   - Between overview/setup/codebase sections
   - Between this documentation and existing README.md files
   - Between architecture descriptions and actual code structure

4. **Placeholder audit**: Find EVERY instance of [UNKNOWN, [NEEDS, [TODO, [INSERT, [TBD, [PLACEHOLDER, or template instructions that weren't replaced (e.g., "[Paste an ACTUAL"). For each, either provide the correct value from research or confirm it's genuinely unknown.

OUTPUT:
## Corrections Needed
[Table: Location | Issue | Fix]

## Missing Content
[Table: Section | What's Missing | Source Data Reference]

## Contradictions Found
[Table: Location 1 | Location 2 | Resolution]

## Placeholder Resolutions
[Table: Location | Current Text | Replacement]

## Confirmed Unknown
[Table: Location | Item | Why Unknown]
```

---

### Review Agent 11: Security Scan

```
subagent_type: general-purpose
max_turns: 10

Prompt:
You are a security reviewer scanning documentation before publication.

DOCUMENTATION TO REVIEW:
${ALL_PHASE_3_OUTPUTS}

SCAN FOR:

1. **Leaked secrets**: API keys, passwords, tokens, connection strings with credentials, private keys. Check every code block and config example.
2. **Internal URLs**: Private IPs, internal hostnames, admin panel URLs that shouldn't be public.
3. **Personally identifiable information**: Real user emails (except obvious test accounts like admin@sfailabs.com), real names, phone numbers.
4. **Overstated security claims**: Claims about encryption, compliance, or security measures that may not be implemented. Cross-reference against the research data.
5. **Dangerous commands**: Commands that could be destructive if copy-pasted without context (e.g., DROP TABLE, rm -rf). Ensure they have appropriate warnings.
6. **Debug/test endpoints**: Endpoints that should not be publicly documented (debug routes, admin backdoors).

OUTPUT:
## MUST FIX (Security)
[Table: Location | Issue | Fix Required]

## SHOULD FIX (Best Practice)
[Table: Location | Issue | Suggested Fix]

## VERIFIED SAFE
[List of areas checked and confirmed clean]
```

---

### Review Agent 12: Placeholder Resolution & GitBook Validation

```
subagent_type: Explore
max_turns: 30

Prompt:
You are a documentation finisher. Your job is to find every unresolved placeholder and resolve it by reading the actual codebase. You also validate GitBook syntax.

DOCUMENTATION TO REVIEW:
${ALL_PHASE_3_OUTPUTS}

TASKS:

1. **Find ALL unresolved placeholders**: Search the documentation text for:
   - Square bracket patterns: [UNKNOWN, [NEEDS, [TODO, [TBD, [INSERT, [PLACEHOLDER, [actual, [Actual, [Paste, [from, [e.g.
   - Ellipsis patterns: "...", "etc.", "[...]"
   - Template instructions that weren't executed: anything that reads like a writing instruction rather than documentation

2. **Resolve each one**: For each placeholder found, search the actual codebase:
   - Use Glob to find relevant files
   - Use Grep to search for specific values
   - Use Read to get the actual content
   - Provide the exact replacement text

3. **Validate GitBook syntax**:
   - Every `{% hint %}` has a matching `{% endhint %}`
   - Every `{% tabs %}` has matching `{% endtabs %}` with at least one `{% tab %}`/`{% endtab %}`
   - Every `{% stepper %}` has matching `{% endstepper %}` with `{% step %}`/`{% endstep %}`
   - No nested blocks that GitBook doesn't support (tabs in tabs, steppers in steppers)
   - All markdown tables have consistent column counts
   - All code blocks have language tags
   - All internal links point to files that exist in the output structure

OUTPUT:
## Resolved Placeholders
[Table: File | Section | Original | Replacement]

## Unresolvable
[Table: File | Section | Original | Why]

## GitBook Syntax Fixes
[Table: File | Section | Issue | Fix]
```

---

## Phase 5: Assembly & Output

### Step 1: Apply Reviews

Apply feedback in this order (security first):
1. Fix ALL security issues from Agent 11 (non-negotiable)
2. Apply corrections from Agent 10
3. Replace placeholders from Agent 12
4. Apply GitBook syntax fixes from Agent 12

### Step 2: Create Directory Structure

```bash
mkdir -p docs/{overview,setup,codebase,api-reference,.gitbook/assets}
```

### Step 3: Write `.gitbook.yaml`

```yaml
root: ./

structure:
  readme: README.md
  summary: SUMMARY.md
```

### Step 4: Write `SUMMARY.md`

```markdown
# Table of Contents

## Overview

* [Value Delivered](overview/README.md)
* [Examples](overview/examples.md)
* [Cost & Performance](overview/cost-and-performance.md)

## Setup

* [Quick Setup](setup/README.md)
* [Architecture & Tech Stack](setup/architecture.md)
* [Environments](setup/environments.md)
* [Monitoring & Logging](setup/monitoring.md)
* [Failure Modes & Recovery](setup/failure-modes.md)

## Codebase

* [Repository Structure](codebase/README.md)
* [Models & Code](codebase/models-and-code.md)
* [Testing & Validation](codebase/testing.md)
* [API Reference](codebase/api-reference.md)

## API

* [Interactive API Reference](api-reference/openapi.yaml)
```

### Step 5: Write Landing `README.md`

```markdown
# [Project Name] Documentation

[One-paragraph description of the product from overview research]

{% hint style="info" %}
Choose your starting point:
{% endhint %}

| Section | Start Here If You... |
|---------|---------------------|
| [Overview](overview/README.md) | Want to understand what this product does and why |
| [Setup](setup/README.md) | Need to get the project running locally |
| [Codebase](codebase/README.md) | Are about to start writing code |
| [API Reference](api-reference/openapi.yaml) | Need to integrate with our API |

## Quick Links

- **New here?** Start with [Value Delivered](overview/README.md) then [Quick Setup](setup/README.md)
- **Writing code?** See [Repository Structure](codebase/README.md) and [Models & Code](codebase/models-and-code.md)
- **Deploying?** See [Failure Modes & Recovery](setup/failure-modes.md)
- **Debugging?** Check [Models & Code → Troubleshooting](codebase/models-and-code.md#troubleshooting--gotchas)
- **API integration?** See [Interactive API Reference](api-reference/openapi.yaml)
```

### Step 6: Write All Pages

Write each file from the writer agents' outputs with all review corrections applied:
- `docs/overview/README.md`
- `docs/overview/examples.md`
- `docs/overview/cost-and-performance.md`
- `docs/setup/README.md`
- `docs/setup/architecture.md`
- `docs/setup/environments.md`
- `docs/setup/monitoring.md`
- `docs/setup/failure-modes.md`
- `docs/codebase/README.md`
- `docs/codebase/models-and-code.md`
- `docs/codebase/testing.md`
- `docs/codebase/api-reference.md`
- `docs/api-reference/openapi.yaml`

### Step 7: Final Verification

Run these checks before completing:

```
1. Every file in SUMMARY.md exists on disk
2. No placeholder text remains:
   Grep: \[UNKNOWN|\[NEEDS|\[TODO|\[INSERT|\[TBD|\[PLACEHOLDER|\[Paste|\[Actual in docs/
3. No secrets in output:
   Grep: sk-|password=|token=|secret=|apikey= in docs/ (excluding obvious example patterns)
4. GitBook syntax valid:
   Grep: {% (hint|tabs|tab|stepper|step) without matching end tags
5. All internal markdown links resolve to existing files
6. OpenAPI YAML is valid (try parsing with Python yaml module if available)
```

### Step 8: Display Summary

```
Documentation generated.

Location: docs/
Pages: 13 content pages + 1 OpenAPI spec

  overview/        Value Delivered, Examples, Cost & Performance
  setup/           Quick Setup, Architecture, Environments, Monitoring, Failure Modes
  codebase/        Repository Structure, Models & Code, Testing, API Reference
  api-reference/   Interactive OpenAPI 3.0 specification

Review results applied:
  Accuracy corrections: [N]
  Security fixes: [N]
  Placeholders resolved: [N] of [M]

Remaining [UNKNOWN] items: [N] (require manual verification)

Next steps:
  1. Review docs/ for accuracy
  2. Connect to GitBook via Git Sync (Settings → Git Sync → select docs/ folder)
  3. Resolve any remaining [UNKNOWN] items
```

---

## Quality Self-Check

Before delivering, verify:

- [ ] **All 6 research agents** ran and their data was used by writers
- [ ] **All 3 writer agents** produced complete page content
- [ ] **All 3 review agents** ran and their feedback was applied
- [ ] **Overview section** is understandable by a non-technical person
- [ ] **Setup section** has copy-pasteable commands that actually work
- [ ] **Codebase section** includes real code from the repository (not pseudocode)
- [ ] **API reference** has a valid OpenAPI 3.0 spec for GitBook interactive mode
- [ ] **No secrets** appear anywhere in the output
- [ ] **No contradictions** with existing README.md or spec files
- [ ] **SUMMARY.md** matches actual file structure exactly
- [ ] **GitBook template tags** are all properly opened and closed
- [ ] **Every `[UNKNOWN]` marker** is genuinely unknown (not just lazy)

---

## Integration

**Before:**
- `/interview-me` (invoked automatically in Phase 1)

**After:**
- Connect `docs/` to GitBook via Git Sync
- Resolve remaining `[UNKNOWN]` items manually
- Re-run periodically (e.g., each major release) to keep docs current

**Tips:**
- Best results when the codebase has existing `spec/` files and README.md files
- If interview is skipped, Overview section will lack business context
- If no `APICONTRACTS.md` exists, OpenAPI spec will be generated from route analysis (less accurate)
- If deployment config isn't in the repo, Setup section will have more `[UNKNOWN]` items

$ARGUMENTS
