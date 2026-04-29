# Session 1 — Validation Notes (2026-04-28)

First end-to-end validation pass against a real Okta tenant.
Duration: ~2 hours.

## What worked

### Tenant prep
- ✅ All 12 custom user profile attributes added via Profile Editor
  (workScheduleStart, workScheduleEnd, workDays, userTimezone, cctCode,
  interjornadaMinHours, overtimeMaxDailyMinutes, exemptArt62, managerEmail,
  rhEmail, registroFuncional, lastAcknowledgmentAt)
- ✅ Test user populated with realistic values (09:00–18:00, MO-FR,
  America/Sao_Paulo, CLT_PADRAO, exemptArt62=false)

### Tables
- ✅ All 4 tables created: holidays, cct_rules, auth_log, violations
- ✅ holidays seeded from CSV (18 rows for 2026 Brazilian holidays)
  - ISO date format `YYYY-MM-DD` accepted on import
  - Lowercase `true`/`false` strings parsed correctly as Boolean
  - Empty fields accepted for nullable Text columns
- ✅ cct_rules: 1 row manually entered (CLT_PADRAO baseline)

### Flow plumbing
- ✅ Created Jornada folder; flows and tables are folder-scoped
- ✅ API Endpoint trigger with typed body fields (userId, eventTime, clientIp)
- ✅ Client token security; flow callable via test panel
- ✅ End-to-end execution succeeds in ~1s

### Critical architecture validation
- ✅ Custom API Action with `GET /api/v1/users/{userId}` returns full user
  including `profile.*` with all 12 custom attributes
- ✅ Roundtrip latency: ~310ms (fast enough for reactive use)
- ✅ Compose function pattern works for dynamic URL construction
- ✅ Response Body schema can be defined recursively
  (Body → profile → exemptArt62 with True/False type)

## What was discovered (gaps to document)

### Workflows tenant column types
This tenant offers ONLY: Text, Number, Date, True/False, Counter.
There is NO "Date & Time" type. All timestamps with time-of-day precision
must be stored as Text (ISO 8601 strings) and parsed in the flow.

→ **Action:** Update okta/tables/auth_log.json and violations.json specs
  to reflect Text typing for timestamp fields.

### Okta connector "Read User" limitation
The standard "Read User" action returns ONLY system properties
(ID, Status, Created, Activated, Last Login, etc.).
It does NOT expose custom user profile attributes.

This is a major gap not documented in Okta's connector docs.
Workaround: use Custom API Action with the raw REST endpoint.

→ **Action:** Update flows/01-evaluator.json spec — replace Read User card
  reference with Custom API Action.

### Workflows Custom API Action behavior quirks
- Relative URL field accepts EITHER static text OR a single dragged chip,
  not both concatenated. Must use Compose function for dynamic URLs.
- {{varName}} text-template syntax in Relative URL is NOT auto-resolved
  (sent literally to the API and gets rejected).
- Compose function (`Text → Compose`) handles concatenation cleanly:
  static prefix `/api/v1/users/` + chip `userId` → output drives URL.

### If/Else condition editor
- The condition card shows a summary line above the branches
  (e.g., "Body == true") that may not auto-refresh after editing the
  underlying values via the pencil icon.
- Need to revisit on next session: confirm condition shows
  "exemptArt62 == True" after Save.

## What's still pending

1. ⬜ Fix If/Else condition (committing to "exemptArt62 == True")
2. ⬜ Add Tables: Add Row to "Run when FALSE" branch
3. ⬜ Verify a row lands in auth_log table after a test run
4. ⬜ Add work-day check (workDays Contains localDayOfWeek)
5. ⬜ Add holiday check (Tables: Search Rows in holidays for localDate)
6. ⬜ Add work-hours check (compare localTime to workScheduleStart/End)
7. ⬜ Wire up real Event Hook in Okta Admin Console (Phase 3d)
8. ⬜ Document everything for the public README

## Performance baseline
- Custom API Action latency: ~310ms (Okta API roundtrip)
- Total flow latency observed: ~1s
- Read User card was ~850ms (deleted; Custom API Action superset)

## Key intel for the public README

These findings should be prominently in `docs/LIMITACOES.md` and the
install guide because they would block anyone else trying to replicate:

1. Custom user attributes require Custom API Action, not Read User
2. Dynamic URLs require the Compose function pattern
3. Tenant column types vary; Date & Time may not be available
4. Schema definition for response Body must be done in the card explicitly
