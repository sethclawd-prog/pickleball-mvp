# Pickleball MVP Manual Test Plan

## 1. Purpose and Test Philosophy

This manual test plan validates that the MVP works in the exact conditions where the Bay Padel friend group will use it: quick same-day coordination from phones, shared links in WhatsApp, and rapid roster changes right before play.

The purpose is not exhaustive QA of every theoretical edge case. The purpose is confidence that real users can create, share, join, and track sessions with minimal friction.

Testing emphasis:
- Mobile-first behavior over desktop polish.
- Real-world flow continuity (create -> share -> join -> verify).
- Roster trustworthiness under concurrent updates.
- WhatsApp bot command correctness.

## 2. Test Scope

### In scope
- Identity setup (name + phone, no password)
- Session creation
- Session detail and roster visibility
- Join/Maybe/Drop behavior
- Share link behavior including WhatsApp copy/share flow
- Realtime roster updates
- Recurring availability capture and persistence
- Deep link `/join?code=XXX`
- WhatsApp bot commands: `/games`, `/status`, `/join`, `/drop`

### Out of scope
- Bay Padel court booking integration
- Ranking/penalty logic
- Multi-group isolation
- Push reminders

## 3. Test Environments

### Devices and browsers
- iPhone (recent iOS) with Safari
- Android device (recent OS) with Chrome
- Desktop with Chrome and Safari/Firefox for sanity checks

### Network conditions
- Stable Wi-Fi
- Typical cellular network
- Brief offline/reconnect scenarios for resiliency spot checks

### Environments
- Local dev (for fast iteration)
- One deployed URL (Vercel preview or production)

### Test identities
Prepare at least 8 test identities with unique phone numbers for realistic roster checks.

## 4. Pre-Test Setup Checklist

- Supabase migration applied successfully.
- Initial `users`, `sessions`, and `participants` tables empty or known state.
- Environment variables configured on local and deploy target.
- WhatsApp bot sandbox/number configured with webhook endpoint.
- Test phones logged into WhatsApp accounts capable of sending commands.

## 5. Core Scenario Test Cases

### TC-01: First-time user onboarding on phone
Steps:
1. Open app on iPhone Safari.
2. Verify identity prompt appears.
3. Enter name and phone.
4. Continue to home.

Expected:
- Identity saved locally.
- User record created/upserted in Supabase.
- Subsequent page loads skip identity prompt.

### TC-02: Create same-day session from home
Steps:
1. Tap `Create Session`.
2. Set start time within same day.
3. Add note (e.g., "doubles at Bay Padel").
4. Save.

Expected:
- New session appears in today's list immediately.
- Creator auto-added as confirmed in roster.
- Session page opens with share option.

### TC-03: Share session to WhatsApp
Steps:
1. From session page, tap `Share`.
2. Use native share if available; otherwise copy link.
3. Paste link into WhatsApp group.

Expected:
- Link is complete and opens correctly on another device.
- Session code remains stable and visible.

### TC-04: Friend opens shared link and joins
Steps:
1. On second phone, open link from WhatsApp.
2. Complete identity if first-time.
3. Tap `Join`.

Expected:
- User appears in confirmed list on both phones.
- Headcount increments without refresh.

### TC-05: Maybe flow
Steps:
1. Third test user opens session.
2. Tap `Maybe`.

Expected:
- User appears under maybe list (not confirmed).
- Headcount display separates confirmed vs maybe.

### TC-06: Drop flow
Steps:
1. Confirmed user taps `Drop`.

Expected:
- User is removed from roster.
- Counts update live across open clients.

### TC-07: Duplicate join prevention
Steps:
1. Same user taps `Join` multiple times quickly.
2. Refresh page.

Expected:
- User appears once only.
- No duplicate rows created.

### TC-08: Creator drops out
Steps:
1. Session creator taps `Drop`.

Expected:
- Session remains active.
- Other users can still join/share.
- No ownership errors appear.

### TC-09: Join deep-link route
Steps:
1. Open `/join?code=<valid-code>` manually.
2. Verify redirect/context load to target session.

Expected:
- Correct session found by code.
- User can join from this flow.

### TC-10: Invalid session code link
Steps:
1. Open `/join?code=INVALID`.

Expected:
- Friendly error appears.
- Path back to home is obvious.

## 6. Realtime and Concurrency Tests

### TC-11: Multi-user live updates
Setup:
- Open same session page on 3+ devices.

Steps:
1. Device A toggles maybe/join/drop.
2. Observe devices B/C.

