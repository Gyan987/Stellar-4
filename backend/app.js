import Fastify from 'fastify';
import cors from '@fastify/cors';
import authPlugin from './plugins/auth.js';
import rateLimitPlugin from './plugins/rate-limit.js';
import sorobanService from './services/sorobanService.js';
import { config } from './config/env.js';

// Import Routes
import navigationRoutes from './routes/navigation/index.js';
import rakshaRoutes from './routes/raksha/index.js';

export async function buildApp() {
    const app = Fastify({
        logger: true
    });

    // Initialize Soroban Service
    await sorobanService.initialize();

    // Global Plugins
    const allowAllOrigins = config.corsOrigin === '*';
    const normalizeOrigin = (value = '') => String(value).replace(/\/+$/, '');
    const allowedOrigins = config.corsOrigin
        .split(',')
        .map((origin) => normalizeOrigin(origin.trim()))
        .filter(Boolean);

    await app.register(cors, {
        origin: allowAllOrigins
            ? true
            : (origin, callback) => {
                if (!origin) {
                    callback(null, true);
                    return;
                }

                const requestOrigin = normalizeOrigin(origin);
                const isAllowed = allowedOrigins.includes(requestOrigin);
                callback(null, isAllowed);
            },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
    });

    // Custom Plugins
    await app.register(rateLimitPlugin);
    await app.register(authPlugin);

    // Health Check
    app.get('/health', async (request, reply) => {
        return { status: 'ok', timestamp: new Date().toISOString() };
    });

    // API Routes
    await app.register(navigationRoutes, { prefix: '/api/v1/navigation' });
    await app.register(rakshaRoutes, { prefix: '/api/v1/raksha' });

    return app;
}
