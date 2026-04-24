# RakshaCircle Architecture

## System Overview

RakshaCircle is a blockchain-based women safety platform built on Stellar Soroban. It combines a React frontend, Node.js backend, and Soroban smart contracts to create a tamper-proof emergency alert and response system.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interface (React)                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Profile  │  │ Contacts │  │ SOS      │  │ History  │        │
│  │ Setup    │  │ Setup    │  │ Trigger  │  │ & Stats  │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
└───────┼─────────────┼─────────────┼─────────────┼───────────────┘
        │             │             │             │
        └─────────────┼─────────────┼─────────────┘
                      │
        ┌─────────────▼──────────────┐
        │                            │
        │  Freighter Wallet          │
        │  (Auth & Signing)          │
        │                            │
        └─────────────┬──────────────┘
                      │
        ┌─────────────▼────────────────────────────────┐
        │       REST API (Node.js / Fastify)           │
        ├──────────────────────────────────────────────┤
        │ POST   /api/v1/raksha/profile                │
        │ POST   /api/v1/raksha/trusted-contacts       │
        │ POST   /api/v1/raksha/sos                    │
        │ POST   /api/v1/raksha/acknowledge            │
        │ GET    /api/v1/raksha/events                 │
        │ GET    /api/v1/raksha/blockchain-status      │
        └──────────────────────────────────────────────┘
                      │
        ┌─────────────┴──────────────────────┐
        │                                    │
        ▼                                    ▼
   In-Memory Storage              Soroban Service
   (User Profiles,                (Blockchain Calls)
    Contacts,                           │
    Events)                             │
                                 ┌──────▼────────────┐
                                 │  Stellar Testnet  │
                                 ├───────────────────┤
                                 │  RakshaSafety     │
                                 │  Smart Contract   │
                                 │                   │
                                 │ Functions:        │
                                 │ - register_user   │
                                 │ - trigger_sos     │
                                 │ - acknowledge_sos │
                                 │ - get_events      │
                                 │                   │
                                 │ Persistent Data:  │
                                 │ - User Profiles   │
                                 │ - Trusted Circles │
                                 │ - SOS Events      │
                                 │ - Acknowledgments │
                                 └───────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS + Shadcn/ui components
- **Wallet Integration**: Freighter Wallet SDK
- **API Client**: Fetch API

### Backend
- **Runtime**: Node.js
- **Framework**: Fastify 5.x
- **Language**: JavaScript (ES Modules)
- **Authentication**: Custom auth plugin + wallet signing
- **Rate Limiting**: In-memory rate limit plugin
- **Storage**: In-memory Maps (for MVP)

### Blockchain
- **Network**: Stellar Soroban Testnet
- **Language**: Rust (WebAssembly)
- **Contract**: raksha-safety
- **SDK**: Soroban SDK 20.0.0

## Data Flow

### 1. User Registration
```
Frontend → User enters wallet + name
         → Submit to Backend POST /profile
         → Backend stores in memory
         → Backend calls Soroban: register_user()
         → Soroban records user on-chain
         → Response: {profile, blockchain_status}
```

### 2. Add Trusted Contacts
```
Frontend → User adds contacts (name + wallet)
         → Submit to Backend POST /trusted-contacts
         → Backend validates contacts
         → Backend stores in memory
         → Backend calls Soroban: add_trusted_contacts()
         → Soroban records circle on-chain
         → Response: {contactList, blockchain_status}
```

### 3. Trigger SOS
```
Frontend → User clicks "SOS Alert" button
         → Gather context (location, description)
         → Hash context data (SHA-256)
         → Submit to Backend POST /sos
         → Backend creates event record
         → Backend stores in memory
         → Backend calls Soroban: trigger_sos()
         → Soroban creates immutable event on-chain
         → Backend would trigger notifications (mock for MVP)
         → Response: {event_id, event_details, blockchain_status}
```

### 4. Acknowledge Alert
```
Trusted Contact → Receives SOS notification
                → Clicks "Acknowledge" in frontend
                → Submit to Backend POST /acknowledge
                → Backend records acknowledgment
                → Backend calls Soroban: acknowledge_sos()
                → Soroban appends contact to event acknowledgments
                → Response: {ack_status, event_details, blockchain_status}
```

### 5. View Dashboard
```
User/Contact → Request Backend GET /dashboard/:walletAddress
             → Backend calculates stats from in-memory events
             → Response: {total_events, acknowledged, active, stats}
```

## Smart Contract Functions

### Core Functions

#### `register_user(wallet: Address, name: String) -> UserProfile`
- **Purpose**: Register a new user on the Raksha safety network
- **Auth**: Requires user wallet signature
- **Storage**: Stores UserProfile in persistent ledger
- **Returns**: UserProfile with timestamp

#### `add_trusted_contacts(user: Address, contacts: Vec<TrustedContact>)`
- **Purpose**: Store trusted emergency contacts for a user
- **Auth**: Requires user wallet signature
- **Storage**: Stores contact list in persistent ledger
- **Validation**: Enforces max 10 contacts, validates wallet addresses

#### `trigger_sos(user: Address, event_type: String, context_hash: String) -> SOSEvent`
- **Purpose**: Create an immutable SOS emergency event
- **Auth**: Requires user wallet signature
- **Storage**: Stores event with unique ID in persistent ledger
- **Generates**: Unique event ID via auto-incrementing counter
- **Timestamp**: Records blockchain timestamp for immutability

