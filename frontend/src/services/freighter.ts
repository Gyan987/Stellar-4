import { getAddress, isConnected, requestAccess } from '@stellar/freighter-api';

const STELLAR_PUBLIC_KEY_REGEX = /^G[A-Z2-7]{55}$/;

type FreighterResult = {
  error?: unknown;
};

function parseFreighterError(result: FreighterResult | null | undefined): string | null {
  if (!result?.error) {
    return null;
  }

  if (typeof result.error === 'string' && result.error.trim()) {
    return result.error.trim();
  }

  if (typeof result.error === 'object') {
    const message = (result.error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }

    const code = (result.error as { code?: unknown }).code;
    if (typeof code === 'string' && code.trim()) {
      return code.trim();
    }
  }

  return 'Unknown Freighter error';
}

function normalizeAndValidateWallet(address: string): string {
  const normalized = address.trim().toUpperCase();
  if (!STELLAR_PUBLIC_KEY_REGEX.test(normalized)) {
    throw new Error('Freighter returned an invalid Stellar address.');
  }

  return normalized;
}

async function connectViaLegacyWindowApi(): Promise<string | null> {
  if (!window.freighterApi?.getPublicKey) {
    return null;
  }

  const publicKey = await window.freighterApi.getPublicKey();
  return normalizeAndValidateWallet(publicKey);
}

export async function connectFreighterWallet(): Promise<string> {
  const legacyAddress = await connectViaLegacyWindowApi();
  if (legacyAddress) {
    return legacyAddress;
  }

  const connectedResult = await isConnected();
  const connectedError = parseFreighterError(connectedResult);
  if (connectedError) {
    throw new Error(`Unable to connect to Freighter: ${connectedError}`);
  }

  if (!connectedResult.isConnected) {
    throw new Error('Freighter extension was not detected in this browser.');
  }

  const accessResult = await requestAccess();
  const accessError = parseFreighterError(accessResult);
  if (accessError) {
    throw new Error(`Freighter access was denied or failed: ${accessError}`);
  }

  if (accessResult.address) {
    return normalizeAndValidateWallet(accessResult.address);
  }

  const addressResult = await getAddress();
  const addressError = parseFreighterError(addressResult);
  if (addressError) {
    throw new Error(`Freighter did not return a wallet address: ${addressError}`);
  }

  if (!addressResult.address) {
    throw new Error('Freighter did not return a wallet address.');
  }

  return normalizeAndValidateWallet(addressResult.address);
}
