import { API_BASE_URL } from '@/config';

const baseUrl = API_BASE_URL || 'http://localhost:3000';
const apiPrefix = `${baseUrl}/api/v1/raksha`;

export type TrustedContact = {
  id?: string;
  name: string;
  walletAddress?: string;
  phone?: string;
  createdAt?: string;
};

export type SosEvent = {
  id: string;
  walletAddress: string;
  eventType: string;
  contextHash: string;
  locationHint: string;
  status: 'active' | 'acknowledged';
  timestamp: string;
  acknowledgments: Array<{
    contactWallet: string;
    note: string;
    timestamp: string;
  }>;
};

export type ProductionReadinessResponse = {
  generatedAt: string;
  metrics: {
    verifiedUsers: number;
    activeUsers24h: number;
    activeUsers30d: number;
    totalEvents: number;
    totalAcknowledgments: number;
    totalContacts: number;
    transactions: number;
    retentionRate30d: number;
    avgAcknowledgmentsPerEvent: number;
    lastActivityAt: string | null;
    indexedRecords: number;
  };
  monitoring: {
    status: string;
    uptimeSeconds: number;
    nodeVersion: string;
    memoryUsageMb: {
      rssMb: number;
      heapUsedMb: number;
      heapTotalMb: number;
      externalMb: number;
    };
    logging: string;
    rateLimit: string;
    soroban: Record<string, unknown>;
    lastActivityAt: string | null;
    recentActivity: Array<{
      type: string;
      walletAddress: string;
      timestamp: string;
      details: Record<string, unknown>;
    }>;
  };
  indexing: {
    totalProfilesIndexed: number;
    totalContactsIndexed: number;
    totalEventsIndexed: number;
    indexedWallets: string[];
    recentEvents: Array<{
      id: string;
      walletAddress: string;
      eventType: string;
      status: string;
      timestamp: string;
      locationHint: string;
      acknowledgments: number;
      contextHash: string;
    }>;
    searchEndpoints: string[];
  };
  securityChecklist: Array<{
    item: string;
    status: 'complete' | 'needs-review';
    evidence: string;
  }>;
};

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || body.error || message;
    } catch {
      // Ignore parse errors and keep fallback message.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function saveProfile(walletAddress: string, name: string) {
  const response = await fetch(`${apiPrefix}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, name }),
  });

  return parseResponse<{ profile: { walletAddress: string; name: string } }>(response);
}

export async function getProfile(walletAddress: string) {
  const response = await fetch(`${apiPrefix}/profile/${encodeURIComponent(walletAddress)}`);
  if (response.status === 404) {
    return { profile: null };
  }

  return parseResponse<{ profile: { walletAddress: string; name: string } | null }>(response);
}

export async function saveTrustedContacts(walletAddress: string, contacts: TrustedContact[]) {
  const response = await fetch(`${apiPrefix}/trusted-contacts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, contacts }),
  });

  return parseResponse<{ contacts: TrustedContact[] }>(response);
}

export async function getTrustedContacts(walletAddress: string) {
  const response = await fetch(`${apiPrefix}/trusted-contacts/${encodeURIComponent(walletAddress)}`);
  return parseResponse<{ contacts: TrustedContact[] }>(response);
}

export async function triggerSos(payload: {
  walletAddress: string;
  eventType: string;
  contextText: string;
  locationHint: string;
  useFeeSponsorship?: boolean;
}) {
  const response = await fetch(`${apiPrefix}/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return parseResponse<{ event: SosEvent; feeSponsorship: unknown }>(response);
}

export async function acknowledgeEvent(eventId: string, contactWallet: string, note: string) {
  const response = await fetch(`${apiPrefix}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventId, contactWallet, note }),
  });

  return parseResponse<{ event: SosEvent }>(response);
}

export async function getEvents(walletAddress: string) {
  const response = await fetch(`${apiPrefix}/events/${encodeURIComponent(walletAddress)}`);
  return parseResponse<{ events: SosEvent[] }>(response);
}

export async function getProductionReadiness() {
  const response = await fetch(`${apiPrefix}/production-readiness`);
  return parseResponse<ProductionReadinessResponse>(response);
}
