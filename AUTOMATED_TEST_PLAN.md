# Pickleball MVP Automated Test Plan

## 1. Objective

This automated test plan provides broad and deep coverage for the pickleball MVP while staying grounded in practical product risk: if users cannot trust session status in real time, they will abandon the app and return to WhatsApp-only coordination.

The plan is intentionally expansive so the project can scale from MVP to stable ongoing use without rewriting test strategy. It covers unit, integration, end-to-end, webhook simulation, and lightweight load testing, with CI/CD automation in GitHub Actions.

## 2. Testing Strategy Principles

- Prioritize correctness of session and participant state transitions.
- Treat realtime consistency as a first-class requirement.
- Validate mobile-first UX flows in E2E suites.
- Keep test data deterministic and isolated.
- Ensure tests run fast enough for single-developer iteration.

## 3. Quality Risk Map

Highest-risk failure areas:
1. Duplicate or inconsistent participation status due to races.
2. Broken share/join link flow from WhatsApp context.
3. Stale or missing realtime updates on active session pages.
4. WhatsApp bot commands mutating wrong sessions or users.
5. Availability overlap logic producing wrong weekly patterns.

Test investment should mirror these risks.

## 4. Recommended Tooling

### Unit + integration
- Test runner: Vitest
- Assertions/mocks: Vitest built-ins + `@testing-library/*` for component-level behavior
- API/HTTP mocking: MSW (for controlled request simulation)

### E2E
- Playwright
- Projects for:
  - Mobile Safari-equivalent viewport
  - Android Chrome viewport
  - Desktop Chrome

### Load/concurrency
- k6 (or Artillery) for concurrent participant actions

### CI
- GitHub Actions
- Optional Supabase local stack or dedicated test project for integration tests

## 5. Test Pyramid and Coverage Targets

- Unit tests: 60-70% of test count, fastest feedback
- Integration tests: 20-30%, validates Supabase/API and webhook contracts
- E2E tests: 10-20%, validates real user-critical paths

Coverage targets (practical initial goals):
- Business logic modules: >= 90% line coverage
- API handlers/webhook parser: >= 85%
- UI components with branching logic: >= 75%

Coverage is a signal, not a goal by itself; correctness for key flows is non-negotiable.

## 6. Unit Test Plan

### 6.1 Session logic
Target modules:
- `src/lib/sessions.ts`
- session list filtering helpers
- code generation helpers

Test cases:
- Create payload validation rejects missing/invalid datetime.
- Session code generation produces expected format and uniqueness constraints handling.
- "Today" filter includes local-time relevant sessions correctly.
- Capacity display helpers return expected text (e.g., `6/8 confirmed`).
- Edge-case timezone boundaries around midnight are handled correctly.

### 6.2 Participant management
Target modules:
- status transition helpers
- dedupe guards
- roster grouping functions

Test cases:
- `join` inserts confirmed when absent.
- `maybe` inserts/updates correctly.
- `drop` removes entry.
- repeated `join` remains idempotent.
- status transitions `maybe -> confirmed -> maybe` produce single participant row semantics.
- roster grouping returns stable ordering and accurate counts.

### 6.3 Availability overlap detection
Target modules:
- `src/lib/availability.ts`

Test cases:
- Reject invalid windows (`start >= end`).
- Merge adjacent windows where intended.
- Handle non-overlapping windows per day.
- Normalize slot toggles into expected time ranges.
- Weekday boundaries are preserved.

### 6.4 Identity utilities
Target modules:
- `src/lib/identity.ts`

Test cases:
- Phone normalization handles common local formats to E.164 where possible.
- Local identity read/write safely handles malformed storage.
- Name/phone validation messages are clear and deterministic.

### 6.5 Command parsing for WhatsApp
Target modules:
- `src/lib/whatsapp/parseCommand.ts`

Test cases:
- Parse `/games` with extra spaces.
- Parse `/status abc123` and normalize code.
- Parse `/join` and `/drop` with argument enforcement.
- Return explicit errors for unknown commands and missing args.

## 7. Component Test Plan

Using React Testing Library:

### `CreateSessionModal`
- Opens/closes correctly.
- Form validation errors shown for invalid input.
- Submit callback receives normalized payload.

### `SessionCard`
- Displays time, note, headcount, and player names.
- Renders maybe list distinctly from confirmed.
- Handles empty note gracefully.

### `RosterList`
- Correct grouping by status.
- Empty states for no players/no maybes.
- Supports quick updates when props change.

