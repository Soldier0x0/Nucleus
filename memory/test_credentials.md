# Test Credentials — Nucleus

No accounts / no server auth. Nucleus is fully local (local-first, offline).

- App lock PIN: not set by default. When a test sets one, use **1234** (enter twice during setup).
- Wrong PIN back-off: 5 free attempts, then a 30 s countdown that doubles (test with PIN 9999).
- Forgot PIN → "Erase all data and start over" resets the app.
- Onboarding: tap "Get started" → Continue → Continue → "Explore with sample data" to load a demo workspace
  (vehicles "Activa" + "Swift", 6 months of transactions, 4 subscriptions, budget ₹45,000, a Goa trip,
  3 appliances, 2 pinned notes, 2 rules).
- Backup password used in tests: **nucleus-test-pass** (encrypted export → restore).
- Data lives in browser localStorage on web (AsyncStorage) and is **encrypted** (values start with `NCE1.`);
  the key is in `secure:nucleus.dek.v1`. Clear site storage to restart onboarding.
