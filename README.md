# Bay Padel Crew MVP

A mobile-first Next.js app for casual pickleball session coordination.

## What it does

- Shows today's sessions on the home page.
- Lets anyone create a session with date/time, note, and player cap.
- Supports Join / Maybe / Drop with live roster updates.
- Shows participant names, not just counts.
- Provides a deep-link join page (`/join?code=XXX`) for WhatsApp sharing.
- Includes a recurring weekly availability grid.
- Works as a basic installable PWA.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + realtime + auth primitives)
- Vercel-ready deployment setup

## 1. Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project

## 2. Environment variables

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_GROUP_INVITE_CODE=   # optional
```

## 3. Database setup

Run `supabase/migrations/001_initial.sql` against your Supabase database.

Tables created:
- `users`
- `sessions`
- `participants`
- `availability_templates`

## 4. Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## 5. Core routes

- `/` Home with today's sessions and create action
- `/session/[id]` Session detail with roster and status buttons
- `/availability` Weekly recurring availability grid
- `/join?code=XXX` Deep-link join entry from WhatsApp

## 6. Realtime behavior

Realtime updates use Supabase subscriptions on:
- `sessions`
- `participants`

Any join/maybe/drop updates open clients without manual refresh.

## 7. PWA notes

PWA basics included:
- `public/manifest.json`
- `public/sw.js`
- service worker registration in app layout

This is intentionally lightweight (no push notifications, no advanced offline sync).

## 8. Deploy

Deploy to Vercel with the same environment variables configured.

## 9. Known MVP tradeoffs

- Identity uses name + phone (no password auth).
- RLS policies are open for this closed-group MVP.
- WhatsApp bot webhook endpoints are planned in docs, not implemented in this phase.
