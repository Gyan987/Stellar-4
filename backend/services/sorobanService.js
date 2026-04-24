/**
 * Soroban Contract Integration Service
 * Connects the Node.js backend to Raksha Safety Smart Contract on Stellar Soroban.
 */

import {
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr
} from '@stellar/stellar-sdk';

const DEFAULT_RPC_URL = 'https://soroban-testnet.stellar.org';
const DEFAULT_EXPLORER_BASE_URL = 'https://stellar.expert/explorer/testnet/tx';
const BASE_FEE = '100000';

function normalizeWallet(walletAddress = '') {
  return String(walletAddress).trim().toUpperCase();
}

function isValidWallet(walletAddress = '') {
  return /^G[A-Z2-7]{55}$/.test(walletAddress);
}

function normalizeScValue(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeScValue(item));
  }

  if (value && typeof value === 'object') {
    const normalized = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      normalized[key] = normalizeScValue(nestedValue);
    }
    return normalized;
  }

  return value;
}

function extractErrorMessage(error) {
  if (error?.response?.data?.detail) {
    return String(error.response.data.detail);
  }

  if (error?.response?.data?.message) {
    return String(error.response.data.message);
  }

  if (error?.message) {
    return String(error.message);
  }

  return 'Unknown Soroban error';
}

class SorobanService {
  constructor() {
    this.contractId = process.env.SOROBAN_CONTRACT_ID || '';
    this.rpcUrl = process.env.SOROBAN_RPC_URL || DEFAULT_RPC_URL;
    this.networkPassphrase = process.env.SOROBAN_NETWORK_PASSPHRASE || Networks.TESTNET;
    this.serverPublicKey = process.env.SERVER_PUBLIC_KEY || '';
    this.serverSecretKey = process.env.SERVER_SECRET_KEY || '';
    this.feeSponsorWallet = process.env.FEE_SPONSOR_WALLET || '';
    this.explorerBaseUrl = process.env.SOROBAN_EXPLORER_BASE_URL || DEFAULT_EXPLORER_BASE_URL;

    this.server = null;
    this.contract = null;
    this.signer = null;
  }

  async initialize() {
    if (!this.contractId) {
      console.warn('SOROBAN_CONTRACT_ID is not configured. On-chain writes are disabled.');
      return false;
    }

    if (!this.serverPublicKey || !this.serverSecretKey) {
      console.warn('SERVER_PUBLIC_KEY and SERVER_SECRET_KEY are required for signed on-chain writes.');
      return false;
    }

    try {
      this.signer = Keypair.fromSecret(this.serverSecretKey);
    } catch (error) {
      console.warn('SERVER_SECRET_KEY is invalid:', extractErrorMessage(error));
      return false;
    }

    if (this.signer.publicKey() !== this.serverPublicKey) {
      console.warn('Signer key mismatch: SERVER_PUBLIC_KEY does not match SERVER_SECRET_KEY.');
      return false;
    }

    this.server = new rpc.Server(this.rpcUrl, {
      allowHttp: this.rpcUrl.startsWith('http://')
    });
    this.contract = new Contract(this.contractId);

    console.log('Soroban Service initialized');
    console.log(`Contract ID: ${this.contractId}`);
    console.log(`RPC: ${this.rpcUrl}`);
    console.log(`Signer: ${this.serverPublicKey}`);
    console.log(`Network passphrase: ${this.networkPassphrase}`);

    return true;
  }

  buildExplorerUrl(txHash) {
    return `${this.explorerBaseUrl}/${txHash}`;
  }

