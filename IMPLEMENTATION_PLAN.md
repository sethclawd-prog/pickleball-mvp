# Pickleball MVP Implementation Plan

## 1. Plan Overview

This plan is built for one developer delivering a practical MVP for a single casual pickleball group (~30 players at Bay Padel). The goal is to ship quickly, gather usage feedback in real games, and avoid unnecessary platform complexity.

Execution is split into three phases aligned with real-world value delivery:
- Phase 1 (Weekend build): usable session coordination core
- Phase 2 (Week 2): recurring availability and weekly visibility
- Phase 3 (Week 3): WhatsApp bot for command-based status checks

Each phase has concrete deliverables, exact files, estimated hours, and a clear definition of done.

## 2. Guiding Build Principles

- Build for same-day coordination first.
- Keep user actions low-friction (name + phone, no passwords).
- Optimize mobile first, because usage starts in WhatsApp on phones.
- Prefer simple data constraints over complicated app logic.
- Delay nonessential hardening until group validates the workflow.

## 3. Phase 1 (Weekend Build)

### Objective
Ship the minimum usable coordination app:
- Create session
- Join / Maybe / Drop
- Share link to WhatsApp
- Live roster updates
- Today's session list

### Time estimate
- Total: 14-20 hours
- Suggested split:
  - Setup + schema: 3-4h
  - UI pages/components: 6-8h
  - Realtime + state handling: 2-3h
  - QA + bug fixes + polish: 3-5h

### Exact files to create (Phase 1)
Core project/config:
- `package.json`
- `tsconfig.json`
- `next.config.js`
- `tailwind.config.ts`
- `postcss.config.js`
- `next-env.d.ts`
- `.env.example`

