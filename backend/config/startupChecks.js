import { config } from './env.js';
import { Keypair } from '@stellar/stellar-sdk';

function isEmpty(value) {
    return value === undefined || value === null || String(value).trim().length === 0;
}

function derivePublicKeyFromSecret(secretKey) {
    try {
        return Keypair.fromSecret(secretKey).publicKey();
    } catch {
        return null;
    }
}

export function runStartupChecks() {
    const warnings = [];

    if (isEmpty(config.appApiKey)) {
        warnings.push('APP_API_KEY is missing. Protected endpoints will reject requests with 401.');
    }

    if (isEmpty(config.googleMapsApiKey)) {
        warnings.push('GOOGLE_MAPS_API_KEY is missing. Route and map features may fail.');
    }

    if (isEmpty(config.geminiApiKey)) {
        warnings.push('GEMINI_API_KEY is missing. AI safety analysis may fall back or fail.');
    }

    if (config.nodeEnv === 'production' && config.corsOrigin === '*') {
        warnings.push('CORS_ORIGIN is set to *. Set your Vercel domain in production for safer CORS.');
    }

    if (isEmpty(config.sorobanContractId)) {
        warnings.push('SOROBAN_CONTRACT_ID is not set. On-chain recording is disabled.');
    } else {
        if (isEmpty(config.serverPublicKey) || isEmpty(config.serverSecretKey)) {
            warnings.push('SOROBAN_CONTRACT_ID is set, but SERVER_PUBLIC_KEY or SERVER_SECRET_KEY is missing. On-chain writes require both signer keys.');
        } else {
            const derivedPublicKey = derivePublicKeyFromSecret(config.serverSecretKey);

            if (!derivedPublicKey) {
                warnings.push('SERVER_SECRET_KEY is invalid and could not be parsed as a Stellar secret key.');
            } else if (derivedPublicKey !== config.serverPublicKey) {
                warnings.push('SERVER_PUBLIC_KEY does not match the public key derived from SERVER_SECRET_KEY.');
            }
        }
    }

    if (isEmpty(config.sorobanNetworkPassphrase)) {
        warnings.push('SOROBAN_NETWORK_PASSPHRASE is missing. Soroban transaction signing will fail.');
    }

    if (warnings.length > 0) {
        console.warn('\\n[Startup Checks] Deployment configuration warnings:');
        for (const warning of warnings) {
            console.warn(`- ${warning}`);
        }
        console.warn('');
    }
}
