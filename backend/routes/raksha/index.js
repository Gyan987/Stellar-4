import { createHash, randomUUID } from 'crypto';
import sorobanService from '../../services/sorobanService.js';
import productionReadinessService from '../../services/productionReadinessService.js';

const profiles = new Map();
const trustedContacts = new Map();
const userEvents = new Map();
const eventsById = new Map();

function normalizeWallet(walletAddress = '') {
    return walletAddress.trim().toUpperCase();
}

function getEventsForUser(walletAddress) {
    const normalizedWallet = normalizeWallet(walletAddress);
    if (!userEvents.has(normalizedWallet)) {
        userEvents.set(normalizedWallet, []);
    }

    return userEvents.get(normalizedWallet);
}

function hashContext(value = '') {
    return createHash('sha256').update(value).digest('hex');
}

function sendBlockchainFailure(reply, action, sorobanResult) {
    return reply.code(502).send({
        error: 'Bad Gateway',
        message: `Failed to record ${action} on Soroban.`,
        details: sorobanResult?.error || 'Unknown blockchain write failure',
        blockchain: sorobanResult
    });
}

export default async function rakshaRoutes(fastify) {
    fastify.post('/profile', async (request, reply) => {
        const { walletAddress, name } = request.body || {};

        if (!walletAddress || !name) {
            return reply.code(400).send({
                error: 'Bad Request',
                message: 'walletAddress and name are required'
            });
        }

        const normalizedWallet = normalizeWallet(walletAddress);
        const now = new Date().toISOString();
        const existing = profiles.get(normalizedWallet);

        const profile = {
            walletAddress: normalizedWallet,
            name: name.trim(),
            createdAt: existing?.createdAt || now,
            updatedAt: now
        };

        const sorobanResult = await sorobanService.registerUser(normalizedWallet, profile.name);
        if (!sorobanResult?.success) {
            return sendBlockchainFailure(reply, 'profile', sorobanResult);
        }

        profiles.set(normalizedWallet, profile);
        productionReadinessService.recordProfile(profile);

        return {
            profile,
            blockchain: sorobanResult
        };
    });

    fastify.get('/profile/:walletAddress', async (request) => {
        const normalizedWallet = normalizeWallet(request.params.walletAddress);
        const profile = profiles.get(normalizedWallet) || null;

        return {
            walletAddress: normalizedWallet,
            profile
        };
    });

    fastify.post('/trusted-contacts', async (request, reply) => {
        const { walletAddress, contacts } = request.body || {};

        if (!walletAddress || !Array.isArray(contacts)) {
            return reply.code(400).send({
                error: 'Bad Request',
                message: 'walletAddress and contacts array are required'
            });
        }

        const now = new Date().toISOString();
        const validContacts = contacts
            .filter((item) => item && item.name)
            .slice(0, 10)
            .map((item, index) => ({
                id: item.id || `contact-${index + 1}`,
                name: String(item.name).trim(),
                walletAddress: item.walletAddress ? normalizeWallet(item.walletAddress) : '',
                phone: item.phone ? String(item.phone).trim() : '',
                createdAt: item.createdAt || now
            }));

        const normalizedWallet = normalizeWallet(walletAddress);
        const sorobanResult = await sorobanService.addTrustedContacts(normalizedWallet, validContacts);

        if (!sorobanResult?.success) {
            return sendBlockchainFailure(reply, 'trusted contacts', sorobanResult);
        }

        trustedContacts.set(normalizedWallet, validContacts);
        productionReadinessService.recordContacts(normalizedWallet, validContacts);

        return {
            walletAddress: normalizedWallet,
            contacts: validContacts,
            blockchain: sorobanResult
        };
    });

    fastify.get('/trusted-contacts/:walletAddress', async (request) => {
        const normalizedWallet = normalizeWallet(request.params.walletAddress);

        return {
            walletAddress: normalizedWallet,
            contacts: trustedContacts.get(normalizedWallet) || []
        };
    });

    fastify.post('/sos', async (request, reply) => {
        const { walletAddress, eventType, contextHash, contextText, locationHint, useFeeSponsorship } = request.body || {};

        if (!walletAddress) {
            return reply.code(400).send({
                error: 'Bad Request',
                message: 'walletAddress is required'
            });
        }

        const normalizedWallet = normalizeWallet(walletAddress);
        const derivedContextHash = contextHash || hashContext(contextText || 'no-context-provided');
        const timestamp = new Date().toISOString();

        const event = {
            id: randomUUID(),
            walletAddress: normalizedWallet,
            eventType: eventType || 'emergency',
            contextHash: derivedContextHash,
            locationHint: locationHint || '',
            status: 'active',
            timestamp,
            acknowledgments: []
        };

        const sorobanResult = await sorobanService.triggerSOS(
            normalizedWallet,
            event.id,
            event.eventType,
            derivedContextHash
        );

        if (!sorobanResult?.success) {
            return sendBlockchainFailure(reply, 'SOS event', sorobanResult);
        }

        const events = getEventsForUser(normalizedWallet);
        events.unshift(event);
        eventsById.set(event.id, event);

        const feeSponsorship = useFeeSponsorship
            ? await sorobanService.buildFeeSponsoredAction('trigger_sos', {
                walletAddress: normalizedWallet,
                eventId: event.id,
                eventType: event.eventType,
                contextHash: derivedContextHash
            })
            : null;

        productionReadinessService.recordEvent(event);

        return {
            message: 'SOS recorded successfully',
            event,
            blockchain: sorobanResult,
            feeSponsorship
        };
    });

    fastify.post('/acknowledge', async (request, reply) => {
        const { eventId, contactWallet, note } = request.body || {};

        if (!eventId || !contactWallet) {
            return reply.code(400).send({
                error: 'Bad Request',
                message: 'eventId and contactWallet are required'
            });
        }

        const event = eventsById.get(eventId);
        if (!event) {
            return reply.code(404).send({
                error: 'Not Found',
                message: 'Event not found'
            });
        }

        const normalizedContactWallet = normalizeWallet(contactWallet);
        const alreadyAcknowledged = event.acknowledgments.some(
            (item) => item.contactWallet === normalizedContactWallet
        );

        if (alreadyAcknowledged) {
            return {
                message: 'Contact already acknowledged this event',
                event
            };
        }

        const nextAcknowledgment = {
            contactWallet: normalizedContactWallet,
            note: note ? String(note).trim() : '',
            timestamp: new Date().toISOString()
        };

        const sorobanResult = await sorobanService.acknowledgeSOS(eventId, normalizedContactWallet);

        if (!sorobanResult?.success) {
            return sendBlockchainFailure(reply, 'SOS acknowledgment', sorobanResult);
        }

        event.acknowledgments.push(nextAcknowledgment);
        event.status = event.acknowledgments.length > 0 ? 'acknowledged' : 'active';

        productionReadinessService.recordAcknowledgment(eventId, nextAcknowledgment);

        return {
            message: 'Acknowledgment recorded',
            event,
            blockchain: sorobanResult
        };
    });

    fastify.get('/events/:walletAddress', async (request) => {
        const normalizedWallet = normalizeWallet(request.params.walletAddress);
        return {
            walletAddress: normalizedWallet,
            events: userEvents.get(normalizedWallet) || []
        };
    });

    fastify.get('/dashboard/:walletAddress', async (request) => {
        const normalizedWallet = normalizeWallet(request.params.walletAddress);
        const events = userEvents.get(normalizedWallet) || [];

        return {
            walletAddress: normalizedWallet,
            totalEvents: events.length,
            acknowledgedEvents: events.filter((item) => item.status === 'acknowledged').length,
            activeEvents: events.filter((item) => item.status === 'active').length,
            totalAcknowledgments: events.reduce((sum, item) => sum + item.acknowledgments.length, 0)
        };
    });

    fastify.get('/blockchain-status', async () => {
        return sorobanService.getStatus();
    });

    fastify.get('/metrics', async () => {
        return productionReadinessService.getMetrics();
    });

    fastify.get('/monitoring', async () => {
        return productionReadinessService.getMonitoring(sorobanService.getStatus());
    });

    fastify.get('/indexing', async () => {
        return productionReadinessService.getIndexing();
    });

    fastify.get('/security-checklist', async () => {
        return productionReadinessService.getSecurityChecklist(sorobanService.getStatus());
    });

    fastify.get('/production-readiness', async () => {
        return productionReadinessService.getProductionReadiness(sorobanService.getStatus());
    });
}
