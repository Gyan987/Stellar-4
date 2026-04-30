# Human-RakshaCircle

Production-ready women safety and emergency coordination platform powered by Stellar Soroban.

## Live Deployment

- Frontend: https://raksha-circle.vercel.app
- Backend API: https://rakshacircle-backend.onrender.com
- Soroban Contract ID (testnet): `CCTDYXR5HVBLHG6ZZ3XSSZHBGUUFVPWLN36RVDNRNJVKLQQPPUXUN747`

## Submission Proof Pack

- Metrics dashboard endpoint: https://rakshacircle-backend.onrender.com/api/v1/raksha/metrics
- Monitoring dashboard endpoint: https://rakshacircle-backend.onrender.com/api/v1/raksha/monitoring
- Production readiness endpoint: https://rakshacircle-backend.onrender.com/api/v1/raksha/production-readiness
- Metrics dashboard screenshot placeholder: `docs/proofs/metrics-dashboard.png`
- Monitoring dashboard screenshot placeholder: `docs/proofs/monitoring-dashboard.png`

## What RakshaCircle Delivers

- Wallet-based identity and profile setup
- Trusted contacts circle management
- SOS trigger and acknowledgement workflow
- On-chain integrity anchoring for critical safety events
- Production readiness surface with monitoring, indexing, and checklist visibility

## Tech Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Fastify
- Smart Contract: Rust + Soroban SDK (Stellar testnet)
- Auth model: Stellar wallet identity

## User Onboarding and Excel Export

- Google Form (collects name, email, wallet, rating, feedback): https://docs.google.com/forms/d/e/1FAIpQLSdOfoZZjiQkpWCbxz6W20lo6qvNmNDocp36Fo3Vw1NjbjXIug/viewform?usp=publish-editor
- Response sheet (live): https://docs.google.com/spreadsheets/d/1QHd7NRlK1xxFAf9LTUEV2XumoxzMsvjQr4wHqY4yNtY/edit?resourcekey=&gid=510051736#gid=510051736
- Excel export (.xlsx): https://docs.google.com/spreadsheets/d/1QHd7NRlK1xxFAf9LTUEV2XumoxzMsvjQr4wHqY4yNtY/export?format=xlsx&gid=510051736


## Data and Monitoring Endpoints

- Health: `/health`
- Blockchain status: `/api/v1/raksha/blockchain-status`
- Monitoring: `/api/v1/raksha/monitoring`
- Indexing: `/api/v1/raksha/indexing`
- Dashboard: `/api/v1/raksha/dashboard/:wallet`

## On-Chain Write Requirements

To ensure profile, trusted contacts, SOS, and acknowledge flows are truly written on-chain, backend must have:

- `SOROBAN_CONTRACT_ID`
- `SOROBAN_RPC_URL`
- `SOROBAN_NETWORK_PASSPHRASE`
- `SERVER_PUBLIC_KEY`
- `SERVER_SECRET_KEY`

If these are missing or mismatched, write endpoints return `502` and local state is not persisted.

## Transaction Verification (Stellar Expert)

1. Trigger profile creation, trusted contacts save, SOS, and acknowledge from app.
2. Confirm each API response includes `blockchain.txHash` and `blockchain.explorerUrl`.
3. Open each tx in Stellar Expert (`https://stellar.expert/explorer/testnet/tx/<txHash>`).
4. Verify contract function name and arguments match the API payload.

## Metrics and Monitoring Submission Proof

- Metrics dashboard proof link: https://rakshacircle-backend.onrender.com/api/v1/raksha/metrics
- Monitoring dashboard proof link: https://rakshacircle-backend.onrender.com/api/v1/raksha/monitoring

### Metrics Dashboard Screenshot

![Metrics Dashboard](metrics%20and%20monitoring.png)

### Monitoring Dashboard Screenshot

![Monitoring Dashboard](MVP%20dashboard%20flow.png)

## Community and Improvement Evidence

- Community contribution package: [docs/COMMUNITY_CONTRIBUTION.md](docs/COMMUNITY_CONTRIBUTION.md)
## Feedback-Driven Improvement Roadmap 

Reference commit implemented from feedback:

## User Feed Implementation

User onboarding and feedback are now collected only through the live Google Form and linked response sheet.

**Google Form:** [RakshaCircle Real User Onboarding Form](https://docs.google.com/forms/d/e/1FAIpQLSdOfoZZjiQkpWCbxz6W20lo6qvNmNDocp36Fo3Vw1NjbjXIug/viewform?usp=publish-editor)

**Excel/Sheet Export:** [Real User Feedback Responses](https://docs.google.com/spreadsheets/d/1QHd7NRlK1xxFAf9LTUEV2XumoxzMsvjQr4wHqY4yNtY/edit?resourcekey=&gid=510051736#gid=510051736)

## Deployment and Operations

- Deployment runbook: [DEPLOYMENT.md](DEPLOYMENT.md)
- Architecture and data flow: [ARCHITECTURE.md](ARCHITECTURE.md)
- Security controls: [docs/SECURITY_CHECKLIST.md](docs/SECURITY_CHECKLIST.md)
- Production readiness summary: [docs/PRODUCTION_READINESS.md](docs/PRODUCTION_READINESS.md)
- End-user operating guide: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)

## Local Run (Quick)

```bash
# backend
npm install
npm run dev

# frontend (new terminal)
cd frontend
npm install
npm run dev
```

## License

MIT