  async ensureWriteReady() {
    if (!this.contractId) {
      return { ok: false, error: 'SOROBAN_CONTRACT_ID is not configured.' };
    }

    if (!this.serverPublicKey || !this.serverSecretKey) {
      return { ok: false, error: 'SERVER_PUBLIC_KEY and SERVER_SECRET_KEY are required for on-chain writes.' };
    }

    if (!this.server || !this.contract || !this.signer) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          ok: false,
          error: 'Soroban service initialization failed due to missing or invalid signer configuration.'
        };
      }
    }

    return { ok: true };
  }

  addressToScVal(walletAddress) {
    const normalized = normalizeWallet(walletAddress);
    if (!isValidWallet(normalized)) {
      throw new Error(`Invalid Stellar public key: ${walletAddress}`);
    }

    return new Address(normalized).toScVal();
  }

  stringToScVal(value) {
    return nativeToScVal(String(value), { type: 'string' });
  }

  async invokeWrite(methodName, args, params = {}) {
    const ready = await this.ensureWriteReady();
    if (!ready.ok) {
      return {
        success: false,
        function: methodName,
        params,
        error: ready.error
      };
    }

    try {
      const sourceAccount = await this.server.getAccount(this.serverPublicKey);

      let tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(this.contract.call(methodName, ...args))
        .setTimeout(120)
        .build();

      tx = await this.server.prepareTransaction(tx);
      tx.sign(this.signer);

      const sendResponse = await this.server.sendTransaction(tx);
      const sendStatus = String(sendResponse?.status || '').toUpperCase();

      if (sendStatus === 'ERROR') {
        return {
          success: false,
          function: methodName,
          params,
          status: sendResponse?.status || null,
          error: 'Transaction rejected by Soroban RPC.',
          errorResultXdr: sendResponse?.errorResultXdr || null
        };
      }

      if (!sendResponse?.hash) {
        return {
          success: false,
          function: methodName,
          params,
          error: 'Soroban RPC did not return a transaction hash.'
        };
      }

      const finalResponse = await this.server.pollTransaction(sendResponse.hash, { attempts: 25 });
      const finalStatus = String(finalResponse?.status || '').toUpperCase();

      if (finalStatus !== 'SUCCESS') {
        return {
          success: false,
          function: methodName,
          params,
          status: finalResponse?.status || null,
          txHash: sendResponse.hash,
          explorerUrl: this.buildExplorerUrl(sendResponse.hash),
          error: 'Transaction was submitted but did not succeed on-chain.',
          resultXdr: finalResponse?.resultXdr || null
        };
      }

      const decodedReturnValue = finalResponse?.returnValue
        ? normalizeScValue(scValToNative(finalResponse.returnValue))
        : null;

      return {
        success: true,
        function: methodName,
        params,
        contractId: this.contractId,
        status: finalResponse?.status || 'SUCCESS',
        txHash: sendResponse.hash,
        explorerUrl: this.buildExplorerUrl(sendResponse.hash),
        latestLedger: finalResponse?.latestLedger || null,
        returnValue: decodedReturnValue
      };
    } catch (error) {
      return {
        success: false,
        function: methodName,
        params,
        error: extractErrorMessage(error)
      };
    }
  }

  async invokeRead(methodName, args, params = {}) {
    if (!this.contractId) {
      return {
        success: false,
        function: methodName,
        params,
        error: 'SOROBAN_CONTRACT_ID is not configured.'
      };
    }

    if (!this.serverPublicKey) {
      return {
        success: false,
        function: methodName,
        params,
        error: 'SERVER_PUBLIC_KEY is required for read simulation.'
      };
    }

    if (!this.server) {
      this.server = new rpc.Server(this.rpcUrl, {
        allowHttp: this.rpcUrl.startsWith('http://')
      });
    }

    if (!this.contract) {
      this.contract = new Contract(this.contractId);
    }

    try {
      const sourceAccount = await this.server.getAccount(this.serverPublicKey);

      const tx = new TransactionBuilder(sourceAccount, {
        fee: BASE_FEE,
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(this.contract.call(methodName, ...args))
        .setTimeout(120)
        .build();

      const simulation = await this.server.simulateTransaction(tx);

      if (simulation?.error) {
        return {
          success: false,
          function: methodName,
          params,
          error: String(simulation.error)
        };
      }

      const retval = simulation?.result?.retval || null;
      const decodedReturnValue = retval ? normalizeScValue(scValToNative(retval)) : null;

      return {
        success: true,
        function: methodName,
        params,
        contractId: this.contractId,
        latestLedger: simulation?.latestLedger || null,
        returnValue: decodedReturnValue
      };
    } catch (error) {
      return {
        success: false,
        function: methodName,
        params,
        error: extractErrorMessage(error)
      };
    }
  }

  async registerUser(walletAddress, userName) {
    const normalizedWallet = normalizeWallet(walletAddress);
    if (!isValidWallet(normalizedWallet)) {
      return { success: false, error: 'Invalid user wallet address.' };
    }

    return this.invokeWrite(
      'register_user',
      [
        this.addressToScVal(normalizedWallet),
        this.stringToScVal(String(userName).trim())
      ],
      {
        wallet: normalizedWallet,
        name: String(userName).trim()
      }
    );
  }

  async addTrustedContacts(userWallet, contacts) {
    const normalizedUser = normalizeWallet(userWallet);
    if (!isValidWallet(normalizedUser)) {
      return { success: false, error: 'Invalid user wallet address.' };
    }

    const incoming = Array.isArray(contacts) ? contacts : [];
    const validContactWallets = [];

    for (const item of incoming) {
      const wallet = typeof item === 'string' ? item : item?.walletAddress;
      const normalized = normalizeWallet(wallet);
      if (isValidWallet(normalized)) {
        validContactWallets.push(normalized);
      }
    }

    const contactScVals = validContactWallets.map((wallet) => this.addressToScVal(wallet));
    const contactsVector = xdr.ScVal.scvVec(contactScVals);

    return this.invokeWrite(
      'add_trusted_contacts',
      [
        this.addressToScVal(normalizedUser),
        contactsVector
      ],
      {
        user: normalizedUser,
        contacts: validContactWallets
      }
    );
  }

  async triggerSOS(userWallet, eventId, eventType, contextHash) {
    const normalizedUser = normalizeWallet(userWallet);
    if (!isValidWallet(normalizedUser)) {
      return { success: false, error: 'Invalid user wallet address.' };
    }

    return this.invokeWrite(
      'trigger_sos',
      [
        this.addressToScVal(normalizedUser),
        this.stringToScVal(String(eventId)),
        this.stringToScVal(String(eventType)),
        this.stringToScVal(String(contextHash))
      ],
      {
        user: normalizedUser,
        eventId: String(eventId),
        eventType: String(eventType),
        contextHash: String(contextHash)
      }
    );
  }

  async acknowledgeSOS(eventId, contactWallet) {
    const normalizedContact = normalizeWallet(contactWallet);
    if (!isValidWallet(normalizedContact)) {
      return { success: false, error: 'Invalid contact wallet address.' };
    }

    return this.invokeWrite(
      'acknowledge_sos',
      [
        this.stringToScVal(String(eventId)),
        this.addressToScVal(normalizedContact)
      ],
      {
        eventId: String(eventId),
        contact: normalizedContact
      }
    );
  }

  async buildFeeSponsoredAction(action, payload = {}) {
    const sponsoredAt = new Date().toISOString();

    if (!this.feeSponsorWallet) {
      return {
        success: true,
        enabled: false,
        mode: 'manual-fee-payment',
        action,
        payload,
        sponsoredAt,
        message: 'Fee sponsor wallet is not configured. Sponsorship preview is available, but no sponsor is active.'
      };
    }

    return {
      success: true,
      enabled: true,
      mode: 'fee-bump',
      sponsorWallet: this.feeSponsorWallet,
      action,
      payload,
      sponsoredAt,
      message: 'Fee-sponsored transaction metadata prepared.'
    };
  }

  async getSOSEvent(eventId) {
    const result = await this.invokeRead(
      'get_sos_event',
      [this.stringToScVal(String(eventId))],
      { eventId: String(eventId) }
    );

    if (!result.success) {
      return result;
    }

    return {
      ...result,
      event: result.returnValue
    };
  }

  async getUser(wallet) {
    const normalizedWallet = normalizeWallet(wallet);
    if (!isValidWallet(normalizedWallet)) {
      return { success: false, error: 'Invalid user wallet address.' };
    }

    const result = await this.invokeRead(
      'get_user',
      [this.addressToScVal(normalizedWallet)],
      { wallet: normalizedWallet }
    );

    if (!result.success) {
      return result;
    }

    return {
      ...result,
      user: result.returnValue
    };
  }

  async getTrustedContacts(wallet) {
    const normalizedWallet = normalizeWallet(wallet);
    if (!isValidWallet(normalizedWallet)) {
      return { success: false, error: 'Invalid user wallet address.' };
    }

    const result = await this.invokeRead(
      'get_trusted_contacts',
      [this.addressToScVal(normalizedWallet)],
      { wallet: normalizedWallet }
    );

    if (!result.success) {
      return result;
    }

    return {
      ...result,
      contacts: Array.isArray(result.returnValue) ? result.returnValue : []
    };
  }

  getStatus() {
    const signerKeysConfigured = Boolean(this.serverPublicKey && this.serverSecretKey);
    const isConfigured = Boolean(this.contractId && signerKeysConfigured);

    return {
      isConfigured,
      contractId: this.contractId || 'NOT_CONFIGURED',
      rpcUrl: this.rpcUrl,
      networkPassphrase: this.networkPassphrase,
      status: isConfigured ? 'Ready for signed on-chain writes' : 'Configuration incomplete for signed on-chain writes',
      writeRequirements: {
        contractIdConfigured: Boolean(this.contractId),
        signerKeysConfigured
      },
      feeSponsorship: {
        enabled: Boolean(this.feeSponsorWallet),
        sponsorWallet: this.feeSponsorWallet || 'NOT_CONFIGURED'
      },
      deploymentNote:
        'Chain writes require SOROBAN_CONTRACT_ID, SERVER_PUBLIC_KEY, SERVER_SECRET_KEY, SOROBAN_RPC_URL, and SOROBAN_NETWORK_PASSPHRASE.'
    };
  }
}

export default new SorobanService();
