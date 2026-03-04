# Pickleball Group MVP PRD

## 1. Product Overview

This product is a lightweight coordination tool for one real-world pickleball group: around 30 friends who play mostly at Bay Padel and currently coordinate in WhatsApp. The MVP solves a practical problem: fast same-day game coordination with clear visibility into who is in, who is maybe, and whether a session is worth showing up to.

This is not a marketplace, not a league platform, and not an enterprise scheduling system. It is a focused group utility meant to reduce chat noise, avoid confusion, and make it easier for anyone in the group to start a game.

Core user need in one sentence: "I want to quickly create or join a game, see exactly who is coming, and avoid long back-and-forth in WhatsApp."

## 2. Problem Statement

Current WhatsApp-only coordination has predictable issues:
- Signal gets buried in chat, especially on busy days.
- People reply in inconsistent formats ("in", "maybe", thumbs up, late reply), so headcount is fuzzy.
- Same-day planning needs fast certainty, but users waste time asking for status updates.
- Recurring patterns ("always free Thu evenings") are not captured in a reusable way.

The MVP should create a single shared source of truth for sessions while preserving WhatsApp as the social layer.

## 3. Goals and Success Criteria

### Primary goals
- Let any player create a session in under 30 seconds.
- Let any player join, mark maybe, or drop in under 10 seconds.
- Show names of participants (confirmed and maybe) in real time.
- Support both same-day sessions and recurring weekly availability.
- Keep entry friction very low (no password-based signup).

### Secondary goals
- Enable easy sharing back into WhatsApp.
- Provide bot-accessible status summaries for quick check-ins.

### Success criteria for MVP
- At least 80% of sessions are created by regular players (not just organizers).
- At least 90% of session participants are represented in-app roster, not only in chat.
- Group reports fewer manual "who's in?" status requests in WhatsApp.
- New player can join first session without account/password setup.

## 4. Users and Context

### User group
- One casual friend group (~30 people).
- One primary venue: Bay Padel.
- Same-day and near-term play is dominant behavior.

### User roles (informal, not permissioned)
- Session creator: any member who starts a game.
- Player: any member who joins or responds maybe.
- Status checker: any member who opens app or asks bot for status.

No admin panel is needed for MVP. Permissions are intentionally flat.

## 5. Product Scope

### In scope
- Session creation (date, time, optional note, optional cap such as 8 players).
- Session page with live roster by status: Confirmed / Maybe.
- Join / Maybe / Drop actions.
- Session sharing link optimized for WhatsApp posting.
- Home view emphasizing today's sessions.
- Recurring availability templates by weekday and time windows.
- Lightweight identity using name + phone (or group-code entry path).
- WhatsApp bot command support:
  - `/status <sessionCode>`
  - `/games`
  - `/join <sessionCode>`
  - `/drop <sessionCode>`

### Out of scope (explicit)
- Court booking integration with Bay Padel.
- Payments, fees, penalties, no-show scoring.
- Rankings, ladders, ELO, skill matching.
- Multi-group support, multi-venue tenancy.
- Advanced moderation tooling.
- Push notifications/reminders.
- Native iOS/Android apps (web app + PWA only).

## 6. User Stories

### Session creator stories
- As a player, I can create a same-day session quickly so I can invite others before slots fill.
- As a player, I can add a short note like "doubles at Bay Padel" so expectations are clear.
- As a player, I can copy/share a session link into WhatsApp so others can join from chat.
- As a player, I can see roster updates live so I know whether session is viable.

### Player joining stories
- As a player, I can open a shared link and join with one tap so I don’t have to type in chat.
- As a player, I can choose Maybe when unsure so my intent is visible without overcommitting.
- As a player, I can drop quickly if plans change last minute.

### Player checking status stories
- As a player, I can see exactly who is confirmed and who is maybe.
- As a player, I can quickly tell whether there are enough people for doubles.
- As a player, I can scan today's sessions without opening a long chat history.

### WhatsApp bot stories
- As a player in WhatsApp, I can ask `/games` to see active sessions and headcounts.
- As a player, I can ask `/status ABC123` for a specific roster summary.
- As a player, I can run `/join ABC123` and be added without opening the app.
- As a player, I can run `/drop ABC123` if I cannot make it.

## 7. Core Flows

### Flow A: Create session
1. User opens app home.
2. Taps `Create Session`.
3. Enters date/time, note, optional player cap.
4. Submits; session is saved and creator is auto-added as Confirmed.
5. User lands on session detail page with share controls.

Acceptance criteria:
- Create form completes on mobile in under 30 seconds.
- New session appears instantly on home list and session detail page.

