# @waigel/pkpass-validator

A lean, TypeScript-first validator for Apple Wallet passes (.pkpass) that mirrors the official Passbook validation rules from [tomasmcguinness/dotnet-passbook-validator](https://github.com/tomasmcguinness/dotnet-passbook-validator). The library works in both Node.js and modern browsers, exposes a typed API, and ships with a GitHub Pages demo for on-device validation.

## Highlights

- ✅ Reads PKPass archives, pass.json payloads, and manifest/signature pairs
- 🔐 Verifies CMS signatures and certificate metadata (WWDR + pass certificates)
- 🌐 Runs everywhere – shipped as ESM, CJS, and IIFE bundles
- 🧪 Comes with Vitest coverage using real Apple Wallet samples
- 🚀 Ready-to-use CI + GitHub Pages workflow for automatic demo deployments

## Installation

```bash
npm install @waigel/pkpass-validator
```

## Usage

### Node.js / Bun

```ts
import { readFile } from 'node:fs/promises';
import { validatePkPass } from '@waigel/pkpass-validator';

const passPath = './my-pass.pkpass';
const payload = await readFile(passPath);
const result = await validatePkPass(payload);

console.log(result.PassTypeIdentifierMatches, result.TeamIdentifierMatches);
```

### Browser (ES Modules)

```html
<script type="module">
  import { validatePkPass } from 'https://esm.sh/@waigel/pkpass-validator';

  async function validate(file) {
    const bytes = await file.arrayBuffer();
    const result = await validatePkPass(bytes);
    console.log(result);
  }
</script>
```

### API

```ts
validatePkPass(input: ArrayBuffer | ArrayBufferView | Blob, options?: {
  skipSignatureVerification?: boolean;
}): Promise<ValidationResult>
```

`ValidationResult` mirrors the .NET structure and exposes flags such as `HasManifest`, `PassKitCertificateFound`, `PassTypeIdentifierMatches`, `TeamIdentifierMatches`, and `SignatureExpirationDate`.

When running outside of Node.js (e.g., browsers), WebCrypto is used directly. Node.js builds automatically pull in `@peculiar/webcrypto` to provide the same API surface.

## Development

```bash
npm install          # install dependencies
npm run typecheck    # strict TypeScript checks
npm test             # Vitest suite (uses sample .pkpass fixtures)
npm run build        # tsup build (ESM, CJS, browser bundles)
npm run demo:dev     # start Vite dev server for the demo
npm run demo:build   # build static assets for GitHub Pages
```

Sample passes used in tests live under `tests/fixtures/` and originate from the reference .NET project.

## Continuous Integration & Pages

- `.github/workflows/ci.yml` runs type-checks, tests, and both builds on every push/PR to `main`.
- `.github/workflows/pages.yml` publishes the Vite demo (`demo/dist`) to GitHub Pages.

Once the workflows are on the default branch, enable GitHub Pages (build and deployment source: GitHub Actions) and you’ll have a fully hosted, on-device validator UI.

## License

MIT © waigel
