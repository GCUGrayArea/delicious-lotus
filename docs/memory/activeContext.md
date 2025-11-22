# Active Context - Current Work Focus

**Purpose:** What's happening right now, recent changes, current focus areas.

**Last Updated:** 2025-11-22 by ProductionFix (Critical 500 Error Fix)
**Last Updated:** 2025-11-22 by ArchitectureFix (API Architecture Repair)

---

## Current Sprint Focus

**Phase:** MVP Completion & Polish
**Timeline:** MVP deadline approaching (48 hours total)
**Active Agents:** ProductionFix, ArchitectureFix, Orange

---

## In-Flight Work

### Just Completed
- ✅ **Fix 500 Error on Generation**: Resolved critical 500 error in `POST /generations`. Instead of crashing, the system now explicitly checks for the OpenAI API key and returns a user-friendly 503 error if it's missing, preventing confusing 500 errors.
- ✅ **Enable Video Generation**: Re-enabled video generation flag which was set to `False` for debugging.
- ✅ **Infrastructure Repair**: Eliminated internal network calls to `localhost` that were failing in deployed environments.
- ✅ **Architecture**: Moved video generation logic from `src/app/api/v1/replicate.py` to `src/fastapi_app/services/replicate_service.py`.
- ✅ **Fix Video Generation Pipeline**: Connected frontend "Generate" button to advanced AI pipeline.

### Ready to Start
**AI**
- 🎯 **Block 0 PR 3: Generation Lifecycle API Skeleton** (4-5h) - UNBLOCKED
- 🎯 PR-D003: Storage Documentation (1h)
- 🎯 PR-D005: Environment Config Templates (2h)
- 🎯 PR-D009: Deployment Documentation (2h)
- 🎯 PR-F002: Design System Foundation (3h) - dependencies met
- 🎯 PR-F003: API Client Setup (2h) - dependencies met
- 🎯 PR-F016: User Documentation (2h)

### Blocked & Waiting
- ⏸️ PR-D002: Backend Docker Container (waiting for backend team's FastAPI structure)
- ⏸️ PR-D004-D008: DevOps PRs blocked by PR-D002 or user AWS setup
- ⏸️ PR-F004-F015: Frontend PRs blocked by PR-F003, PR-F004, or PR-F005
- ⏸️ User AWS setup tasks (Tasks 2, 4, 5)

---

## Recent Decisions

1. **Secrets Management: Environment Variables as SSOT** (2025-11-22)
   - **Decision:** Removed API keys (`openai_api_key`, `replicate_api_token`) from `terraform.tfvars` and configured `deploy.sh` to read them from local `.env` files and pass them as `TF_VAR_` environment variables.
   - **Context:** Hardcoded keys in `terraform.tfvars` were taking precedence over `.env` files, causing persistent auth errors even when `.env` was updated.
   - **Rationale:** Enforces Single Source of Truth (SSOT) pattern using `.env` files, prevents accidental commit of secrets in `tfvars`, and resolves confusion about which key is being used.

2. **Explicit Configuration Error** (2025-11-22)
   - **Decision:** If prompt analysis (OpenAI) fails due to missing configuration, raise an explicit 503 error with a user-friendly message instead of falling back.
   - **Context:** Users need to be informed if the server is misconfigured (missing keys) rather than getting a degraded "fallback" experience silently.
   - **Rationale:** Clarity for end-users and administrators; "fail fast" behavior is preferred over silent degradation for configuration issues.

2. **Decouple Modern/Legacy APIs** (2025-11-22)
   - **Decision:** Move Replicate interaction logic into a shared service (`ReplicateService`) rather than having the Modern API make HTTP calls to the Legacy API.
   - **Context:** Internal HTTP calls to `localhost` were failing in deployed environments, causing 500 errors.
   - **Rationale:** Simplifies architecture, removes network dependency for internal logic, and robustifies deployment.

3. **Real-time Clip Broadcasting** (2025-11-22)
   - **Decision:** Broadcast `clip_completed` events to `generation:{id}` WebSocket channel in addition to job-specific channels.
   - **Context:** Frontend Info Board listens to generation-level updates, but backend was only sending low-level job updates.
   - **Rationale:** Enables granular, real-time UI updates as each video clip finishes, without full page refresh.

---

## Current Questions & Blockers

### Resolved
- ✅ **500 Error on Generation** -> Fixed by explicit key check and enabling video generation flag.
- ✅ **Stuck Generations** -> Fixed by Replicate resolution fix and self-healing logic.
- ✅ **Missing Real-time Updates** -> Fixed by broadcasting to correct WebSocket channel.
- ✅ **Empty History List** -> Fixed by merging in-memory and DB results.
- ✅ **Crash in Generation History page** -> Fixed by mapping `id` to `generation_id`.

### Open
- How aggressively should we rely on database/Redis vs in-memory fallbacks for local development when Postgres schema is out of sync? (Current approach: aggressive fallback to in-memory for UX safety).

---

## Next Up (After Current PRs)

**DevOps:**
- PR-D003: Storage Documentation
- PR-D009: Deployment Documentation

**Frontend:**
- PR-F003: API Client
- PR-F005: Routing/Layout

---

## Communication Log

**2025-11-22** - ProductionFix: Resolved critical 500 error on generation endpoint. Replaced silent fallback with an explicit 503 error message when OpenAI keys are missing, ensuring users are informed of configuration issues. Also enabled video generation in production.
**2025-11-22** - ArchitectureFix: Fixed critical 500 error on deployment by decoupling the modern `fastapi_app` from the legacy `app`. Moved generation logic to `ReplicateService` to eliminate internal network calls that were failing in production.
**2025-11-22** - Agent: Connected generation workflow, fixed Replicate API integration, implemented self-healing for stuck jobs, and enabled real-time clip updates on frontend.
