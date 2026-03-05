# Bay Padel Crew MVP

A mobile-first Next.js app for casual pickleball session coordination.

## What it does

- Shows today's sessions on the home page.
- Lets anyone create a session with date/time, note, and player cap.
- Supports Join / Maybe / Drop with live roster updates.
- Shows participant names, not just counts.
- Provides a deep-link join page (`/join?code=XXX`) for WhatsApp sharing.
- Includes a recurring weekly availability grid.
- Includes WhatsApp bot webhook commands for create/join/maybe/drop/status/cancel.
- Sends quorum alerts at 4/8/12 confirmed players.
- Works as a basic installable PWA.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + realtime + auth primitives)
- WhatsApp Cloud API (Meta)
- Vercel-ready deployment setup

## 1. Prerequisites

- Node.js 20+
- npm 10+
- A Supabase project
- A Meta app with WhatsApp Cloud API enabled

## 2. Environment variables

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_GROUP_INVITE_CODE=   # optional

WHATSAPP_VERIFY_TOKEN=...        # webhook verification token you choose
WHATSAPP_ACCESS_TOKEN=...        # permanent/system-user access token
WHATSAPP_PHONE_NUMBER_ID=...     # WhatsApp business phone number ID
```

## 3. Database setup

Run these migrations against your Supabase database:

- `supabase/migrations/001_initial.sql`
- `supabase/migrations/002_add_ends_at_and_court.sql`

Tables used:
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
- `/api/whatsapp/webhook` Meta webhook verify + incoming message handler
- `/api/whatsapp/send` utility endpoint to send a text message via Cloud API

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

## 8. WhatsApp Cloud API setup

1. In Meta for Developers, create/select your app and add the WhatsApp product.
2. In the WhatsApp product settings, copy your `Phone Number ID` and generate an access token.
3. Set `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, and `WHATSAPP_PHONE_NUMBER_ID` in your deployment environment.
4. Set webhook callback URL to `https://<your-domain>/api/whatsapp/webhook`.
5. Use the same `WHATSAPP_VERIFY_TOKEN` value as the webhook verify token.
6. Subscribe webhook events for `messages`.
7. Send test messages like `create 6pm-8pm`, `join ABC123`, `status`.

Bot command examples:
- `create 6pm-8pm`
- `join ABC123` or `I'm in`
- `maybe ABC123`
- `drop ABC123` or `can't make it`
- `status` or `who's in?`
- `cancel ABC123` (creator only)

Quorum alerts:
- 4 confirmed: `🏓 We have 4 players for tonight 6:00 PM - 8:00 PM! Game on!`
- 8 confirmed: `🔥 8 players confirmed! Two courts needed!`
- 12+ confirmed: `🎉 12 players! Book three courts!`

## 9. Deploy

Deploy to Vercel with the same environment variables configured.

## 10. Known MVP tradeoffs

- Identity uses name + phone (no password auth).
- RLS policies are open for this closed-group MVP.
- Quorum alerts are triggered by bot-driven participant updates (not direct client-side updates outside bot commands).