App shell/pages:
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/session/[id]/page.tsx`
- `src/app/join/page.tsx`
- `src/app/globals.css`

Components:
- `src/components/CreateSessionModal.tsx`
- `src/components/SessionCard.tsx`
- `src/components/RosterList.tsx`
- `src/components/ShareButton.tsx`
- `src/components/IdentityGate.tsx`

Data/types/lib:
- `src/lib/supabase.ts`
- `src/lib/types.ts`
- `src/lib/identity.ts`
- `src/lib/sessions.ts`

Database:
- `supabase/migrations/001_initial.sql`

PWA basics:
- `public/manifest.json`
- `public/sw.js`
- `public/icons/icon-192.png` (placeholder acceptable)
- `public/icons/icon-512.png` (placeholder acceptable)

Documentation:
- `README.md`

### Key implementation tasks
1. Initialize Next.js 14 + TypeScript + Tailwind baseline.
2. Build Supabase client setup and environment wiring.
3. Create SQL schema for users/sessions/participants.
4. Build identity capture flow (name + phone stored locally, synced to users table).
5. Build home page with today's sessions and create modal.
6. Build session detail page with status actions and roster sections.
7. Add live roster updates via Supabase subscriptions.
8. Implement sharing UX (native share sheet with copy fallback).
9. Add join deep-link page handling `?code=XXX`.
10. Add minimal PWA manifest and service worker registration.

### Definition of done (Phase 1)
Functional:
- Any user can create a session from mobile.
- Shared session link opens for others and supports join/maybe/drop.
- Session roster shows names and statuses (confirmed/maybe).
- Duplicate join attempts do not create duplicate rows.
- Roster updates live when multiple clients are open.

UX:
- Works comfortably on small phone screens.
- Main actions are reachable in 1-2 taps from session page.

Technical:
- Database migration applies cleanly on fresh Supabase project.
- No TypeScript errors in app code.
- README includes local setup and deployment notes.

## 4. Phase 2 (Week 2)

### Objective
Add recurring availability for regular scheduling rhythm and lightweight weekly visibility.

### Features
- Weekly recurring availability grid per user.
- Save/edit availability templates.
- Dashboard heatmap showing aggregate availability density by weekday/time block.

### Time estimate
- Total: 10-14 hours
- Suggested split:
  - Data model + write/read APIs: 3-4h
  - Grid UI + interactions: 4-5h
  - Heatmap/dashboard aggregation: 2-3h
  - QA and usability tuning: 1-2h

### Exact files to create/extend (Phase 2)
Create:
- `src/app/availability/page.tsx`
- `src/components/AvailabilityGrid.tsx`
- `src/components/AvailabilityHeatmap.tsx`
- `src/lib/availability.ts`

Update:
- `supabase/migrations/001_initial.sql` (if not already containing availability table)
- `src/lib/types.ts` (availability types)
- `src/app/layout.tsx` (nav link)
- `README.md` (feature docs)

Optional API routes (if API boundary chosen in this phase):
- `src/app/api/availability/route.ts`

### Key implementation tasks
1. Build weekly grid model (e.g., 7 days x time slots).
2. Support tap-to-toggle behavior on mobile.
3. Persist merged availability ranges in `availability_templates`.
4. Compute aggregate density across all users for heatmap.
5. Render color-coded weekly hot windows to suggest likely play times.

### Definition of done (Phase 2)
Functional:
- User can set, save, edit recurring availability.
- Data persists across sessions/devices once identity matches.
- Heatmap displays useful group-level availability pattern.

UX:
- Grid interaction is manageable on mobile (horizontal scroll acceptable).
- Save feedback is clear and fast.

Technical:
- Availability overlap logic behaves consistently.
- No duplicate or invalid time windows created.

## 5. Phase 3 (Week 3)

### Objective
Integrate WhatsApp bot commands to reduce "status check" message noise.

### Features
- `/games` list current sessions
- `/status <code>` show roster summary
- `/join <code>` add sender as confirmed
- `/drop <code>` remove sender from session

### Time estimate
- Total: 8-12 hours
- Suggested split:
  - Provider setup + webhook plumbing: 2-3h
  - Command parser + handlers: 3-4h
  - Identity mapping + validation: 1-2h
  - Testing + production verification: 2-3h

### Exact files to create/extend (Phase 3)
Create:
- `src/app/api/whatsapp/webhook/route.ts`
- `src/lib/whatsapp/parseCommand.ts`
- `src/lib/whatsapp/handlers.ts`
- `src/lib/whatsapp/formatters.ts`

Update:
- `src/lib/sessions.ts` (shared query helpers)
- `src/lib/types.ts` (command types)
- `README.md` (provider setup)

Optional integration test scaffolding:
- `tests/integration/whatsapp-webhook.test.ts`

### Key implementation tasks
1. Configure inbound webhook endpoint.
2. Parse command text robustly (trim, case-insensitive, argument checks).
3. Map sender phone to app user.
4. Execute session actions and generate concise response text.
5. Handle errors cleanly (unknown code, unknown user, malformed command).

### Definition of done (Phase 3)
Functional:
- All four commands produce correct outcomes and text responses.
- Bot handles unrecognized commands with usage help.

Operational:
- Webhook endpoint reachable in deployed environment.
- Bot works reliably in actual group chat testing.

Technical:
- Command handling code is modular and testable.
- Sensitive provider credentials are env-based only.

## 6. Suggested Weekly Calendar

### Weekend (Phase 1)
- Saturday morning: project scaffold + DB schema
- Saturday afternoon: home/session pages + create/join flows
- Sunday morning: realtime + share + join deep-link
- Sunday afternoon: polish, mobile QA, README, first deploy

### Week 2 (Phase 2)
- Day 1-2: data model and availability persistence
- Day 3-4: grid UI and interactions
- Day 5: heatmap view and final QA

### Week 3 (Phase 3)
- Day 1: webhook setup and provider validation
- Day 2-3: command parser and core handlers
- Day 4: user mapping and error handling
- Day 5: end-to-end chat testing + rollout

## 7. Risk Register by Phase

### Phase 1 risks
- Realtime state bugs under concurrent updates.
- Identity mismatch if users change phone formatting.

Mitigation:
- Use server/db constraints for uniqueness.
- Normalize phone values before writes.

### Phase 2 risks
- Availability UI becomes hard to use on small screens.

Mitigation:
- Keep slots coarse (e.g., 60-min blocks) in MVP.
- Add quick presets (Evening blocks).

### Phase 3 risks
- Provider setup friction and webhook verification delays.

Mitigation:
- Start with Twilio docs/templates.
- Keep webhook logic provider-agnostic internally.

## 8. Dependencies and Preconditions

Before starting:
- Supabase project created.
- Vercel project linked.
- Environment variables prepared.
- WhatsApp sandbox/number ready for phase 3.

No team dependencies are required; this is intentionally solo-friendly.

## 9. Handoff/Review Checklist Per Phase

At end of each phase:
- Demo in phone browser with real flow.
- Verify one deployment URL works for group members.
- Capture known issues in README or a simple `NOTES.md`.
- Keep backlog short and practical.

## 10. Scope Control Rules

To prevent overbuild:
- If feature does not improve same-day coordination, defer.
- If feature adds setup friction, avoid for MVP.
- If feature requires multi-tenant complexity, reject.

The objective is a reliable, lovable group utility, not a general-purpose scheduling platform.
