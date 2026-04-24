# Raksha Safety Smart Contract

A Soroban smart contract for the RakshaCircle women safety platform on the Stellar network.

## Features

- **User Registration**: Register users with their Stellar wallet address and name
- **Trusted Circles**: Manage lists of trusted contacts for emergency notifications
- **SOS Events**: Trigger immutable SOS events on-chain with context hashes
- **Event Acknowledgment**: Allow trusted contacts to acknowledge emergency alerts
- **Tamper-Proof Records**: All events are stored on-chain with cryptographic integrity

## Contract Functions

### Public Functions

#### `register_user(wallet: Address, name: String) -> UserProfile`
Register a new user on the Raksha safety network.
- Requires user authorization
- Stores user profile on-chain
- Returns UserProfile struct

#### `get_user(wallet: Address) -> Option<UserProfile>`
Retrieve user profile by wallet address.

#### `add_trusted_contacts(user: Address, contacts: Vec<Address>)`
Add or update trusted contacts for a user.
- Requires user authorization
- Stores contact list on-chain

#### `get_trusted_contacts(user: Address) -> Vec<Address>`
Retrieve trusted contacts for a given user.

#### `trigger_sos(user: Address, event_id: String, event_type: String, context_hash: String) -> SOSEvent`
Trigger an SOS emergency event.
- Requires user authorization
- Creates immutable on-chain record
- Uses backend-provided event UUID
- Records timestamp from blockchain

#### `acknowledge_sos(event_id: String, contact: Address) -> bool`
Acknowledge an SOS event as a trusted contact.
- Requires contact authorization
- Appends contact to event acknowledgment list
- Returns success status

#### `get_sos_event(event_id: String) -> Option<SOSEvent>`
Retrieve details of a specific SOS event.

## Data Structures

### UserProfile
```rust
pub struct UserProfile {
    pub wallet: Address,
    pub name: String,
    pub created_at: u64,  // Timestamp
}
```

### SOSEvent
```rust
pub struct SOSEvent {
    pub id: String,                        // Backend event UUID
    pub user_wallet: Address,              // User who triggered SOS
    pub event_type: String,                // "SOS", "CHECK_IN", etc.
    pub context_hash: String,              // Hash of off-chain data
    pub timestamp: u64,                    // Event timestamp
    pub acknowledged_by: Vec<Address>,     // List of acknowledging contacts
}
```

## Data Storage Strategy

- **User Profiles**: Persistent storage, keyed by wallet address
- **Trusted Circles**: Persistent storage, keyed by user wallet
- **SOS Events**: Persistent storage, keyed by backend event ID (String)

All data is stored in Soroban's persistent ledger, ensuring immutability and decentralization.

## Deployment

### Prerequisites

- Rust 1.56+ (with Wasm target)
- Soroban CLI
- Stellar testnet account with XLM for fees

### Build

```bash
cd contracts/raksha-safety
cargo build --target wasm32-unknown-unknown --release
```

Output: `target/wasm32-unknown-unknown/release/raksha_safety.wasm`

### Deploy to Testnet

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/raksha_safety.wasm \
  --source <your-account-secret> \
  --network testnet
```

This will return a contract ID (starting with 'C'). Use this ID in your backend to call contract functions.

### Testing Locally

```bash
cargo test --lib
```

## Integration with Backend

The Node.js backend will interact with this contract via the Soroban RPC service:

1. User registers on frontend → Backend calls `register_user` contract function
2. User adds trusted contacts → Backend calls `add_trusted_contacts`
3. User triggers SOS → Backend calls `trigger_sos`
4. Trusted contact acknowledges → Backend calls `acknowledge_sos`

## Backend Signing Requirement

Chain writes from backend require all of the following env vars:

- `SOROBAN_CONTRACT_ID`
- `SERVER_PUBLIC_KEY`
- `SERVER_SECRET_KEY`
- `SOROBAN_NETWORK_PASSPHRASE`

If these are missing or mismatched, write endpoints should fail fast.

## Verify Transactions in Stellar Expert

1. Trigger profile, contacts, SOS, and acknowledge flows via API.
2. Copy `blockchain.txHash` from each API response.
3. Open `https://stellar.expert/explorer/testnet/tx/<txHash>`.
4. Confirm contract ID, function name, and args match payload.

## Security Notes

- All contract functions require authorization via wallet signature
- Event data is immutable once recorded
- Context hashes allow linking large data structures to on-chain records
- Access control is enforced at the contract level
- No private data is stored on-chain (use hashing for sensitive info)

## Testnet

- Network: Stellar Public Testnet
- RPC Endpoint: `https://soroban-testnet.stellar.org`
- Chain ID: `7ac33997544e31ff7d0140f76996ad1912be2849334e426e1b91cf05d66a3e21`

## License

MIT
