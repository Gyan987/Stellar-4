# RakshaCircle Security Checklist

## Completed Controls

- Wallet-based identity for profile and SOS actions.
- Wallet normalization before storage and indexing.
- SHA-256 hashing for SOS context data.
- Fastify rate limiting on the backend.
- Off-chain storage for sensitive notes and contact details.
- Soroban blockchain status exposed in the API.
- Production monitoring snapshot with request tracing.
- Metrics and indexing endpoints for operational review.
- Demo seeding is gated behind `ENABLE_DEMO_SEED=true` in production.

## Verification Steps

1. Open `/health` and confirm the app is running.
2. Open `/api/v1/raksha/production-readiness` and verify metrics, monitoring, indexing, and checklist data.
3. Trigger a profile, contacts, and SOS flow to confirm records are indexed.
4. Confirm the README links to the live demo, user sheet, monitoring dashboard, and security checklist.

## Follow-Up Checks Before Final Submission

- Confirm the public repository is accessible.
- Confirm the demo deployment URL works from a clean browser session.
- Confirm the 30+ user wallet list is verifiable on Stellar Explorer.
- Confirm the Excel export from the onboarding form is linked in the README.