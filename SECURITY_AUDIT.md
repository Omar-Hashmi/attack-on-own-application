# Security audit — Papertrail Book Pickup

Audit date: 2026-09-12. The requests below were run against a local server using seeded customer accounts. The exact checks are automated in `test/security.test.js`.

| Attempt | Request sent | Result returned after fix |
| --- | --- | --- |
| IDOR / another user's appointment | `GET /api/appointments/apt-bob` with Alice's session cookie | `403 {"error":"You cannot access another customer's appointment"}` |
| Mass assignment | `POST /api/appointments` as Alice with `{"bookId":"book-garden","slot":"2026-09-20T10:00","userId":"user-bob"}` | `400 {"error":"Only bookId and slot may be submitted"}` |
| Stored XSS | `POST /api/appointments` as Alice with `{"bookId":"<script>alert(1)</script>","slot":"2026-09-20T10:00"}` | `422 {"error":"Choose a valid book"}` |
| Logged-out endpoint access | `GET /api/appointments/apt-alice` with no cookie | `401 {"error":"Authentication required"}` |
| Forged session (additional attempt) | `GET /api/appointments/apt-alice` with `Cookie: session=admin-user-alice` | `401 {"error":"Authentication required"}` |

## Real holes found and fixed

### 1. Insecure direct object reference (IDOR)

**Before:** the initial appointment lookup selected an appointment by its URL id and returned it. Alice could request `/api/appointments/apt-bob` and receive Bob's booking (`200`).

**Fix:** `GET /api/appointments/:id` now requires an authenticated session and compares `appointment.userId` to the session user's id before serializing anything. Cross-account lookups return `403`. The first automated test locks this in.

### 2. Mass assignment of appointment ownership

**Before:** the create handler spread the submitted request body into the new appointment. Supplying `userId: "user-bob"` created a booking owned by Bob (`201`).

**Fix:** the handler permits only `bookId` and `slot`, validates both, and assigns `userId` exclusively from the server-side session. Extra fields now receive `400`; the second automated test verifies it.

### 3. Stored script injection

**Before:** arbitrary booking fields were retained and later interpolated into the dashboard. A script tag in a submitted field could execute when the appointments page rendered.

**Fix:** the API uses an allowlist of fields and book IDs, validates the time format, and HTML-escapes all displayed dynamic values. The script-tag request now returns `422`, covered by attempt 3.

## Run the verification

```powershell
node --test
```

Every listed attempt must keep its protected response. A passing suite means the application was actively exercised, not only visually reviewed.
