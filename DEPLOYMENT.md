# Deployment Guide (First-Time Setup)

This guide is written for a fresh deployment where nothing is deployed yet.

## Final Architecture

- Backend API: Render Web Service
- Frontend App: Vercel Project
- Smart Contract: Soroban on Stellar Testnet

## If Backend Is Already Deployed

If your backend is already live at `https://rakshacircle-backend.onrender.com`, continue from Step 3.

You only need to do these next:

1. Deploy smart contract (Step 3)
2. Add `SOROBAN_CONTRACT_ID` in Render backend env and redeploy
3. Deploy frontend with:
  - `VITE_API_BASE_URL=https://rakshacircle-backend.onrender.com`
4. Set backend `CORS_ORIGIN` to your final Vercel URL and redeploy once

## Step 0: Prepare Required Accounts and Tools

1. Create accounts:
- Render
- Vercel
- Stellar testnet wallet (for Soroban deploy)

2. Install tools locally:
- Node.js 20+
- npm
- Rust + cargo
- Soroban CLI

3. Keep these secrets ready:
- APP_API_KEY (one shared key for backend and frontend)
- GOOGLE_MAPS_API_KEY (server key for backend)
- VITE_GOOGLE_MAPS_API_KEY (browser key for frontend)
- GEMINI_API_KEY
- Stellar source account secret (for contract deploy)

## Step 1: Configure Backend Environment

Use this exact backend env template:

```env
PORT=8000
NODE_ENV=production

APP_API_KEY=replace_with_shared_app_key
GOOGLE_MAPS_API_KEY=replace_with_google_maps_server_key
GEMINI_API_KEY=replace_with_gemini_key

# Set this to your deployed Vercel app URL after frontend deploy.
# Example: https://your-app.vercel.app
CORS_ORIGIN=https://your-frontend.vercel.app

ENABLE_DEMO_SEED=false

# Contract settings (set SOROBAN_CONTRACT_ID after Step 3)
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
SOROBAN_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
SOROBAN_CONTRACT_ID=CCTDYXR5HVBLHG6ZZ3XSSZHBGUUFVPWLN36RVDNRNJVKLQQPPUXUN747

# Optional advanced settings
NIRBHAYA_SERVICE_URL=
SERVER_PUBLIC_KEY=replace_with_backend_signer_public_key
SERVER_SECRET_KEY=replace_with_backend_signer_secret_key
FEE_SPONSOR_WALLET=
```

Notes:
- `APP_API_KEY` and frontend `VITE_API_KEY` must be identical.
- On-chain writes require both `SOROBAN_CONTRACT_ID` and valid signer keys (`SERVER_PUBLIC_KEY`, `SERVER_SECRET_KEY`).
- If keys are missing or mismatched, write endpoints return `502` and local state is not mutated.

## Step 2: Deploy Backend on Render

1. Open Render -> New -> Web Service
2. Connect this GitHub repository
3. Configure:
- Name: `rakshacircle-backend`
- Runtime: `Node`
- Branch: `main`
- Root Directory: `backend`
- Build Command: `npm install`
- Start Command: `node server.js`
- Health Check Path: `/health`
4. Add backend environment variables from Step 1
5. Deploy

Verify backend:
- `GET https://your-backend-url.onrender.com/health`

Expected:
- status is ok

## Step 3: Deploy Soroban Smart Contract

From repository root (Windows PowerShell):

1. Install wasm target once

```powershell
rustup target add wasm32-unknown-unknown
```

2. Build contract

```bash
cd contracts/raksha-safety
cargo build --target wasm32-unknown-unknown --release
```

Expected output file:

- `contracts/raksha-safety/target/wasm32-unknown-unknown/release/raksha_safety.wasm`

3. Add deploy key identity (recommended)

```powershell
soroban keys add deployer --secret-key --network testnet
```

When prompted, paste your testnet secret key (starts with `S...`).

4. Deploy to testnet

```powershell
soroban contract deploy --wasm target/wasm32-unknown-unknown/release/raksha_safety.wasm --source-account deployer --network testnet --alias raksha_safety
```

5. Copy returned contract id (starts with `C`)
6. In Render backend env, set `SOROBAN_CONTRACT_ID=CCTDYXR5HVBLHG6ZZ3XSSZHBGUUFVPWLN36RVDNRNJVKLQQPPUXUN747`
7. Redeploy backend

Step 3 troubleshooting:

1. `no matching package named soroban-contract found`
- Fix: pull latest repository changes where contract manifest has been corrected.

2. Build succeeds in one terminal but fails in another
- Cause: old terminal still in a different directory/session.
- Fix: run with absolute path:

```powershell
Set-Location "C:/Users/Deep Saha/Desktop/level 5/contracts/raksha-safety"
cargo build --target wasm32-unknown-unknown --release
```

3. `target wasm32-unknown-unknown not installed`    
- Run: `rustup target add wasm32-unknown-unknown`

4. Contract deploy fails due source/network
- Verify source secret is funded on Stellar testnet.
- Verify Soroban CLI is configured for testnet.

5. `unexpected argument` when using `soroban keys add ... --secret-key S...`
- In Soroban v25, use `--secret-key` without value, then paste the key when prompted.

6. PowerShell parser errors for multi-line command
- Do not use bash-style `\` line continuations in PowerShell.
- Prefer a single-line command as shown above.

## Step 4: Configure Frontend Environment

Use this exact frontend env template:

```env
VITE_API_BASE_URL=https://rakshacircle-backend.onrender.com
VITE_API_KEY=replace_with_same_app_api_key
VITE_GOOGLE_MAPS_API_KEY=replace_with_google_maps_browser_key
```

Notes:
- No trailing slash in `VITE_API_BASE_URL`.
- `VITE_API_KEY` must match backend `APP_API_KEY` exactly.

## Step 5: Deploy Frontend on Vercel

1. Open Vercel -> Add New Project
2. Import this repository
3. Set Root Directory: `frontend`
4. Add frontend env variables from Step 4
5. Deploy

After frontend URL is generated:
1. Set backend `CORS_ORIGIN` to that exact Vercel URL
2. Redeploy backend once

## Step 6: Run Smoke Checks

Local backend smoke check:

```bash
npm run backend:smoke
```

Production checks:

1. `GET https://rakshacircle-backend.onrender.com/health`
2. Open frontend Vercel URL
3. Create profile
4. Save trusted contacts
5. Trigger SOS
6. Acknowledge event
7. Confirm each write response includes `blockchain.txHash`
8. Open each tx hash on Stellar Expert and verify invoked function + args
7. Check readiness endpoints:
- `/api/v1/raksha/metrics`
- `/api/v1/raksha/monitoring`
- `/api/v1/raksha/indexing`
- `/api/v1/raksha/production-readiness`

## Common Mistakes

1. 401 errors on API
- Cause: `APP_API_KEY` and `VITE_API_KEY` mismatch

2. CORS blocked in browser
- Cause: wrong `CORS_ORIGIN`
- Fix: set exact frontend URL (including https)

3. On-chain data not recorded
- Cause: wrong or missing `SOROBAN_CONTRACT_ID`
- Fix: set `SOROBAN_CONTRACT_ID=CCTDYXR5HVBLHG6ZZ3XSSZHBGUUFVPWLN36RVDNRNJVKLQQPPUXUN747` and redeploy backend

4. Route/chat issues
- Cause: missing Maps or Gemini keys
- Fix: verify backend env values and redeploy

## Security Checklist

- Do not commit real secrets
- Rotate keys if exposed
- Use separate local and production keys
- Restrict Google Maps browser key by referrer