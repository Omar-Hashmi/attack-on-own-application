# Papertrail Book Pickup — Security Audit Build

A small bookshop pickup-appointment application built specifically to practice attacking and securing my own application. The main goal was to identify authorization and input-validation weaknesses from an attacker's perspective, reproduce them locally, and then implement fixes that prevent the same attacks from succeeding.

## What I Built

The application allows customers to create and view book pickup appointments. I implemented authentication and appointment ownership checks, then tested the application with intentionally malicious requests rather than relying only on normal UI behavior.

The security audit focused on several common web application vulnerabilities:

* **Insecure Direct Object Reference (IDOR)** — testing whether one customer could access another customer's appointment.
* **Mass assignment** — testing whether a user could submit a different `userId` and create an appointment belonging to another account.
* **Stored XSS / script injection** — testing whether malicious input could be stored and later executed when displayed.
* **Authentication bypass** — testing protected endpoints without a session.
* **Forged session attempts** — testing whether a guessed or manually constructed session value could be accepted.

## What I Found

During the audit, I found three real vulnerabilities.

The first was an **IDOR vulnerability** in appointment lookup. The application originally trusted the appointment ID supplied in the URL and returned the appointment without checking whether it belonged to the authenticated user. This meant Alice could request Bob's appointment directly.

The second was a **mass-assignment vulnerability**. The appointment creation handler accepted the submitted request body too broadly, allowing a client to provide another user's ID. I fixed this by allowing only the expected `bookId` and `slot` fields and assigning the appointment owner from the authenticated server-side session.

The third issue was **stored script injection**. User-controlled appointment data could eventually be rendered in the dashboard without sufficient escaping. I addressed this with strict input validation, an allowlist for valid book IDs and fields, and HTML escaping when dynamic values are displayed.

## What Was Difficult

The most difficult part was thinking about the application from an attacker's perspective instead of only testing the expected user flow. A request that looks harmless through the normal interface can become dangerous when a user manually changes IDs, adds unexpected fields, removes authentication information, or submits malicious input.

Another challenge was making the security fixes enforce the rules on the server side. For example, hiding a `userId` field from the frontend would not be enough because an attacker could still send that field manually. The server therefore has to determine ownership from the authenticated session rather than trusting client-supplied data.

## What I Left Out

This project is intentionally a small security-audit application rather than a production-ready bookshop platform. I focused on the authorization, authentication, input-validation, and output-encoding issues relevant to the assignment instead of implementing unrelated production features such as payments, email notifications, a real database-backed catalog, or deployment infrastructure.

I also limited the testing scope to the vulnerabilities documented in the audit. This should not be interpreted as a complete penetration test or proof that the application is free from every possible vulnerability.

## Verification

The security checks are automated using Node's test runner.

Run:

```bash
node --test
```

The tests verify that:

* Cross-account appointment access returns `403`.
* Attempts to assign an appointment to another user are rejected.
* Malicious book input is rejected.
* Unauthenticated appointment access returns `401`.
* Forged session values are rejected.

The detailed attack requests, original vulnerabilities, fixes, and expected results are documented in [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md).

## Running the Application

```bash
node src/server.js
```

Then open:

```text
http://localhost:3000
```

Test accounts:

```text
alice@example.test / AlicePass123!
bob@example.test / BobPass123!
```
