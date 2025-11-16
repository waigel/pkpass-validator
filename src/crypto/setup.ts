import { setEngine } from 'pkijs';

let initialized = false;
let initializing: Promise<void> | null = null;

export async function ensureCryptoEngine(): Promise<void> {
  if (initialized) {
    return;
  }

  if (initializing) {
    return initializing;
  }

  initializing = (async () => {
    let runtimeCrypto = (globalThis as any).crypto as Crypto | undefined;

    if (!runtimeCrypto) {
      const { Crypto: NodeCrypto } = await import('@peculiar/webcrypto');
      runtimeCrypto = new NodeCrypto() as unknown as Crypto;
      (globalThis as any).crypto = runtimeCrypto;
    }

    if (!runtimeCrypto?.subtle) {
      throw new Error('WebCrypto subtle API is required for signature validation.');
    }

    setEngine('pkpass-validator', runtimeCrypto, runtimeCrypto.subtle);
    initialized = true;
  })();

  await initializing;
}
