# Product direction — 2026-11-18

The owner selected Voicegram as the single ongoing product and stopped standalone Seniorgram development and App Store registration.

- Continue development and Apple preparation under Voicegram's existing repository and iOS bundle identity.
- Bring suitable Seniorgram features into Voicegram; avoid maintaining a second product.
- Preserve existing Voicegram data, authentication, publication confirmation and sandbox boundaries.
- Seniorgram code, App Store records and data remain preserved. Do not resume its independent store registration or delete its resources.
- Credentials, accounts and browser-local saved works require a separately reviewed migration; never copy secrets or claim automatic cross-origin storage migration.
- Record implementation, automated tests, deployment and real-device verification separately. See `docs/seniorgram-integration-2026-11-18.md`.
