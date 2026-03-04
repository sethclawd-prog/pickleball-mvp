# Pickleball Group MVP Technical Specification

## 1. Technical Goals

This technical specification is for a single-group casual MVP used by about 30 players coordinating games at Bay Padel. The implementation should optimize for speed of build, low operational cost, and low user friction. The architecture should remain simple enough for one developer to build and maintain.

Primary technical goals:
- Fast mobile-first web app with no password-based account friction.
- Realtime roster updates so players can trust headcounts.
- Minimal backend surface area using Next.js API routes.
- Simple WhatsApp bot integration for status commands.
- Production deployment with low ongoing cost.

## 2. Stack Selection

### Frontend + App framework
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS

Why this stack:
- App Router supports fast page composition and future server/client split.
- TypeScript keeps data model and API contracts clean for solo maintenance.
- Tailwind speeds UI implementation while keeping mobile responsiveness predictable.

### Backend and data
- Supabase
  - PostgreSQL database
  - Realtime subscriptions (Postgres change feeds)
  - Auth primitives (phone OTP optional in later iteration)

Why Supabase:
- One managed service covers DB + realtime + auth capabilities.
- SQL schema and migration tooling are straightforward.
- Good fit for low-scale MVP with constrained complexity.

### Deployment
- Vercel for Next.js web app and API routes.
- Supabase hosted project for DB/realtime/auth.

### WhatsApp integration
- Webhook-based bot via one of:
  - Twilio WhatsApp API, or
  - Meta WhatsApp Cloud API

Recommendation:
- Start with Twilio for faster setup and stable webhook ergonomics.
- Move to Cloud API later if direct Meta route is preferred.

## 3. High-Level Architecture

```text
+----------------------------+
| iPhone/Android/Desktop PWA |
| Next.js App Router UI      |
+-------------+--------------+
              |
              | HTTPS (REST + Realtime WS)
              v
+----------------------------+
| Supabase                   |
| - Postgres (sessions, etc) |
| - Realtime subscriptions   |
| - Auth primitives          |
+----------------------------+
              ^
              |
       Server-side API calls
              |
+-------------+--------------+
| Next.js API Routes         |
| /api/sessions              |
| /api/participants          |
| /api/availability          |
| /api/whatsapp/webhook      |
+-------------+--------------+
              ^
              |
      Webhook POST / outbound msg
              |
+----------------------------+
| Twilio / WhatsApp Cloud    |
+----------------------------+
```

Design principle: keep business logic thin and explicit. Use database constraints to prevent duplicates and race-condition errors where possible.

## 4. Data Model (Minimal)

Only four core tables are required for MVP.

### `users`
Purpose: represent players by lightweight identity.

Fields:
- `id` (uuid, pk)
- `name` (text, required)
- `phone` (text, required, unique normalized E.164 when possible)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

Notes:
- No password hash storage.
- Phone is key for WhatsApp mapping and duplicate avoidance.

### `sessions`
Purpose: represent a playable event.

Fields:
- `id` (uuid, pk)
- `code` (text, unique short share code)
- `starts_at` (timestamptz)
- `note` (text, optional)
- `capacity` (int, optional, default 8)
- `venue` (text, default "Bay Padel")
- `created_by` (uuid fk -> users.id)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

Notes:
- No ownership restrictions after creation; any user can join/drop/share.

### `participants`
Purpose: connect users to sessions with status.

Fields:
- `id` (uuid, pk)
- `session_id` (uuid fk -> sessions.id)
- `user_id` (uuid fk -> users.id)
- `status` (enum/text check: `confirmed`, `maybe`)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

Constraints:
- Unique `(session_id, user_id)` to block duplicates.

### `availability_templates`
Purpose: recurring weekly availability.

Fields:
- `id` (uuid, pk)
- `user_id` (uuid fk -> users.id)
- `weekday` (int, 0-6)
- `start_time` (time)
- `end_time` (time)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

Constraints:
- Check `start_time < end_time`.

## 5. Realtime Design

Realtime requirements:
- Home cards update headcounts when participants join/maybe/drop.
- Session detail roster updates live without refresh.

Implementation approach:
- Supabase client subscribes to `participants` table changes filtered by `session_id`.
- On change event, refetch participants for authoritative ordering and status grouping.
- Optional optimization: local optimistic updates plus background reconcile.

Why refetch after event:
- Simpler correctness for MVP than complex in-memory merges.
- Helps avoid stale client state from missed reconnect events.

## 6. Authentication and Identity

MVP supports frictionless identity with two possible modes:

### Mode A (default MVP): Group invite code + local identity
- User enters `name` + `phone` on first visit.
- App stores identity locally and upserts in `users`.
- Optional shared invite code gate to keep app private.

Pros:
- Fastest rollout.
- No OTP friction.

Cons:
- Weaker identity proof; phone value is self-asserted.

### Mode B (optional enhancement): WhatsApp/phone verification
- Use Supabase phone auth (OTP) or WhatsApp-verified mapping.
- Store verified phone token and bind user identity.

Pros:
- Stronger identity integrity.

