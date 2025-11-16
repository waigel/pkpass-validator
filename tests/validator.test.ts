import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { validatePkPass } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixture = (name: string) => path.resolve(__dirname, 'fixtures', name);

describe('validatePkPass', () => {
  it('evaluates a known good pass', async () => {
    const buffer = await readFile(fixture('good.pkpass'));
    const result = await validatePkPass(buffer);

    expect(result.HasManifest).toBe(true);
    expect(result.HasPass).toBe(true);
    expect(result.PassKitCertificateFound).toBe(true);
    expect(result.PassKitCertificateIssuedByApple).toBe(true);
    expect(result.PassKitCertificateNameCorrect).toBe(true);
    expect(result.PassTypeIdentifierMatches).toBe(true);
    expect(result.TeamIdentifierMatches).toBe(true);
    expect(result.HasSignature).toBe(true);
  });

  it('flags certificate mismatch in the bad sample', async () => {
    const buffer = await readFile(fixture('bad.pkpass'));
    const result = await validatePkPass(buffer);

    expect(result.PassKitCertificateFound).toBe(true);
    expect(result.PassKitCertificateNameCorrect).toBe(false);
  });

  it('gracefully handles archives without a manifest', async () => {
    const zip = new JSZip();
    zip.file('pass.json', JSON.stringify({ description: 'No manifest' }));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    const result = await validatePkPass(buffer);

    expect(result.HasManifest).toBe(false);
    expect(result.HasPass).toBe(true);
    expect(result.HasSignature).toBe(false);
  });
});
