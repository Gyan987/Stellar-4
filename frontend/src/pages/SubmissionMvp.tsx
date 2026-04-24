import { FormEvent, useMemo, useState } from 'react';
import ProductionReadinessPanel from '@/components/ProductionReadinessPanel';
import {
  acknowledgeEvent,
  getEvents,
  getProfile,
  getTrustedContacts,
  saveProfile,
  saveTrustedContacts,
  triggerSos,
  TrustedContact,
  SosEvent,
} from '@/services/rakshaMvp';
import { connectFreighterWallet } from '@/services/freighter';
import './SubmissionMvp.css';

const EMPTY_CONTACT: TrustedContact = { name: '', walletAddress: '', phone: '' };

function shortenWallet(walletAddress: string) {
  if (walletAddress.length < 12) {
    return walletAddress;
  }

  return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`;
}

function isValidStellarWallet(wallet: string) {
  return /^G[A-Z2-7]{55}$/.test(wallet.trim().toUpperCase());
}

const SubmissionMvp = () => {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [walletAddress, setWalletAddress] = useState('');
  const [profileName, setProfileName] = useState('');
  const [contacts, setContacts] = useState<TrustedContact[]>([
    { ...EMPTY_CONTACT, id: 'contact-1' },
    { ...EMPTY_CONTACT, id: 'contact-2' },
  ]);
  const [eventType, setEventType] = useState('SOS');
  const [contextText, setContextText] = useState('');
  const [locationHint, setLocationHint] = useState('');
  const [events, setEvents] = useState<SosEvent[]>([]);
  const [ackWallet, setAckWallet] = useState('');
  const [ackNote, setAckNote] = useState('I received your alert and I am on the way.');
  const [statusMessage, setStatusMessage] = useState('Connect your wallet to begin.');
  const [isBusy, setIsBusy] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const recentSosEvents = useMemo(() => events.filter((item) => item.eventType === 'SOS').slice(0, 5), [events]);

  const canUseApi = useMemo(() => walletAddress.trim().length > 0, [walletAddress]);

  const setMessage = (message: string, isError = false) => {
    setStatusMessage(isError ? `Error: ${message}` : message);
  };

  const withBusy = async (task: () => Promise<void>) => {
    setIsBusy(true);
    try {
      await task();
    } finally {
      setIsBusy(false);
    }
  };

  const loadAll = async (wallet: string) => {
    const [profileResult, contactsResult, eventsResult] = await Promise.allSettled([
      getProfile(wallet),
      getTrustedContacts(wallet),
      getEvents(wallet),
    ]);

    if (profileResult.status === 'fulfilled') {
      setProfileName(profileResult.value.profile?.name || '');
    }

    if (contactsResult.status === 'fulfilled' && contactsResult.value.contacts.length > 0) {
      setContacts(
        contactsResult.value.contacts.map((item, index) => ({
          ...item,
          id: item.id || `contact-${index + 1}`,
        }))
      );
    }

    if (eventsResult.status === 'fulfilled') {
      setEvents(eventsResult.value.events);
    }
  };

  const handleConnectWallet = async () => {
    await withBusy(async () => {
      try {
        const publicKey = await connectFreighterWallet();
        setWalletAddress(publicKey);
        setAckWallet(publicKey);
        setMessage(`Wallet connected: ${shortenWallet(publicKey)}`);
        await loadAll(publicKey);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Wallet connection failed.';
        setMessage(
          `${errorMessage} Check that Freighter is installed, unlocked, granted for this site, and set to Stellar Testnet.`,
          true
        );
      }
    });
  };

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!canUseApi) {
      setMessage('Please connect a wallet first.', true);
      return;
    }

    await withBusy(async () => {
      setIsProfileSaving(true);
      try {
        await saveProfile(walletAddress, profileName);
        setMessage('Profile saved successfully.');
        setDashboardRefreshKey((current) => current + 1);
      } finally {
        setIsProfileSaving(false);
      }
    });
  };

  const handleContactChange = (index: number, key: keyof TrustedContact, value: string) => {
    setContacts((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    );
  };

  const handleAddContactRow = () => {
    setContacts((current) => [...current, { ...EMPTY_CONTACT, id: `contact-${current.length + 1}` }]);
  };

  const handleSaveContacts = async () => {
    if (!canUseApi) {
      setMessage('Please connect a wallet first.', true);
      return;
    }

    await withBusy(async () => {
      const cleaned = contacts.filter((item) => item.name?.trim());
      const invalidWalletContact = cleaned.find((item) => item.walletAddress?.trim() && !isValidStellarWallet(item.walletAddress));
      if (invalidWalletContact) {
        setMessage(`Invalid Stellar wallet for contact ${invalidWalletContact.name || 'entry'}. Wallets must start with G and be 56 chars.`, true);
        return;
      }
      await saveTrustedContacts(walletAddress, cleaned);
      setMessage(`Saved ${cleaned.length} trusted contacts.`);
      setDashboardRefreshKey((current) => current + 1);
    });
  };

  const handleTriggerSos = async () => {
    if (!canUseApi) {
      setMessage('Please connect a wallet first.', true);
      return;
    }

    await withBusy(async () => {
      try {
        await triggerSos({
          walletAddress,
          eventType,
          contextText,
          locationHint,
        });

        const latest = await getEvents(walletAddress);
        setEvents(latest.events);
        setMessage('SOS triggered and recorded successfully.');
        if (navigator.vibrate) {
          navigator.vibrate([250, 120, 250]);
        }
        setContextText('');
        setDashboardRefreshKey((current) => current + 1);
      } catch {
        setMessage('SOS trigger failed. Please check connectivity and retry in a few seconds.', true);
      }
    });
  };

  const handleAcknowledge = async (eventId: string) => {
    if (!ackWallet.trim()) {
      setMessage('Enter a contact wallet for acknowledgment.', true);
      return;
    }

    await withBusy(async () => {
      await acknowledgeEvent(eventId, ackWallet, ackNote);
      const latest = await getEvents(walletAddress);
      setEvents(latest.events);
      setMessage('Acknowledgment added.');
      setDashboardRefreshKey((current) => current + 1);
    });
  };

  const handleRefreshHistory = async () => {
    if (!canUseApi) {
      setMessage('Please connect a wallet first.', true);
      return;
    }

    await withBusy(async () => {
      const result = await getEvents(walletAddress);
      setEvents(result.events);
      setMessage(`Loaded ${result.events.length} events.`);
    });
  };

  const handleTestAlertTone = () => {
    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      setMessage('Audio preview is not supported on this browser.', true);
      return;
    }

    const audioContext = new AudioContextCtor();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = 'square';
    oscillator.frequency.value = 1040;
    gainNode.gain.value = 0.12;

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    window.setTimeout(() => {
      oscillator.stop();
      void audioContext.close();
    }, 600);
  };

  return (
    <main className={`submission-page ${isDarkMode ? 'theme-dark' : 'theme-light'}`}>
      {isBusy && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15,23,42,0.45)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            width: 56,
            height: 56,
            border: '6px solid #38bdf8',
            borderTop: '6px solid #0ea5e9',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            background: 'rgba(15,23,42,0.7)'
          }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }`}</style>
        </div>
      )}
      <section className="submission-card hero-card">
        <p className="eyebrow">RakshaCircle</p>
        <h1>Submission MVP Dashboard</h1>
        <p className="muted">
          Lean end-to-end flow: wallet connect, profile setup, trusted circle, SOS trigger, acknowledgment,
          and tamper-proof style event history.
        </p>
        <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.9rem' }}>
          Guided flow: Connect Wallet, Save Profile, Save Contacts, Trigger SOS, and Track Acknowledgments.
        </p>
        <details className="contacts-help" style={{ marginTop: '0.6rem' }}>
          <summary>New here? Start tutorial</summary>
          <p className="muted" style={{ margin: '0.45rem 0 0' }}>
            1) Connect wallet. 2) Save your profile. 3) Add at least one trusted contact. 4) Use Trigger SOS only in emergencies.
          </p>
        </details>
        <details className="contacts-help" style={{ marginTop: '0.45rem' }}>
          <summary>Wallet setup in under a minute</summary>
          <p className="muted" style={{ margin: '0.45rem 0 0' }}>
            Install Freighter, switch to Stellar Testnet, unlock extension, and approve this app when prompted.
          </p>
        </details>
        <div className="wallet-row" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="ghost"
            type="button"
            onClick={() => setIsDarkMode((current) => !current)}
            disabled={isBusy}
          >
            {isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          </button>
          <button className="primary" onClick={handleConnectWallet} disabled={isBusy} type="button">
            Connect Freighter Wallet
          </button>
          <span>{walletAddress ? shortenWallet(walletAddress) : 'No wallet connected'}</span>
        </div>
        <p className="muted" style={{ marginTop: '0.45rem', fontSize: '0.86rem' }}>
          Designed to reduce panic moments with one-tap emergency signaling and fast acknowledgment tracking.
        </p>
        <p className="muted" style={{ marginTop: '0.1rem', fontSize: '0.84rem' }}>
          Privacy by design: decentralized identity with on-chain integrity checks and minimal personal data exposure.
        </p>
        <p className="muted" style={{ marginTop: '0.1rem', fontSize: '0.84rem' }}>
          Fast signal path: optimized for quick SOS logging and rapid trusted-contact acknowledgment flow.
        </p>
        <p className="muted" style={{ marginTop: '0.1rem', fontSize: '0.84rem' }}>
          Blockchain safety layer: emergency events gain tamper-evident traceability for trusted follow-up.
        </p>
        <p className="muted" style={{ marginTop: '0.1rem', fontSize: '0.84rem' }}>
          Built as an everyday urban-safety companion for students, professionals, families, and late-night commuters.
        </p>
        <p className="status-text">{statusMessage}</p>
      </section>

      <section className="submission-grid">
        <article className="submission-card">
          <h2><span className="section-dot profile-dot" />1. Profile</h2>
          <form onSubmit={handleSaveProfile} className="stack" style={{ position: 'relative' }}>
            <label>
              Name
              <input
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                placeholder="Enter your name"
                required
              />
            </label>
            <button className="primary" type="submit" disabled={isBusy || !walletAddress}>
              {isProfileSaving ? 'Saving Profile...' : 'Save Profile'}
            </button>
            <p className="muted" style={{ fontSize: '0.92em', marginTop: '0.5em' }}>
              <strong>Privacy:</strong> Your name and wallet are used only for emergency coordination. Personal profile data remains off-chain.
            </p>
            {isProfileSaving && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(255,255,255,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                borderRadius: '0.5em',
              }}>
                <div className="spinner" style={{ width: 32, height: 32, border: '4px solid #ccc', borderTop: '4px solid #ff2d2d', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
              </div>
            )}
          </form>
          <p className="muted" style={{ fontSize: '0.92em', marginTop: '0.5em' }}>
            <strong>Privacy Note:</strong> Only event verification hashes are anchored on-chain. No phone number or free-text context is written to blockchain.
          </p>
        </article>

        <article className="submission-card">
          <h2><span className="section-dot circle-dot" />2. Trusted Circle (Family Monitoring)</h2>
          <details className="contacts-help">
            <summary>How do I update my emergency contacts?</summary>
            <p className="muted" style={{ margin: '0.45rem 0 0' }}>
              Edit any existing row, add a new row if needed, then click Save Contacts. Your latest list replaces the previous saved version.
            </p>
          </details>
          <div className="stack">
            {contacts.map((contact, index) => (
              <div key={contact.id || index} className="contact-row">
                <input
                  value={contact.name || ''}
                  onChange={(event) => handleContactChange(index, 'name', event.target.value)}
                  placeholder="Contact name"
                />
                <input
                  value={contact.walletAddress || ''}
                  onChange={(event) => handleContactChange(index, 'walletAddress', event.target.value)}
                  placeholder="Contact wallet"
                  aria-label="Contact wallet address"
                  title="Paste a Stellar wallet address (starts with G and usually 56 characters)."
                />
                <input
                  value={contact.phone || ''}
                  onChange={(event) => handleContactChange(index, 'phone', event.target.value)}
                  placeholder="Phone"
                />
              </div>
            ))}
            <div className="actions-row">
              <button className="ghost" onClick={handleAddContactRow} type="button" disabled={isBusy}>
                Add Contact
              </button>
              <button className="primary" onClick={handleSaveContacts} type="button" disabled={isBusy || !walletAddress}>
                Save Contacts
              </button>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              Tip: Add at least one trusted contact with wallet and phone so SOS alerts can be acknowledged quickly.
            </p>
          </div>
        </article>

        <article className="submission-card">
          <h2><span className="section-dot sos-dot" />3. SOS Trigger</h2>
          <div className="stack">
            <label>
              Event Type
              <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
                <option value="SOS">SOS</option>
                <option value="MEDICAL">Medical Emergency</option>
                <option value="ROUTE_RISK">Route Risk</option>
              </select>
            </label>
            <label>
              Location Hint
              <input
                value={locationHint}
                onChange={(event) => setLocationHint(event.target.value)}
                placeholder="Near Park Street Metro"
              />
            </label>
            <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>
              Precision tip: Add a nearby landmark or metro stop so responders can reach you faster.
            </p>
            <label>
              Context
              <textarea
                value={contextText}
                onChange={(event) => setContextText(event.target.value)}
                placeholder="Optional details for off-chain context hash"
              />
            </label>
            <button className="danger" onClick={handleTriggerSos} type="button" disabled={isBusy || !walletAddress}>
              TRIGGER EMERGENCY SOS NOW
            </button>
            <p className="danger-hint">Use only for active emergencies. This sends immediate alerts to your trusted circle.</p>
            <div className="actions-row" style={{ marginTop: '0.25rem' }}>
              <a className="ghost" href="tel:112">Call 112</a>
              <a className="ghost" href="tel:100">Call Police (100)</a>
              <a className="ghost" href="tel:102">Call Ambulance (102)</a>
              <button className="ghost" type="button" onClick={handleTestAlertTone} disabled={isBusy}>Test Loud Alert Tone</button>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: '0.84rem' }}>
              SMS and acknowledgment notifications are optimized for low-latency dispatch during emergencies.
            </p>
          </div>
        </article>

        <article className="submission-card">
          <h2><span className="section-dot history-dot" />4. Alert History</h2>
          <div className="stack">
            <div className="actions-row">
              <input
                value={ackWallet}
                onChange={(event) => setAckWallet(event.target.value)}
                placeholder="Acknowledging wallet"
              />
              <button className="ghost" onClick={handleRefreshHistory} type="button" disabled={isBusy || !walletAddress}>
                Refresh
              </button>
            </div>
            <textarea value={ackNote} onChange={(event) => setAckNote(event.target.value)} />
            <div className="events-list">
              {recentSosEvents.length === 0 && <p className="muted">No SOS alerts yet.</p>}
              {recentSosEvents.map((item) => (
                <div key={item.id} className="event-card">
                  <p>
                    <strong>{item.eventType}</strong> · {new Date(item.timestamp).toLocaleString()}
                  </p>
                  <p className="muted">Status: {item.status}</p>
                  <p className="muted">Hash: {item.contextHash.slice(0, 24)}...</p>
                  <p className="muted">Acks: {item.acknowledgments.length}</p>
                  <button className="primary" onClick={() => handleAcknowledge(item.id)} type="button" disabled={isBusy}>
                    Acknowledge Event
                  </button>
                </div>
              ))}
              {events.length > 5 && <p className="muted">Showing latest 5 SOS events.</p>}
            </div>
          </div>
        </article>
      </section>

      <ProductionReadinessPanel walletAddress={walletAddress} refreshToken={dashboardRefreshKey} />
    </main>
  );
};

export default SubmissionMvp;
