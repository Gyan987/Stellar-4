import { buildApp } from '../app.js';

async function run() {
    const app = await buildApp();

    try {
        const health = await app.inject({ method: 'GET', url: '/health' });
        if (health.statusCode !== 200) {
            throw new Error(`Health check failed with status ${health.statusCode}`);
        }

        const seed = await app.inject({
            method: 'POST',
            url: '/api/v1/raksha/seed-demo',
            payload: { users: 3 }
        });

        if (seed.statusCode !== 200) {
            throw new Error(`Demo seed failed with status ${seed.statusCode}`);
        }

        const wallet = JSON.parse(seed.body).primaryWallet;

        const profile = await app.inject({
            method: 'POST',
            url: '/api/v1/raksha/profile',
            payload: { walletAddress: wallet, name: 'Smoke User' }
        });

        if (profile.statusCode !== 200) {
            throw new Error(`Profile save failed with status ${profile.statusCode}`);
        }

        const sos = await app.inject({
            method: 'POST',
            url: '/api/v1/raksha/sos',
            payload: {
                walletAddress: wallet,
                eventType: 'SOS',
                contextText: 'smoke-test',
                locationHint: 'test-location'
            }
        });

        if (sos.statusCode !== 200) {
            throw new Error(`SOS failed with status ${sos.statusCode}`);
        }

        const readiness = await app.inject({ method: 'GET', url: '/api/v1/raksha/production-readiness' });
        if (readiness.statusCode !== 200) {
            throw new Error(`Readiness failed with status ${readiness.statusCode}`);
        }

        console.log('Smoke check passed: health, seed-demo, profile, sos, production-readiness');
    } finally {
        await app.close();
    }
}

run().catch((error) => {
    console.error('Smoke check failed:', error.message);
    process.exit(1);
});