### `AvailabilityGrid`
- Tap/click toggles slots.
- Save callback payload matches selected slots.
- Mobile layout remains usable in small viewport snapshot tests.

### `ShareButton`
- Uses `navigator.share` when available.
- Falls back to clipboard copy path.
- Error path shows user feedback.

## 8. Integration Test Plan

Integration tests validate interaction between app code and data/webhook boundaries.

### 8.1 Supabase query integration
Scope:
- session creation
- participant updates
- availability persistence

Approach:
- Use dedicated test schema or disposable test DB.
- Seed known fixtures for users/sessions.
- Verify DB constraints and returned payloads.

Cases:
- Creating session auto-adds creator as confirmed.
- duplicate participant insertion fails gracefully.
- dropping participant deletes row and updates counts.
- availability writes replace/merge expected rows.

### 8.2 Realtime subscription integration
Scope:
- `postgres_changes` event handling in client adapters

Approach:
- Simulate DB change events or use test channel with controlled inserts.

Cases:
- join action triggers local roster refresh.
- drop action triggers count decrement across subscribers.
- reconnect path resynchronizes correctly after temporary disconnect.

### 8.3 API route integration
Scope:
- Next.js route handlers (if used in app)

Cases:
- `POST /api/sessions` validates input and creates session.
- `POST /api/sessions/:id/participation` handles join/maybe/drop.
- invalid payload returns structured 4xx errors.

### 8.4 WhatsApp webhook integration
Scope:
- inbound payload parsing and command dispatch

Cases:
- `/games` returns formatted session summary.
- `/status` returns named roster sections.
- `/join` updates participant row for sender user.
- `/drop` removes sender from session.
- unregistered sender receives registration guidance.
- malformed payload does not crash handler.

## 9. End-to-End (Playwright) Plan

E2E tests should mirror the real product journey and run across target viewport profiles.

### 9.1 Project matrix
- `mobile-iphone` (e.g., iPhone 13 viewport + WebKit)
- `mobile-android` (Pixel viewport + Chromium)
- `desktop-chrome`

### 9.2 Critical flow E2E scenarios

#### E2E-01: Create -> Share -> Join -> Verify
1. User A completes identity.
2. User A creates same-day session.
3. Link is copied/shared.
4. User B opens join link and completes identity.
5. User B joins.
6. User A sees roster updated without refresh.

Assertions:
- Session exists and visible on home.
- Both names appear in confirmed roster.
- Headcount text matches roster length.

#### E2E-02: Maybe and Drop transitions
1. User C marks maybe.
2. User C moves to confirmed.
3. User C drops.

Assertions:
- User appears in correct section at each step.
- No duplicates across transitions.

#### E2E-03: Deep link handling
1. Visit `/join?code=<valid>`.
2. Confirm route resolves session and action controls.

Assertions:
- Valid code path works.
- Invalid code path renders fallback UI.

#### E2E-04: Availability set and reload
1. Open availability page.
2. Select recurring slots.
3. Save.
4. Reload.

Assertions:
- Selected slots persist.
- Save state feedback appears.

#### E2E-05: Creator drop resilience
1. Creator creates session then drops.
2. Another user joins.

Assertions:
- Session remains active.
- Join still possible.

### 9.3 Visual and responsiveness checks
- Confirm no clipped controls on narrow widths.
- Ensure action buttons remain visible above mobile keyboard interactions.

## 10. Load and Concurrency Testing

Load testing is small-scale but critical because same-day coordination can create bursts.

### 10.1 Primary load scenario
- 30 concurrent virtual users attempt `join` on one session within a few seconds.

Expected results:
- No duplicate participant rows.
- Request success rate >= 99%.
- p95 mutation latency within acceptable MVP range (e.g., < 800ms server-side).

### 10.2 Secondary scenario
- Mixed actions under concurrency: 15 join, 10 maybe, 5 drop.

Expected results:
- Final counts match deterministic expected state.
- No race-induced stale writes.

### 10.3 Realtime fan-out observation
- With 5-10 active listeners, ensure update latency remains practical.

## 11. WhatsApp Conversation Flow Tests

These tests simulate inbound webhook payload sequences.

### Conversation scenario A
1. Sender requests `/games`.
2. Sender requests `/status CODE`.
3. Sender sends `/join CODE`.
4. Sender sends `/status CODE` again.

Assertions:
- Response texts are coherent and consistent with state transitions.
- Joined sender appears in second status response.

### Conversation scenario B (error path)
1. Sender sends `/status` with no code.
2. Sender sends `/join BADCODE`.
3. Sender sends unknown command.

