export class Crypto {
  public subtle: SubtleCrypto;

  constructor() {
    if (!globalThis.crypto) {
      throw new Error('WebCrypto is not available in this environment.');
    }
    this.subtle = globalThis.crypto.subtle;
  }

  getRandomValues<T extends ArrayBufferView | null>(array: T): T {
    return globalThis.crypto.getRandomValues(array);
  }
}
