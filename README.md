# Papertrail Book Pickup — security-audit build

A small bookshop pickup-appointment application built to demonstrate authorization boundaries and adversarial testing.

Run it with:

```powershell
node src/server.js
```

Open `http://localhost:3000` and sign in with `alice@example.test` / `AlicePass123!` or `bob@example.test` / `BobPass123!`.

The documented attack requests, outcomes, vulnerabilities, and fixes are in [SECURITY_AUDIT.md](SECURITY_AUDIT.md). Run `node --test` to reproduce all five checks.