Assertions:
- Usage guidance returned for missing args.
- Unknown code clearly handled.
- Unknown command returns supported list.

### Conversation scenario C (unregistered sender)
1. Unknown phone sends `/games`.

Assertions:
- Bot prompts registration link and does not mutate data.

## 12. Test Data Strategy

- Use deterministic fixtures for users and sessions.
- Isolate tests by namespace/tagged session codes.
- Clean up created rows after tests (or use resettable test schema).
- Avoid sharing persistent mutable data across test jobs.

Recommended fixture sets:
- `users.fixture.json`
- `sessions.fixture.json`
- `participants.fixture.json`

## 13. CI/CD Pipeline (GitHub Actions)

### 13.1 Pipeline stages
1. `lint-and-typecheck`
2. `unit-tests`
3. `integration-tests`
4. `e2e-tests` (can be required on main, optional on every PR depending runtime budget)
5. `build`

### 13.2 Example workflow triggers
- On pull request to `main`
- On push to `main`
- Nightly scheduled run for deeper suite (load + expanded e2e)

### 13.3 Environment setup in CI
- Node LTS version pin
- Install dependencies with lockfile
- Provision test env vars
- Start local app server for E2E
- Optionally provision temporary Supabase test instance or use dedicated staging project

### 13.4 CI artifacts
- Test reports (JUnit/HTML)
- Playwright traces/videos on failures
- Coverage summary artifact

### 13.5 Merge gates
Require green status for:
- typecheck
- unit
- core integration
- core e2e smoke

Load tests can run nightly and gate only release tags.

## 14. Flake Management and Reliability

- Retry only at test-runner level for known transient network flakes, not for logic assertions.
- Tag flaky tests and require follow-up issue.
- Use deterministic clocks/mocks where possible.
- Keep each test independent; avoid hidden ordering dependencies.

## 15. Observability Hooks for Testing

Add lightweight test diagnostics:
- Structured logs for session mutation operations.
- Correlation IDs in webhook handling.
- Optional debug endpoint in non-production test env.

This improves failure triage speed without adding production overhead.

## 16. Security-Focused Automated Checks

Even for casual MVP, include basic guard tests:
- Reject malformed phone/name payloads.
- Ensure SQL constraints enforce dedupe.
- Confirm service-role keys are not exposed to client bundle.
- Validate webhook signature handling if provider supports it.

## 17. Performance Budgets in CI

Set practical thresholds:
- Home page render budget under controlled lab conditions.
- Session detail interaction budget for join/drop actions.
- Alert (not fail) when budgets regress by >20% initially.

As app matures, convert alerts to hard fails.

## 18. Release Certification Suite

Before production push, run a release candidate suite:
- Full unit + integration
- Full Playwright matrix
- WhatsApp webhook simulations
- 30-user concurrency load test

Pass criteria:
- Zero critical test failures
- No unresolved P0/P1 issues from automated results

## 19. Proposed Test File Layout

```text
tests/
  unit/
    sessions.test.ts
    participants.test.ts
    availability.test.ts
    identity.test.ts
    whatsapp-parse.test.ts
  component/
    CreateSessionModal.test.tsx
    SessionCard.test.tsx
    RosterList.test.tsx
    AvailabilityGrid.test.tsx
    ShareButton.test.tsx
  integration/
    supabase-sessions.test.ts
    supabase-participants.test.ts
    realtime-subscriptions.test.ts
    whatsapp-webhook.test.ts
  e2e/
    create-share-join.spec.ts
    status-transitions.spec.ts
    join-deeplink.spec.ts
    availability.spec.ts
    creator-drop.spec.ts
  load/
    join-concurrency.k6.js
```

## 20. Incremental Adoption Roadmap

To avoid blocking initial shipping:

Week 1 baseline:
- Unit tests for session and participant logic.
- One Playwright smoke test (`create -> join`).

Week 2 expansion:
- Availability unit/component tests.
- Integration tests for Supabase mutations.

Week 3 expansion:
- WhatsApp webhook integration suite.
- Concurrency/load scripts in CI nightly.

By end of week 3, the project has full-spectrum automated confidence.

## 21. Definition of Automated Testing Done

Automated testing is considered mature for MVP when:
- Core user path has stable E2E coverage across mobile and desktop viewports.
- Participant state transitions are protected by unit and integration tests.
- Realtime and webhook handling have dedicated integration tests.
- 30-concurrent-user join scenario is reproducibly tested.
- CI pipeline enforces minimum quality gates before merge/deploy.

This level of automation is enough to support ongoing real-world use by the Bay Padel group without frequent production regressions.
