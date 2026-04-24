import { useCallback, useEffect, useState } from 'react';
import { getProductionReadiness, ProductionReadinessResponse } from '@/services/rakshaMvp';

type Props = {
  walletAddress?: string;
  refreshToken?: number;
};

const initialState: ProductionReadinessResponse | null = null;

function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}h ${minutes}m ${seconds}s`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

export default function ProductionReadinessPanel({ walletAddress, refreshToken = 0 }: Props) {
  const [readiness, setReadiness] = useState<ProductionReadinessResponse | null>(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [manualRefreshCounter, setManualRefreshCounter] = useState(0);

  const loadReadiness = useCallback(async () => {
    try {
      const result = await getProductionReadiness();
      setReadiness(result);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load production readiness');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const refreshDashboard = async () => {
      setIsLoading(true);
      await loadReadiness();
    };

    refreshDashboard();
    const interval = window.setInterval(refreshDashboard, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadReadiness, manualRefreshCounter, refreshToken]);

  return (
    <section className="submission-card readiness-card">
      <div className="card-heading-row">
        <div>
          <p className="eyebrow">Level 6</p>
          <h2>Production Readiness</h2>
        </div>
        <button className="ghost" type="button" onClick={() => setManualRefreshCounter((current) => current + 1)}>
          Refresh dashboard
        </button>
      </div>

      <p className="muted">
        Live signals for production readiness: metrics, monitoring, indexed data, and security coverage.
        {walletAddress ? ` Current wallet: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}.` : ''}
      </p>

      {isLoading && <p className="muted">Loading live metrics...</p>}
      {error && <p className="status-text">{error}</p>}

      {readiness && (
        <div className="readiness-stack">
          <div className="metric-grid">
            <article className="metric-card">
              <span>Verified users</span>
              <strong>{formatNumber(readiness.metrics.verifiedUsers)}</strong>
              <small>Wallet-backed profiles indexed</small>
            </article>
            <article className="metric-card">
              <span>DAU</span>
              <strong>{formatNumber(readiness.metrics.activeUsers24h)}</strong>
              <small>Active in the last 24 hours</small>
            </article>
            <article className="metric-card">
              <span>30-day retention</span>
              <strong>{readiness.metrics.retentionRate30d}%</strong>
              <small>Users with activity in the last 30 days</small>
            </article>
            <article className="metric-card">
              <span>Transactions</span>
              <strong>{formatNumber(readiness.metrics.transactions)}</strong>
              <small>Profiles, contacts, SOS, and acknowledgments</small>
            </article>
          </div>

          <div className="readiness-columns">
            <article className="mini-panel">
              <h3>Monitoring</h3>
              <p className="muted">Status: <strong>{readiness.monitoring.status}</strong></p>
              <p className="muted">Uptime: {formatDuration(readiness.monitoring.uptimeSeconds)}</p>
              <p className="muted">Node: {readiness.monitoring.nodeVersion}</p>
              <p className="muted">
                Memory: {readiness.monitoring.memoryUsageMb.heapUsedMb} MB used / {readiness.monitoring.memoryUsageMb.heapTotalMb} MB total
              </p>
              <p className="muted">Logging: {readiness.monitoring.logging}</p>
              <p className="muted">Rate limiting: {readiness.monitoring.rateLimit}</p>
              <p className="muted">
                Soroban: {String(readiness.monitoring.soroban.status || readiness.monitoring.soroban.isConfigured || 'unknown')}
              </p>
            </article>

            <article className="mini-panel">
              <h3>Data Indexing</h3>
              <p className="muted">Profiles indexed: {formatNumber(readiness.indexing.totalProfilesIndexed)}</p>
              <p className="muted">Contacts indexed: {formatNumber(readiness.indexing.totalContactsIndexed)}</p>
              <p className="muted">Events indexed: {formatNumber(readiness.indexing.totalEventsIndexed)}</p>
              <p className="muted">Indexed records: {formatNumber(readiness.metrics.indexedRecords)}</p>
              <div className="endpoint-list">
                {readiness.indexing.searchEndpoints.map((endpoint) => (
                  <code key={endpoint} className="endpoint-pill">{endpoint}</code>
                ))}
              </div>
            </article>
          </div>

          <article className="mini-panel">
            <h3>Security Checklist</h3>
            <div className="checklist-list">
              {readiness.securityChecklist.map((item) => (
                <div key={item.item} className={`checklist-item ${item.status}`}>
                  <div>
                    <strong>{item.item}</strong>
                    <p className="muted">{item.evidence}</p>
                  </div>
                  <span>{item.status === 'complete' ? 'Complete' : 'Review'}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="mini-panel">
            <h3>Live Index Feed</h3>
            <div className="events-list">
              {readiness.indexing.recentEvents.length === 0 && <p className="muted">No indexed events yet.</p>}
              {readiness.indexing.recentEvents.map((event) => (
                <div key={event.id} className="event-card compact-event-card">
                  <p>
                    <strong>{event.eventType}</strong> · {new Date(event.timestamp).toLocaleString()}
                  </p>
                  <p className="muted">Wallet: {event.walletAddress}</p>
                  <p className="muted">Status: {event.status} · Acks: {event.acknowledgments}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      )}
    </section>
  );
}