Expected:
- Updates propagate in near real-time.
- No stale roster mismatch after 10+ actions.

### TC-12: 30 users join-at-once simulation (manual style)
Setup:
- Use available devices plus quick script support if needed.

Steps:
1. Trigger many near-simultaneous join operations.

Expected:
- Final confirmed count matches unique users.
- No app crashes or hung UI.

## 7. Availability Manual Tests

### TC-13: Set recurring availability
Steps:
1. Open `/availability`.
2. Select Thursday evening slots.
3. Save.

Expected:
- Save success feedback shown.
- Returning to page preserves selections.

### TC-14: Edit recurring availability
Steps:
1. Remove one previously selected slot.
2. Add a new slot on another day.
3. Save.

Expected:
- Old slot removed, new slot added.
- No overlapping duplicate windows created.

## 8. WhatsApp Bot Manual Tests

### TC-15: `/games`
Steps:
1. Send `/games` from registered phone.

Expected:
- Bot responds with active sessions and counts.
- Message readable in one screen without clutter.

### TC-16: `/status <code>`
Steps:
1. Send `/status ABC123` using real session code.

Expected:
- Bot returns time, venue, confirmed names, maybe names.

### TC-17: `/join <code>`
Steps:
1. From unjoined registered user, send `/join ABC123`.
2. Verify app session page.

Expected:
- User moved/added to confirmed.
- Bot confirmation text accurate.

### TC-18: `/drop <code>`
Steps:
1. Send `/drop ABC123`.
2. Verify session page.

Expected:
- User removed from roster.
- Bot response confirms drop.

### TC-19: Unknown command and malformed args
Steps:
1. Send `/foo`.
2. Send `/status` with no code.

Expected:
- Helpful usage guidance returned.
- No backend errors.

### TC-20: Unregistered sender
Steps:
1. Send command from phone not in `users` table.

Expected:
- Bot asks user to register via app link.
- No unintended row creation.

## 9. Cross-Device UX Tests

### iPhone Safari checks
- Tap target sizes for join/maybe/drop.
- Modal behavior and keyboard overlap.
- Share sheet behavior.
- Home screen install prompt/behavior.

### Android Chrome checks
- Deep link open reliability from WhatsApp.
- Clipboard copy fallback reliability.
- Service worker registration and revisit speed.

### Desktop checks
- Session list readability.
- Layout should scale but mobile remains priority.
- Keyboard and mouse interactions are functional.

## 10. Error and Recovery Tests

### TC-21: Temporary network loss during join
Steps:
1. Disable network before tapping join.
2. Re-enable network and retry.

Expected:
- Clear error state when offline.
- Successful retry without duplication.

### TC-22: Session not found after deletion/expiry
Steps:
1. Open stale link to removed/non-existent session.

Expected:
- Human-readable unavailable message.
- One-tap return path to home.

## 11. Data Integrity Spot Checks (Manual)

After major test passes, run DB checks:
- No duplicate `(session_id, user_id)` rows.
- Status values limited to allowed set.
- Participant count on UI matches DB counts.
- Availability rows have valid time ranges.

## 12. Regression Checklist

Run before each deploy:
- Create session still works.
- Share link still opens and loads session.
- Join/maybe/drop update roster live.
- Identity persists across page reloads.
- `/games` and `/status` still respond correctly.

## 13. Exit Criteria

Manual testing can be considered pass-ready when:
- All critical flow cases (TC-01 through TC-10) pass on iPhone and Android.
- Realtime tests show no major consistency failures.
- Bot commands pass happy-path and error-path checks.
- No P0 or P1 defects remain open.

## 14. Defect Severity Guidance

- P0: app unusable for core flow (cannot create/join sessions)
- P1: incorrect roster status/count causing user trust failure
- P2: degraded UX with workaround available
- P3: cosmetic issues

Prioritize fixes strictly by impact on same-day group coordination.

## 15. Reporting Template

For each bug found, record:
- ID
- Date/time
- Environment (device/browser/build)
- Steps to reproduce
- Expected vs actual
- Severity
- Screenshot/video (if useful)
- DB evidence (if data issue)

A simple markdown bug log in repo is sufficient for this MVP.

## 16. Operational Dry Run Before Group Launch

Do one live rehearsal with 5-8 friends:
1. Create two sessions for same day.
2. Share links in WhatsApp.
3. Have participants join/maybe/drop in real-time.
4. Trigger bot commands for both sessions.
5. Confirm everyone can interpret status quickly.

If this rehearsal is smooth, the MVP is ready for full group rollout.
