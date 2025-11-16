import './style.css';
import type { ValidationResult } from '@waigel/pkpass-validator';
import { validatePkPass } from '@waigel/pkpass-validator';

type ResultKey = keyof ValidationResult;
type StatusIntent = 'pass' | 'fail' | 'info';
type VerdictVariant = 'idle' | 'pass' | 'fail';

interface BooleanPresentation {
  positiveWhen?: 'true' | 'false';
  positivePrimary?: string;
  positiveSecondary?: string;
  negativePrimary?: string;
  negativeSecondary?: string;
}

interface ReadinessState {
  variant: VerdictVariant;
  title: string;
  detail: string;
  reasons: string[];
}

const fileInput = document.querySelector<HTMLInputElement>('#pkpass-file');
const statusEl = document.querySelector<HTMLElement>('#status');
const resultsEl = document.querySelector<HTMLElement>('#results');
const errorEl = document.querySelector<HTMLElement>('#error');
const verdictEl = document.querySelector<HTMLElement>('#verdict');
const verdictStatusEl = document.querySelector<HTMLElement>('#verdict-status');
const verdictDetailEl = document.querySelector<HTMLElement>('#verdict-detail');
const verdictReasonsEl = document.querySelector<HTMLElement>('#verdict-reasons');
const verdictIconEl = document.querySelector<HTMLElement>('#verdict-icon');

if (
  !fileInput ||
  !statusEl ||
  !resultsEl ||
  !errorEl ||
  !verdictEl ||
  !verdictStatusEl ||
  !verdictDetailEl ||
  !verdictReasonsEl ||
  !verdictIconEl
) {
  throw new Error('Demo markup missing required elements');
}

const LABEL_OVERRIDES: Partial<Record<ResultKey, string>> = {
  HasSignatureExpired: 'Signature expiry',
  SignatureExpirationDate: 'Signature expiration date',
  PassKitCertificateIssuedByApple: 'Pass certificate issued by Apple',
  PassKitCertificateFound: 'Pass certificate included',
  PassKitCertificateExpired: 'Pass certificate expiry',
  PassKitCertificateNameCorrect: 'Pass type identifier on certificate',
  WwdrCertificateFound: 'WWDR certificate present',
  WwdrCertificateExpired: 'WWDR certificate expiry',
  AuthenticationTokenRequiresWebServiceUrl: 'Auth token web service pairing',
  WebServiceUrlRequiresAuthenticationToken: 'Web service URL auth token pairing',
};

const BOOLEAN_PRESENTATION: Partial<Record<ResultKey, BooleanPresentation>> = {
  HasManifest: {
    positivePrimary: 'Manifest present',
    negativePrimary: 'Missing manifest.json',
    negativeSecondary: 'Apple requires a manifest that matches the signed payload.',
  },
  HasPass: {
    positivePrimary: 'Pass payload present',
    negativePrimary: 'Missing pass.json',
    negativeSecondary: 'Add the pass definition to the archive.',
  },
  HasSignature: {
    positivePrimary: 'Signature file present',
    negativePrimary: 'Missing signature file',
  },
  SignedByApple: {
    positivePrimary: 'Signed by Apple',
    negativePrimary: 'Not signed by Apple',
    negativeSecondary: 'Ensure the signing certificate chain includes Apple.',
  },
  PassKitCertificateFound: {
    positivePrimary: 'Pass certificate embedded',
    negativePrimary: 'Pass certificate missing',
  },
  PassKitCertificateIssuedByApple: {
    positivePrimary: 'Certificate issued by Apple',
    negativePrimary: 'Certificate not issued by Apple',
  },
  PassKitCertificateExpired: {
    positiveWhen: 'false',
    positivePrimary: 'Pass certificate valid',
    negativePrimary: 'Pass certificate expired',
    negativeSecondary: 'Renew the certificate before distributing.',
  },
  HasSignatureExpired: {
    positiveWhen: 'false',
    positivePrimary: 'Signature is current',
    positiveSecondary: 'Signing certificate is still valid.',
    negativePrimary: 'Signature expired',
    negativeSecondary: 'Renew the signing certificate to continue.',
  },
  WwdrCertificateFound: {
    positivePrimary: 'WWDR certificate present',
    negativePrimary: 'WWDR certificate missing',
  },
  WwdrCertificateExpired: {
    positiveWhen: 'false',
    positivePrimary: 'WWDR certificate valid',
    negativePrimary: 'WWDR certificate expired',
  },
  PassKitCertificateNameCorrect: {
    positivePrimary: 'Pass type identifier matches certificate',
    negativePrimary: 'Pass type identifier mismatch',
  },
  PassTypeIdentifierMatches: {
    positivePrimary: 'Pass type identifier matches',
    negativePrimary: 'Pass type identifier mismatch',
  },
  TeamIdentifierMatches: {
    positivePrimary: 'Team identifier matches',
    negativePrimary: 'Team identifier mismatch',
  },
  AuthenticationTokenRequiresWebServiceUrl: {
    positiveWhen: 'false',
    positivePrimary: 'Auth token has matching web service URL',
    negativePrimary: 'Auth token without web service URL',
  },
  WebServiceUrlRequiresAuthenticationToken: {
    positiveWhen: 'false',
    positivePrimary: 'Web service URL has auth token',
    negativePrimary: 'Web service URL missing auth token',
  },
};

