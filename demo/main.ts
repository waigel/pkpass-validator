import './style.css';
import type { ValidationResult } from '@waigel/pkpass-validator';
import { validatePkPass } from '@waigel/pkpass-validator';

const fileInput = document.querySelector<HTMLInputElement>('#pkpass-file');
const statusEl = document.querySelector<HTMLElement>('#status');
const resultsEl = document.querySelector<HTMLElement>('#results');
const errorEl = document.querySelector<HTMLElement>('#error');

if (!fileInput || !statusEl || !resultsEl || !errorEl) {
  throw new Error('Demo markup missing required elements');
}

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
    renderResult(result);
    setStatus(`Validation finished with ${summarizeResult(result)}`);
  } catch (error) {
    showError(error);
  }
});

function renderResult(result: ValidationResult): void {
  const rows = Object.entries(result)
    .map(([key, value]) => {
      const isBoolean = typeof value === 'boolean';
      const rowClass = isBoolean ? (value ? 'ok' : 'fail') : '';
      const displayValue = formatValue(value);
      return `<tr class="${rowClass}"><th>${key}</th><td>${displayValue}</td></tr>`;
    })
    .join('');

  resultsEl.innerHTML = `<table><thead><tr><th>Check</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function formatValue(value: unknown): string {
  if (typeof value === 'boolean') {
    return value ? 'Pass' : 'Fail';
  }
  if (value === null || value === undefined) {
    return '—';
  }
  return String(value);
}

function setStatus(message: string): void {
  statusEl.textContent = message;
}

function summarizeResult(result: ValidationResult): string {
  const criticalFlags = [
    result.HasManifest,
    result.HasPass,
    result.HasSignature,
    result.PassKitCertificateNameCorrect,
    result.PassTypeIdentifierMatches,
    result.TeamIdentifierMatches,
  ];

  const healthy = criticalFlags.every(Boolean);
  return healthy ? 'no blocking issues' : 'warnings';
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
