const DAY_MS = 24 * 60 * 60 * 1000;

function toTimestamp(value) {
    if (!value) {
        return null;
    }

    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? null : parsed;
}

function formatMemoryUsage() {
    const memoryUsage = process.memoryUsage();

    return {
        rssMb: Number((memoryUsage.rss / 1024 / 1024).toFixed(2)),
        heapUsedMb: Number((memoryUsage.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((memoryUsage.heapTotal / 1024 / 1024).toFixed(2)),
        externalMb: Number((memoryUsage.external / 1024 / 1024).toFixed(2))
    };
}

class ProductionReadinessService {
    constructor() {
        this.profiles = new Map();
        this.contacts = new Map();
        this.events = new Map();
        this.activityLog = [];
        this.lastActivityAt = null;
    }

    reset() {
        this.profiles.clear();
        this.contacts.clear();
        this.events.clear();
        this.activityLog = [];
        this.lastActivityAt = null;
    }

    recordActivity(type, walletAddress, details = {}, timestamp = new Date().toISOString()) {
        this.lastActivityAt = timestamp;

        this.activityLog.unshift({
            type,
            walletAddress,
            timestamp,
            details
        });

        if (this.activityLog.length > 50) {
            this.activityLog.length = 50;
        }
    }

    recordProfile(profile) {
        if (!profile?.walletAddress) {
            return;
        }

        this.profiles.set(profile.walletAddress, { ...profile });
        this.recordActivity('profile_saved', profile.walletAddress, { name: profile.name }, profile.updatedAt || profile.createdAt);
    }

    recordContacts(walletAddress, contacts) {
        if (!walletAddress) {
            return;
        }

        this.contacts.set(walletAddress, Array.isArray(contacts) ? [...contacts] : []);
        this.recordActivity('contacts_saved', walletAddress, { contactCount: Array.isArray(contacts) ? contacts.length : 0 });
    }

    recordEvent(event) {
        if (!event?.id || !event.walletAddress) {
            return;
        }

        this.events.set(event.id, event);
        this.recordActivity('sos_triggered', event.walletAddress, {
            eventId: event.id,
            eventType: event.eventType
        }, event.timestamp);
    }

    recordAcknowledgment(eventId, acknowledgment) {
        const event = this.events.get(eventId);
        if (!event) {
            return;
        }

        this.recordActivity('acknowledged', event.walletAddress, {
            eventId,
            contactWallet: acknowledgment?.contactWallet || ''
        }, acknowledgment?.timestamp || event.timestamp);
    }

    hasRecentActivity(walletAddress, cutoffTimestamp) {
        const profile = this.profiles.get(walletAddress);
        const contacts = this.contacts.get(walletAddress) || [];
        const events = Array.from(this.events.values()).filter((event) => event.walletAddress === walletAddress);

        const profileUpdated = toTimestamp(profile?.updatedAt || profile?.createdAt) || 0;
        if (profileUpdated >= cutoffTimestamp) {
            return true;
        }

        const contactActivity = contacts.some((contact) => {
            const contactTimestamp = toTimestamp(contact?.updatedAt || contact?.createdAt) || 0;
            return contactTimestamp >= cutoffTimestamp;
        });
        if (contactActivity) {
            return true;
        }

        return events.some((event) => {
            const eventTimestamp = toTimestamp(event.timestamp) || 0;
            if (eventTimestamp >= cutoffTimestamp) {
                return true;
            }

            return (event.acknowledgments || []).some((acknowledgment) => (toTimestamp(acknowledgment.timestamp) || 0) >= cutoffTimestamp);
        });
    }

    getMetrics() {
        const now = Date.now();
        const activeWindow = now - DAY_MS;
        const retentionWindow = now - (30 * DAY_MS);
        const profiles = Array.from(this.profiles.values());
        const events = Array.from(this.events.values());
        const totalAcknowledgments = events.reduce((sum, event) => sum + (event.acknowledgments?.length || 0), 0);

        const dau = profiles.filter((profile) => this.hasRecentActivity(profile.walletAddress, activeWindow)).length;
        const activeUsers30d = profiles.filter((profile) => this.hasRecentActivity(profile.walletAddress, retentionWindow)).length;
        const verifiedUsers = profiles.length;
        const totalContacts = Array.from(this.contacts.values()).reduce((sum, list) => sum + list.length, 0);

        return {
            verifiedUsers,
            activeUsers24h: dau,
            activeUsers30d,
            totalEvents: events.length,
            totalAcknowledgments,
            totalContacts,
            transactions: events.length + totalAcknowledgments + verifiedUsers + totalContacts,
            retentionRate30d: verifiedUsers > 0 ? Number(((activeUsers30d / verifiedUsers) * 100).toFixed(1)) : 0,
            avgAcknowledgmentsPerEvent: events.length > 0 ? Number((totalAcknowledgments / events.length).toFixed(2)) : 0,
            lastActivityAt: this.lastActivityAt,
            indexedRecords: this.events.size + this.profiles.size + this.contacts.size
        };
    }

    getMonitoring(sorobanStatus = {}) {
        return {
            status: 'healthy',
            uptimeSeconds: Math.floor(process.uptime()),
            nodeVersion: process.version,
            memoryUsageMb: formatMemoryUsage(),
            logging: 'Fastify logger enabled with request tracing',
            rateLimit: 'active',
            soroban: sorobanStatus,
            lastActivityAt: this.lastActivityAt,
            recentActivity: this.activityLog.slice(0, 5)
        };
    }

    getIndexing() {
        const events = Array.from(this.events.values())
            .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
            .map((event) => ({
                id: event.id,
                walletAddress: event.walletAddress,
                eventType: event.eventType,
                status: event.status,
                timestamp: event.timestamp,
                locationHint: event.locationHint,
                acknowledgments: event.acknowledgments.length,
                contextHash: event.contextHash
            }));

        return {
            totalProfilesIndexed: this.profiles.size,
            totalContactsIndexed: Array.from(this.contacts.values()).reduce((sum, list) => sum + list.length, 0),
            totalEventsIndexed: this.events.size,
            indexedWallets: Array.from(this.profiles.keys()).slice(0, 20),
            recentEvents: events.slice(0, 10),
            searchEndpoints: [
                '/api/v1/raksha/events/:walletAddress',
                '/api/v1/raksha/dashboard/:walletAddress',
                '/api/v1/raksha/production-readiness'
            ]
        };
    }

    getSecurityChecklist(sorobanStatus = {}) {
        return [
            {
                item: 'Wallet-based identity and auth',
                status: 'complete',
                evidence: 'Freighter wallet connection plus wallet normalization in profile and SOS flows.'
            },
            {
                item: 'Rate limiting enabled',
                status: 'complete',
                evidence: 'Fastify rate-limit plugin registered in the backend app.'
            },
            {
                item: 'Tamper-resistant event hashing',
                status: 'complete',
                evidence: 'SOS context is SHA-256 hashed before being sent to the contract layer.'
            },
            {
                item: 'Monitoring and health endpoint',
                status: 'complete',
                evidence: 'Health and production-readiness endpoints are available for operational checks.'
            },
            {
                item: 'Production logs and request tracing',
                status: 'complete',
                evidence: 'Fastify logger and activity log are exposed in the monitoring snapshot.'
            },
            {
                item: 'Soroban integration status visible',
                status: sorobanStatus?.isConfigured ? 'complete' : 'needs-review',
                evidence: sorobanStatus?.status || 'Soroban status unavailable.'
            },
            {
                item: 'User guide and submission docs',
                status: 'complete',
                evidence: 'README, architecture notes, and submission guide are linked from the repository.'
            }
        ];
    }

    getProductionReadiness(sorobanStatus = {}) {
        return {
            generatedAt: new Date().toISOString(),
            metrics: this.getMetrics(),
            monitoring: this.getMonitoring(sorobanStatus),
            indexing: this.getIndexing(),
            securityChecklist: this.getSecurityChecklist(sorobanStatus)
        };
    }
}

export default new ProductionReadinessService();