Cons:
- More setup complexity and potential SMS/OTP cost.

Recommendation for this MVP:
- Ship Mode A first.
- Keep schema compatible with future verified mode.

## 7. API Surface (Next.js API Routes)

No separate backend service. Use route handlers under `src/app/api`.

Planned endpoints:
- `POST /api/users/upsert`
  - Input: `{ name, phone }`
  - Output: user record
- `GET /api/sessions?date=today`
  - Returns active/today sessions with counts and roster snippets
- `POST /api/sessions`
  - Input: `{ startsAt, note, capacity, creatorUserId }`
  - Creates session and creator participant row (`confirmed`)
- `GET /api/sessions/:id`
  - Returns session detail + participants
- `POST /api/sessions/:id/participation`
  - Input: `{ userId, action }` where action in `join|maybe|drop`
- `GET /api/availability`
  - Input: `userId`
  - Returns weekly templates
- `POST /api/availability`
  - Replace/update availability rows for user
- `POST /api/whatsapp/webhook`
  - Handles `/games`, `/status`, `/join`, `/drop`

Implementation note:
- For early MVP speed, client can also call Supabase directly for session and participant writes.
- API routes remain preferred boundary for webhook handling and future business-rule centralization.

## 8. WhatsApp Bot Integration

### Command parsing
Supported commands (case-insensitive):
- `/games`
- `/status <code>`
- `/join <code>`
- `/drop <code>`

### Webhook behavior
1. Receive inbound message payload.
2. Normalize sender phone to E.164.
3. Match sender to `users.phone`.
4. Parse command and argument.
5. Read/write Supabase as needed.
6. Return human-readable plain text response.

### Response examples
- `/games`
  - "Today: ABC123 6 confirmed / 2 maybe at 7:00 PM; FGH456 3 confirmed / 1 maybe at 8:30 PM"
- `/status ABC123`
  - "ABC123 7:00 PM Bay Padel\nConfirmed: Ana, Chris, Leo\nMaybe: Maya, Tim"
- `/join ABC123`
  - "You’re in for ABC123 (7:00 PM). Confirmed: 6"
- `/drop ABC123`
  - "You’ve been removed from ABC123."

### Error handling
- Unknown command: return usage text.
- Unknown code: return not found with `/games` suggestion.
- Unregistered phone: prompt to open app link and create profile.

## 9. PWA Technical Setup

PWA basics for MVP:
- `public/manifest.json` with name, icons, theme/background colors.
- Simple `public/sw.js` service worker caching shell/static assets.
- Client-side service worker registration.
- Mobile-friendly viewport and installability metadata.

Scope intentionally limited:
- No advanced offline sync conflict resolution.
- No push notifications (explicitly out of scope).

## 10. Security and Data Integrity

### Baseline controls
- Supabase Row Level Security enabled.
- MVP policies can allow anon read/write for simplicity in this closed group.
- Use server-side environment variables for service-role operations (webhook routes).
- Basic input validation in API routes.

### Integrity via constraints
- Unique participant per session.
- Status check constraint.
- Generated/unique session code.
- Time-window checks for availability entries.

### Privacy
- Only minimal PII stored (name + phone).
- Keep logs free of raw full payloads when possible.

## 11. Performance and Scale Expectations

Expected usage profile:
- ~30 users total.
- 0-5 concurrent active sessions.
- Bursty same-day interaction near game time.

Performance target:
- Page interactions under ~200ms perceived latency on normal mobile data (excluding cold start).

Given scale, managed services should comfortably handle load with default plans.

## 12. Environment Variables

Required at runtime:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `GROUP_INVITE_CODE` (optional)
- `WHATSAPP_PROVIDER` (`twilio` or `cloud`)
- Twilio path:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_WHATSAPP_NUMBER`
- Cloud API path:
  - `WHATSAPP_TOKEN`
  - `WHATSAPP_PHONE_NUMBER_ID`

## 13. Cost Estimate at 30 Users

For one group at this scale, operating cost should be near zero to low double digits monthly.

Estimated monthly:
- Vercel hobby: $0 (if usage remains within limits)
- Supabase free tier: $0 (likely sufficient for MVP usage)
- WhatsApp bot:
  - Twilio/Cloud cost varies by conversation volume
  - For low command traffic, likely low single-digit to low teens USD/month

Expected total:
- Near $0/month without bot, or roughly $5-$20/month with bot traffic.

## 14. Monitoring and Operations

Simple operational setup:
- Use Vercel function logs for API/webhook troubleshooting.
- Use Supabase dashboard for query/realtime health.
- Add lightweight error alerts later if usage grows.

No dedicated DevOps layer is needed for MVP.

## 15. Implementation Tradeoffs

- Direct client-to-Supabase writes are fastest to implement but expose more logic in client.
- API-first writes improve governance but increase initial code volume.
- For this MVP, mixed approach is reasonable:
  - Client direct writes for UI speed.
  - API route handling for webhook and future-sensitive mutations.

This keeps product velocity high while preserving a path to harden behavior when the group grows.
