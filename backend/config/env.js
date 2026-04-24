import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load backend/.env, even when the app is started from repository root.
dotenv.config({ path: path.resolve(__dirname, '../.env') });
// Also allow process-level env vars from current working directory .env if present.
dotenv.config();

export const config = {
    port: process.env.PORT || 8000,
    nodeEnv: process.env.NODE_ENV || 'development',
    apiKeyHeader: 'x-api-key',
    appApiKey: process.env.APP_API_KEY,
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    nirbhayaServiceUrl: process.env.NIRBHAYA_SERVICE_URL || 'http://localhost:8001',
    sorobanRpcUrl: process.env.SOROBAN_RPC_URL || 'https://soroban-testnet.stellar.org',
    sorobanContractId: process.env.SOROBAN_CONTRACT_ID || '',
    sorobanNetworkPassphrase: process.env.SOROBAN_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
    serverPublicKey: process.env.SERVER_PUBLIC_KEY || '',
    serverSecretKey: process.env.SERVER_SECRET_KEY || '',
    feeSponsorWallet: process.env.FEE_SPONSOR_WALLET || '',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    enableDemoSeed: process.env.ENABLE_DEMO_SEED === 'true',
    rateLimit: {
        max: 100,
        timeWindow: '1 minute'
    }
};
