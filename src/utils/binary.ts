import { PkPassInput } from '../types.js';

const asciiDecoder = new TextDecoder('ascii');
const utf8Decoder = new TextDecoder('utf-8');

export async function inputToUint8Array(input: PkPassInput): Promise<Uint8Array> {
  if (input instanceof Blob) {
    const buffer = await input.arrayBuffer();
    return new Uint8Array(buffer);
  }

  if (ArrayBuffer.isView(input)) {
    return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  }

  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }

  throw new TypeError('Unsupported pkpass input. Please provide an ArrayBuffer, ArrayBufferView, or Blob.');
}

export function bufferToUtf8(data: ArrayBuffer | ArrayBufferView): string {
  const view = toUint8Array(data);
  return utf8Decoder.decode(view);
}

export function bufferToAscii(data: ArrayBuffer | ArrayBufferView): string {
  const view = toUint8Array(data);
  return asciiDecoder.decode(view);
}

export function bufferToHex(data: ArrayBuffer | ArrayBufferView): string {
  const view = toUint8Array(data);
  return Array.from(view)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

export function toUint8Array(data: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data);
}