fileInput.addEventListener('change', async (event) => {
  const target = event.currentTarget as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) {
    return;
  }

  setStatus(`Validating ${file.name}…`);
  clearError();

  try {
    const contents = await file.arrayBuffer();
    const result = await validatePkPass(contents);
    const readiness = renderResult(result);
    const summary =
      readiness.variant === 'pass'
        ? 'ready for Apple Wallet'
        : readiness.variant === 'fail'
          ? `${readiness.reasons.length} blocking issue${readiness.reasons.length === 1 ? '' : 's'} found`
          : 'review the highlighted checks';
    setStatus(`Validation finished — ${summary}`);
  } catch (error) {
    showError(error);
  }
});

function renderResult(result: ValidationResult): ReadinessState {
  const rows = Object.entries(result)
    .map(([rawKey, rawValue]) => renderRow(rawKey as ResultKey, rawValue as ValidationResult[ResultKey]))
    .join('');

  if (rows.length === 0) {
    resultsEl.classList.add('results--empty');
    resultsEl.innerHTML = '<p>No validation results yet.</p>';
  } else {
    resultsEl.classList.remove('results--empty');
    resultsEl.innerHTML = `<table><thead><tr><th scope="col">Check</th><th scope="col">Outcome</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  return updateReadiness(result);
}

function renderRow(key: ResultKey, value: ValidationResult[ResultKey]): string {
  const label = formatLabel(key);

  if (typeof value === 'boolean') {
    const descriptor = describeBooleanResult(key, label, value);
    const secondary = descriptor.secondary ? `<p class="result-value__secondary">${descriptor.secondary}</p>` : '';
    return `<tr class="result-row result-row--${descriptor.intent}"><th scope="row"><div class="result-label"><span class="result-label__title">${label}</span></div></th><td><div class="result-value">${iconMarkup(descriptor.intent)}<div><p class="result-value__primary">${descriptor.primary}</p>${secondary}</div></div></td></tr>`;
  }

  const formatted = formatValue(value);
  return `<tr class="result-row result-row--info"><th scope="row"><div class="result-label"><span class="result-label__title">${label}</span></div></th><td><div class="result-value">${iconMarkup('info')}<div><p class="result-value__primary">${formatted}</p></div></div></td></tr>`;
}

function describeBooleanResult(key: ResultKey, label: string, value: boolean) {
  const meta = BOOLEAN_PRESENTATION[key];
  const positiveWhenFalse = meta?.positiveWhen === 'false';
  const isPositive = positiveWhenFalse ? !value : value;
  const intent: StatusIntent = isPositive ? 'pass' : 'fail';
  const primary = isPositive
    ? meta?.positivePrimary ?? `${label} looks good`
    : meta?.negativePrimary ?? `${label} needs attention`;
  const secondary = isPositive
    ? meta?.positiveSecondary
    : meta?.negativeSecondary ?? (positiveWhenFalse ? `${label} is currently active` : undefined);

  return { intent, primary, secondary };
}

function formatLabel(key: ResultKey): string {
  if (LABEL_OVERRIDES[key]) {
    return LABEL_OVERRIDES[key] as string;
  }
  return key.replace(/([A-Z])/g, ' $1').trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '—';
  }
  return String(value);
}

function iconMarkup(intent: StatusIntent): string {
  const path =
    intent === 'pass'
      ? '<polyline points="5 13 9 17 19 7" />'
      : intent === 'fail'
        ? '<line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />'
        : '<circle cx="12" cy="12" r="9" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />';

  return `<span class="status-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg></span>`;
}

function updateReadiness(result: ValidationResult): ReadinessState {
  const readiness = evaluateReadiness(result);
  verdictEl.className = `readiness-card readiness-card--${readiness.variant}`;
  verdictStatusEl.textContent = readiness.title;
  verdictDetailEl.textContent = readiness.detail;

  const iconIntent: StatusIntent =
    readiness.variant === 'pass' ? 'pass' : readiness.variant === 'fail' ? 'fail' : 'info';
  verdictIconEl.innerHTML = iconMarkup(iconIntent);

  if (readiness.reasons.length > 0) {
    verdictReasonsEl.hidden = false;
    verdictReasonsEl.innerHTML = readiness.reasons.map((reason) => `<li>${reason}</li>`).join('');
  } else {
    verdictReasonsEl.hidden = true;
    verdictReasonsEl.innerHTML = '';
  }

  return readiness;
}

function evaluateReadiness(result: ValidationResult | null): ReadinessState {
  if (!result) {
    return {
      variant: 'idle',
      title: 'Waiting for a file…',
      detail: 'Upload a pass to check whether Apple would accept it.',
      reasons: [],
    };
  }

  const blockers = collectBlockers(result);
  if (blockers.length === 0) {
    return {
      variant: 'pass',
      title: 'Apple would accept this pass',
      detail: 'All critical checks passed successfully.',
      reasons: [],
    };
  }

  return {
    variant: 'fail',
    title: 'Apple would reject this pass',
    detail: 'Address the blocking issues and run the validation again.',
    reasons: blockers,
  };
}

function collectBlockers(result: ValidationResult): string[] {
  const blockers: string[] = [];

  if (!result.HasPass) {
    blockers.push('The pass.json payload is missing.');
  }
  if (!result.HasManifest) {
    blockers.push('manifest.json is missing from the archive.');
  }
  if (!result.HasSignature) {
    blockers.push('The signature file is missing.');
  }
  if (!result.PassKitCertificateFound) {
    blockers.push('No PassKit certificate was embedded in the signature.');
  }
  if (!result.PassKitCertificateIssuedByApple) {
    blockers.push('The pass certificate was not issued by Apple.');
  }
  if (result.PassKitCertificateExpired) {
    blockers.push('The pass certificate has expired.');
  }
  if (result.HasSignatureExpired) {
    blockers.push('The signer certificate has expired.');
  }
  if (result.WwdrCertificateExpired) {
    blockers.push('The WWDR intermediate certificate has expired.');
  }
  if (!result.SignedByApple) {
    blockers.push('The signature chain is not trusted by Apple.');
  }
  if (!result.PassKitCertificateNameCorrect || !result.PassTypeIdentifierMatches) {
    blockers.push('The pass type identifier does not match the signing certificate.');
  }
  if (!result.TeamIdentifierMatches) {
    blockers.push('The team identifier does not match the signing certificate.');
  }
  if (!result.HasPassTypeIdentifier) {
    blockers.push('pass.json is missing the passTypeIdentifier field.');
  }
  if (!result.HasTeamIdentifier) {
    blockers.push('pass.json is missing the teamIdentifier field.');
  }

  return blockers;
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function showError(error: unknown): void {
  setStatus('Validation failed');
  errorEl.hidden = false;
  errorEl.textContent = error instanceof Error ? error.message : 'Unknown error';
}

function clearError(): void {
  errorEl.hidden = true;
  errorEl.textContent = '';
}
