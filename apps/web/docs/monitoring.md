# Uptime Monitoring

Production uptime monitoring for `www.theparcelco.com`. The pattern is to point an external monitor at our `/api/health` endpoint plus the two highest-value public routes, and route alerts to phone + email.

## What we monitor

| Probe | Why |
|---|---|
| `GET https://www.theparcelco.com/api/health` | Proves both Vercel routing and the Supabase secret-key auth path are healthy. Single source of "is the app reachable end to end". |
| `GET https://www.theparcelco.com/` | Public marketing homepage. If this is down, even prospects can't reach us. |
| `GET https://www.theparcelco.com/login` | Sign-in flow. If this is down, no owner can get into the portal. |

`/api/health` is implemented at `apps/web/src/app/api/health/route.ts`. It returns `200 {"ok":true,"ms":<n>}` only when both the route and a tiny Supabase query succeed. On any failure it returns `503` with a one-word reason.

## Monitor configuration

Recommended provider: **Better Stack** (formerly Logtail / Better Uptime). UptimeRobot is a fine fallback. Either should be configured to:

- **Interval:** 1 minute for `/api/health`; 5 minutes is fine for `/` and `/login`.
- **HTTP method:** GET.
- **Expected status:** 200.
- **Body match (health only):** require `"ok":true` in the response body. Optional but cheap.
- **Region:** at minimum US East and EU West, so a single-region monitor outage does not page falsely.
- **Failure threshold:** 2 consecutive failures (avoids paging on a single transient 502).
- **Alert channels:** SMS + email to `jo@johanannunez.com`. Add an integration to PostHog or Linear if/when those become the source of truth for incidents.
- **Recovery alert:** on.

## Setup steps (one-time, done by Johan)

1. Create a Better Stack account at https://betterstack.com/ (the free tier covers 10 monitors at 3-minute intervals; the $20/month tier brings the interval down to 30 seconds and adds SMS).
2. Add the three monitors per the table above. Use the body-match for `/api/health`.
3. Add `jo@johanannunez.com` as the email destination. Add your phone as the SMS destination.
4. Optional: invite Claude (this assistant) via the API by generating an API token and adding it to Doppler as `BETTERSTACK_API_KEY` in `parcel/prd`. With that token I can automate future monitor changes and pull incident reports.
5. Test: pause one monitor for 90 seconds; confirm an SMS lands. Resume; confirm the recovery alert.

## How alerts route

- **SMS:** to your registered number for any monitor failing for 2 consecutive checks.
- **Email:** same trigger, plus a recovery email when the monitor passes again.
- **Future:** when we have an on-call rotation (post 10+ owners), Better Stack can do schedules + escalations. Not needed yet.

## Cost forecast

- Better Stack free: $0/month, 3-min interval, email only.
- Better Stack starter: $20/month, 30-sec interval, SMS + escalations.

We should start on free, upgrade to starter the day we onboard the first paying owner.

## History

- 2026-05-12: This doc written. `/api/health` endpoint shipped. External monitors not yet configured (waiting on Better Stack account creation).