### Flow B: Share to WhatsApp
1. User taps `Share` from session detail or card.
2. App uses native share sheet when available; otherwise copy link.
3. User posts link into WhatsApp group.

Acceptance criteria:
- Link opens directly to session detail or join landing.
- Message preview includes short human-readable session title.

### Flow C: Join / Maybe / Drop
1. User opens session page.
2. If identity missing, enters name + phone once.
3. Taps `Join` or `Maybe`; existing status updates atomically.
4. If already in session, can tap `Drop` to remove.

Acceptance criteria:
- One user cannot appear twice in same roster.
- Status changes reflect in realtime for all open clients.
- UI shows clear current state for the acting user.

### Flow D: Check session status
1. User opens home for today’s sessions.
2. Taps session to view full roster.
3. Confirms viability: headcount and names.

Acceptance criteria:
- Headcount is visible both on card and detail view.
- Confirmed vs Maybe displayed separately.

### Flow E: Recurring availability
1. User opens `/availability`.
2. Sets weekly patterns (e.g., Thu 18:00-21:00).
3. Saves template.
4. Future dashboard can infer high-probability windows.

Acceptance criteria:
- Users can store and edit at least one recurring slot per day.
- Data is reusable for session suggestions (even if suggestions are manual in MVP).

### Flow F: Bot interactions
1. User posts command in WhatsApp chat.
2. Bot webhook parses command, validates sender identity and group context.
3. Bot responds with text summary or action confirmation.

Acceptance criteria:
- Commands return in plain text with readable roster summary.
- Invalid codes produce helpful error text.

## 8. Functional Requirements

### Session management
- Create session with start datetime, note, and optional capacity.
- Session has shareable short code and URL.
- Session status visibility: upcoming vs past.

### Participation model
- Participant statuses: `confirmed`, `maybe`.
- `drop` removes participation row.
- Unique participant per session.
- Show participant names in roster.

### Availability templates
- Store recurring weekday + time windows per user.
- Support multiple templates per user across week.

### WhatsApp bot commands
- `/games`: list active/upcoming sessions with short code and counts.
- `/status <code>`: show session details with confirmed/maybe names.
- `/join <code>`: mark sender confirmed.
- `/drop <code>`: remove sender from session.

## 9. Non-Functional Requirements

- Mobile-first UX; common actions reachable within one thumb interaction path.
- Realtime consistency for rosters (seconds-level, not minute-level).
- Frictionless identity retention in local storage.
- Simple onboarding: no passwords.
- PWA installability for frequent use.

## 10. Edge Cases and Expected Behavior

### Odd number of confirmed players
- Product should not block odd counts.
- UI shows practical hint (e.g., "7 confirmed: one sub/rotation needed").

### Last-minute changes
- Status updates propagate live.
- Session list should reflect most recent counts without refresh.

### Nobody shows up
- Session remains visible until start+grace period, then marked as inactive/past.
- No penalty logic.

### User joins twice
- Prevent duplicate roster entries via unique constraint.
- Second action updates status, not duplicate insert.

### Session creator drops out
- Session remains active; no owner lock.
- Any player can still share and participate.

### Deleted/expired session link
- User sees "Session unavailable" message with link to home.

## 11. UX Principles for MVP

- Keep every screen lightweight and readable in bright outdoor conditions.
- Prioritize names and counts over decorative elements.
- Default to today’s relevance rather than long planning horizons.
- Make status actions obvious and reversible.

## 12. Metrics and Instrumentation (Lightweight)

Track basic product usage:
- Sessions created per week.
- Median time to first participant after creation.
- Ratio of confirmed to maybe by session.
- Number of status changes within 2 hours of start.
- Bot command frequency by command type.

No heavy analytics suite required; basic event logging is enough.

## 13. Release Criteria for MVP

MVP is ready for group rollout when:
- Create, join, maybe, drop flows work on iPhone Safari and Android Chrome.
- Realtime roster updates are stable with multiple active viewers.
- Share links reliably open session pages.
- Recurring availability grid saves/loads correctly.
- WhatsApp bot returns correct summaries for `/games` and `/status` and handles `/join` and `/drop`.

## 14. Risks and Mitigations

- Risk: users keep coordinating in chat only.
  - Mitigation: optimize share text and status clarity so app adds immediate value.
- Risk: identity collisions (same first name).
  - Mitigation: name + phone identity key; display first name plus optional last initial.
- Risk: command misuse in bot.
  - Mitigation: strict parsing and clear usage responses.

## 15. Final Scope Guardrail

If a feature does not directly improve same-day group coordination for this one Bay Padel friend group, it should not be part of MVP. This product wins by reducing friction and ambiguity, not by adding complexity.