#### `acknowledge_sos(event_id: U256, contact: Address) -> bool`
- **Purpose**: Record a contact's acknowledgment of SOS
- **Auth**: Requires contact wallet signature
- **Storage**: Appends contact to event's acknowledgment list
- **Returns**: true if successful, false if event not found

### Query Functions

- `get_user(wallet: Address) -> Option<UserProfile>`
- `get_trusted_contacts(user: Address) -> Vec<TrustedContact>`
- `get_sos_event(event_id: U256) -> Option<SOSEvent>`

## Data Structures

### Backend (In-Memory)
```
profiles: Map<wallet_address> = {
  wallet_address: string,
  name: string,
  createdAt: ISO8601_timestamp,
  updatedAt: ISO8601_timestamp
}

trustedContacts: Map<wallet_address> = {
  wallet_address: string,
  contacts: [{
    id: string,
    name: string,
    walletAddress: string,
    phone: string
  }, ...]
}

userEvents: Map<wallet_address> = [{
  id: uuid,
  walletAddress: string,
  eventType: string,
  contextHash: sha256_hash,
  locationHint: string,
  status: "active" | "acknowledged",
  timestamp: ISO8601_timestamp,
  acknowledgments: [{
    contactWallet: string,
    note: string,
    timestamp: ISO8601_timestamp
  }, ...]
}, ...]
```

### Soroban Contract (On-Chain Persistent Ledger)
```
UserProfile {
  wallet: Address,
  name: String,
  created_at: u64 (Unix timestamp)
}

TrustedContact {
  name: String,
  wallet: Address
}

SOSEvent {
  id: U256,
  user_wallet: Address,
  event_type: String,
  context_hash: String,
  timestamp: u64,
  acknowledged_by: Vec<Address>
}

DataKey (Ledger Keys):
- NextEventId
- User(wallet_address)
- UserContacts(wallet_address)
- Event(event_id)
```

## Security Model

### Authentication
- **Wallet-Based**: Users authenticate via Freighter wallet signatures
- **Transaction Signing**: All on-chain operations require wallet authorization
- **No Passwords**: Wallet address is the identity

### Data Integrity
- **On-Chain**: Critical data (events, acknowledgments) stored immutably on Soroban
- **Context Hashing**: Large data (location, description) hashed and linked on-chain
- **Tamper-Proof**: Smart contract enforces all updates

### Privacy
- **Minimal On-Chain Data**: Only verification metadata on blockchain
- **Sensitive Data Off-Chain**: Location, personal context stored off-chain with hash reference
- **Access Control**: Contract enforces user authorization for all operations

### Rate Limiting
- **Backend**: Rate limit plugin (10 requests/minute per IP)
- **Contract**: Soroban enforces sequence numbers to prevent replay

## Deployment Strategy

### Development
```
1. Backend: npm run dev (runs on localhost:3000)
2. Frontend: npm run dev (runs on localhost:5173)
3. Soroban: Testnet contract deployed manually
4. Local Testing: Both services run locally, contract on testnet
```

### Testing
```
1. Unit Tests: Backend routes (see routes/raksha/index.js)
2. Integration Tests: End-to-end flow with 5 testnet users
3. Contract Tests: Rust test suite (cargo test)
4. User Validation: Google Form feedback from real users
```

### Production (Level 6)
```
1. Frontend: Deploy to Vercel or similar
2. Backend: Deploy to Render or similar
3. Contract: Deploy to Stellar mainnet
4. Database: Switch from in-memory to PostgreSQL
5. Monitoring: Add observability and alerting
```

## Scalability Considerations

### Current MVP Limitations
- In-memory storage (lost on restart)
- Single Node.js process
- No persistent database
- No monitoring or observability

### Level 6 Upgrades
- **Database**: PostgreSQL for persistent storage
- **Caching**: Redis for hot data
- **Indexing**: Soroban RPC indexer for blockchain queries
- **Notifications**: Real email/SMS notifications (mocked for MVP)
- **Load Balancing**: Multiple backend instances
- **Monitoring**: Prometheus + Grafana for metrics

## API Reference

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed API endpoint documentation.

## Files & Structure

```
RakshaCircle/
├── frontend/                 # React UI
│   ├── src/
│   │   ├── pages/SubmissionMvp.tsx
│   │   ├── components/
│   │   ├── services/rakshaMvp.ts
│   │   └── ...
│   └── package.json
│
├── backend/                  # Node.js API
│   ├── routes/
│   │   └── raksha/index.js   # Core MVP endpoints
│   ├── services/
│   │   └── sorobanService.js # Blockchain integration
│   ├── plugins/
│   ├── app.js
│   ├── server.js
│   └── package.json
│
├── contracts/                # Soroban Smart Contract
│   └── raksha-safety/
│       ├── src/lib.rs
│       ├── Cargo.toml
│       └── README.md
│
└── docs/
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md
  ├── SECURITY_CHECKLIST.md
  └── USER_GUIDE.md
```

## Environment Variables

### Backend (.env)
```
PORT=3000
NODE_ENV=development
SOROBAN_CONTRACT_ID=C... (optional, for testnet)
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
SERVER_PUBLIC_KEY=(optional)
SERVER_SECRET_KEY=(optional)
```

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

## Conclusion

RakshaCircle combines off-chain efficiency with on-chain immutability:
- **Off-chain**: User profiles, notifications, dashboards for speed
- **On-chain**: Critical records (events, acknowledgments) for tamper-proof proof
- **Hybrid**: Best of both worlds—fast & decentralized
