#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, log, Address, Env, String, Vec};

#[derive(Clone)]
#[contracttype]
pub struct UserProfile {
    pub wallet: Address,
    pub name: String,
    pub created_at: u64,
}

#[derive(Clone)]
#[contracttype]
pub struct SOSEvent {
    pub id: String,
    pub user_wallet: Address,
    pub event_type: String,
    pub context_hash: String,
    pub timestamp: u64,
    pub acknowledged_by: Vec<Address>,
}

#[contracttype]
pub enum DataKey {
    User(Address),
    UserContacts(Address),
    Event(String),
}

#[contract]
pub struct RakshaSafetyContract;

#[contractimpl]
impl RakshaSafetyContract {
    pub fn register_user(env: Env, wallet: Address, name: String) -> UserProfile {
        wallet.require_auth();

        let profile = UserProfile {
            wallet: wallet.clone(),
            name,
            created_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::User(wallet.clone()), &profile);

        log!(&env, "User registered");

        profile
    }

    pub fn get_user(env: Env, wallet: Address) -> Option<UserProfile> {
        env.storage()
            .persistent()
            .get(&DataKey::User(wallet))
    }

    pub fn add_trusted_contacts(env: Env, user: Address, contacts: Vec<Address>) {
        user.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::UserContacts(user.clone()), &contacts);

        log!(&env, "Trusted contacts updated");
    }

    pub fn get_trusted_contacts(env: Env, user: Address) -> Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::UserContacts(user))
            .unwrap_or_else(|| Vec::new(&env))
    }

    pub fn trigger_sos(
        env: Env,
        user: Address,
        event_id: String,
        event_type: String,
        context_hash: String,
    ) -> SOSEvent {
        user.require_auth();

        let event = SOSEvent {
            id: event_id.clone(),
            user_wallet: user.clone(),
            event_type,
            context_hash,
            timestamp: env.ledger().timestamp(),
            acknowledged_by: Vec::new(&env),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Event(event_id), &event);

        log!(&env, "SOS event triggered");

        event
    }

    pub fn acknowledge_sos(env: Env, event_id: String, contact: Address) -> bool {
        contact.require_auth();

        if let Some(mut event) = env
            .storage()
            .persistent()
            .get::<_, SOSEvent>(&DataKey::Event(event_id.clone()))
        {
            event.acknowledged_by.push_back(contact.clone());

            env.storage()
                .persistent()
                .set(&DataKey::Event(event_id), &event);

            log!(&env, "SOS event acknowledged");

            return true;
        }

        false
    }

    pub fn get_sos_event(env: Env, event_id: String) -> Option<SOSEvent> {
        env.storage()
            .persistent()
            .get(&DataKey::Event(event_id))
    }
}

#[cfg(all(test, not(target_family = "wasm")))]
mod tests {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::Env;

    #[test]
    fn test_register_user() {
        let env = Env::default();
        let contract_id = env.register_contract(None, RakshaSafetyContract);
        let client = RakshaSafetyContractClient::new(&env, &contract_id);
        let user = Address::generate(&env);
        let name = String::from_str(&env, "Test User");

        env.mock_all_auths();
        env.ledger().with_mut(|li| {
            li.timestamp = 0;
        });

        let profile = client.register_user(&user, &name);

        assert_eq!(profile.wallet, user);
        assert_eq!(profile.name, name);
    }

    #[test]
    fn test_trigger_sos_with_string_event_id() {
        let env = Env::default();
        let contract_id = env.register_contract(None, RakshaSafetyContract);
        let client = RakshaSafetyContractClient::new(&env, &contract_id);
        let user = Address::generate(&env);

        env.mock_all_auths();
        env.ledger().with_mut(|li| {
            li.timestamp = 100;
        });

        let name = String::from_str(&env, "Test User");
        client.register_user(&user, &name);

        let event_id = String::from_str(&env, "evt-123");
        let event_type = String::from_str(&env, "SOS");
        let context_hash = String::from_str(&env, "0xabcd1234");

        let event = client.trigger_sos(&user, &event_id, &event_type, &context_hash);

        assert_eq!(event.id, event_id);
        assert_eq!(event.user_wallet, user);
        assert_eq!(event.event_type, event_type);
        assert_eq!(event.context_hash, context_hash);
    }
}
