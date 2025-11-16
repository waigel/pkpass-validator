import JSZip from 'jszip';
import * as asn1js from 'asn1js';
import { Certificate, ContentInfo, SignedData } from 'pkijs';

import { ensureCryptoEngine } from './crypto/setup.js';
import { PkPassInput, ValidationResult, ValidatorOptions } from './types.js';
import { bufferToAscii, bufferToHex, bufferToUtf8, inputToUint8Array, toUint8Array } from './utils/binary.js';
import {
  getCertificateCommonName,
  getCertificateOrgUnit,
  isCertificateIssuedByApple,
} from './utils/certificates.js';

const G4_WWDR_SERIAL = '13DC77955271E53DC632E8CCFFE521F3CCC5CED2';
const PASS_TYPE_EXTENSION_OID = '1.2.840.113635.100.6.1.16';

export async function validatePkPass(input: PkPassInput, options: ValidatorOptions = {}): Promise<ValidationResult> {
  const result = createDefaultResult();
  const normalizedData = await inputToUint8Array(input);
  const archive = await JSZip.loadAsync(normalizedData);

  const lowerCaseFiles: Record<string, JSZip.JSZipObject> = {};
  archive.forEach((relativePath, file) => {
    lowerCaseFiles[relativePath.toLowerCase()] = file;
  });

  const manifestEntry = lowerCaseFiles['manifest.json'];
  const passEntry = lowerCaseFiles['pass.json'];
  const signatureEntry = lowerCaseFiles['signature'];

  let manifestBytes: Uint8Array | null = null;
  let signatureBytes: Uint8Array | null = null;
  let manifestPassTypeIdentifier: string | null = null;
  let manifestTeamIdentifier: string | null = null;

  if (manifestEntry) {
    result.HasManifest = true;
    manifestBytes = await manifestEntry.async('uint8array');
  }

  if (passEntry) {
    result.HasPass = true;
    const passBytes = await passEntry.async('uint8array');
    const passJson: Record<string, unknown> = JSON.parse(bufferToUtf8(passBytes));

    manifestPassTypeIdentifier = extractString(passJson, 'passTypeIdentifier');
    result.HasPassTypeIdentifier = Boolean(manifestPassTypeIdentifier);

    manifestTeamIdentifier = extractString(passJson, 'teamIdentifier');
    result.HasTeamIdentifier = Boolean(manifestTeamIdentifier);

    const description = extractString(passJson, 'description');
    result.HasDescription = Boolean(description);

    if ('formatVersion' in passJson) {
      result.HasFormatVersion = passJson.formatVersion === 1;
    }

    const serialNumber = extractString(passJson, 'serialNumber');
    result.HasSerialNumber = Boolean(serialNumber);
    if (serialNumber) {
      result.HasSerialNumberOfCorrectLength = serialNumber.length >= 16;
    }

    const organizationName = extractString(passJson, 'organizationName');
    result.HasOrganizationName = Boolean(organizationName);

    if ('appLaunchURL' in passJson) {
      result.HasAppLaunchUrl = true;
      result.HasAssociatedStoreIdentifiers = Array.isArray(passJson.associatedStoreIdentifiers);
    }

    if ('webServiceURL' in passJson) {
      result.HasWebServiceUrl = true;
      const webServiceUrl = extractString(passJson, 'webServiceURL') ?? '';
      result.WebServiceUrlIsHttps = webServiceUrl.toLowerCase().startsWith('https://');
    }

    if ('authenticationToken' in passJson) {
      result.HasAuthenticationToken = true;
      const authToken = extractString(passJson, 'authenticationToken') ?? '';
      result.AuthenticationTokenCorrectLength = authToken.length >= 16;
    }

    if (result.HasAuthenticationToken && !result.HasWebServiceUrl) {
      result.AuthenticationTokenRequiresWebServiceUrl = true;
    }

    if (result.HasWebServiceUrl && !result.HasAuthenticationToken) {
      result.WebServiceUrlRequiresAuthenticationToken = true;
    }
  }

  if (signatureEntry) {
    result.HasSignature = true;
    signatureBytes = await signatureEntry.async('uint8array');
  }

  result.HasIcon1x = Boolean(lowerCaseFiles['icon.png']);
  result.HasIcon2x = Boolean(lowerCaseFiles['icon@2x.png']);
  result.HasIcon3x = Boolean(lowerCaseFiles['icon@3x.png']);

  if (!manifestBytes || !signatureBytes) {
    return result;
  }

  if (options.skipSignatureVerification) {
    return result;
  }

  try {
    await ensureCryptoEngine();

    const signatureBuffer = toArrayBuffer(signatureBytes);
    const manifestBuffer = toArrayBuffer(manifestBytes);

    const { cmsSigned, certificates } = decodeSignature(signatureBuffer);

    await verifySignature(cmsSigned, manifestBuffer);

    const passCertificate = evaluateCertificates({
      result,
      certificates,
      manifestPassTypeIdentifier,
    });

    evaluateSigner({
      result,
      signerCertificate: passCertificate,
      manifestPassTypeIdentifier,
      manifestTeamIdentifier,
    });

  } catch (error) {
    if (!(error instanceof Error)) {
      throw error;
    }
  }

  return result;
}

function extractString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function createDefaultResult(): ValidationResult {
  return {
    HasPass: false,
    HasManifest: false,
    HasSignature: false,
    TeamIdentifierMatches: false,
    PassTypeIdentifierMatches: false,
    SignedByApple: false,
    HasSignatureExpired: true,
    SignatureExpirationDate: null,
    HasIcon3x: false,
    HasIcon2x: false,
    HasIcon1x: false,
    HasPassTypeIdentifier: false,
    HasTeamIdentifier: false,
    HasDescription: false,
    HasFormatVersion: false,
    HasSerialNumber: false,
    HasSerialNumberOfCorrectLength: false,
    HasOrganizationName: false,
    HasAppLaunchUrl: false,
    HasAssociatedStoreIdentifiers: false,
    WwdrCertificateExpired: true,
    WwdrCertificateSubjectMatches: false,
    WwdrCertificateIsCorrectVersion: false,
    HasAuthenticationToken: false,
    HasWebServiceUrl: false,
    WebServiceUrlIsHttps: false,
    AuthenticationTokenRequiresWebServiceUrl: false,
    WebServiceUrlRequiresAuthenticationToken: false,
    PassKitCertificateNameCorrect: false,
    PassKitCertificateExpired: true,
    WwdrCertificateFound: false,
    PassKitCertificateFound: false,
    AuthenticationTokenCorrectLength: false,
    PassKitCertificateIssuedByApple: false,
  };
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.slice().buffer;
}

function decodeSignature(signatureBuffer: ArrayBuffer) {
  const asn1Result = asn1js.fromBER(signatureBuffer);
  if (asn1Result.offset === -1) {
    throw new Error('Unable to parse pkpass signature file.');
  }

  const contentInfo = ContentInfo.fromBER(signatureBuffer);
  if (contentInfo.contentType !== ContentInfo.SIGNED_DATA) {
    throw new Error('Signature file is not a CMS SignedData structure.');
  }

  const cmsSigned = new SignedData({ schema: contentInfo.content });
  const certificates = (cmsSigned.certificates ?? []).filter(
    (entry): entry is Certificate => entry instanceof Certificate
  );

  return { cmsSigned, certificates };
}

async function verifySignature(cmsSigned: SignedData, manifestBuffer: ArrayBuffer): Promise<void> {
  try {
    await cmsSigned.verify({ signer: 0, data: manifestBuffer });
  } catch (err) {
    // Parity with the reference implementation: ignore verification errors but continue parsing details.
  }
}

interface CertificateEvaluationContext {
  result: ValidationResult;
  certificates: Certificate[];
  manifestPassTypeIdentifier: string | null;
}

function evaluateCertificates({
  result,
  certificates,
  manifestPassTypeIdentifier,
}: CertificateEvaluationContext): Certificate | undefined {
  let wwdrCertificate: Certificate | undefined;
  let passKitCertificate: Certificate | undefined;

  for (const certificate of certificates) {
    const serial = bufferToHex(certificate.serialNumber.valueBlock.valueHex);
    if (serial === G4_WWDR_SERIAL) {
      wwdrCertificate = certificate;
      result.SignedByApple = true;
      result.WwdrCertificateFound = true;
      result.WwdrCertificateIsCorrectVersion = true;
      result.WwdrCertificateExpired = certificateExpired(certificate);
      const subjectCn = getCertificateCommonName(certificate);
      result.WwdrCertificateSubjectMatches =
        subjectCn === 'Apple Worldwide Developer Relations Certification Authority';
    } else if (isCertificateIssuedByApple(certificate)) {
      passKitCertificate = certificate;
    }
  }

  if (passKitCertificate) {
    result.PassKitCertificateFound = true;
    result.PassKitCertificateIssuedByApple = isCertificateIssuedByApple(passKitCertificate);
    result.PassKitCertificateExpired = certificateExpired(passKitCertificate);

    const extension = passKitCertificate.extensions?.find((ext) => ext.extnID === PASS_TYPE_EXTENSION_OID);
    if (extension) {
      const ascii = bufferToAscii(extension.extnValue.valueBlock.valueHex ?? new ArrayBuffer(0));
      const trimmed = ascii.substring(2);
      result.PassKitCertificateNameCorrect = Boolean(
        manifestPassTypeIdentifier && trimmed === manifestPassTypeIdentifier
      );
    }
  }

  return passKitCertificate;
}

interface SignerEvaluationContext {
  result: ValidationResult;
  signerCertificate?: Certificate;
  manifestPassTypeIdentifier: string | null;
  manifestTeamIdentifier: string | null;
}

function evaluateSigner({
  result,
  signerCertificate,
  manifestPassTypeIdentifier,
  manifestTeamIdentifier,
}: SignerEvaluationContext): void {
  if (!signerCertificate) {
    return;
  }

  const expiry = signerCertificate.notAfter.value as Date | undefined;
  if (expiry) {
    result.HasSignatureExpired = expiry.getTime() < Date.now();
    result.SignatureExpirationDate = formatDate(expiry);
  }

  const certificateCommonName = getCertificateCommonName(signerCertificate) ?? '';
  let signaturePassTypeIdentifier: string | undefined;

  if (certificateCommonName.includes('Pass Type ID with NFC:')) {
    signaturePassTypeIdentifier = certificateCommonName.replace('Pass Type ID with NFC: ', '').trim();
  } else if (certificateCommonName.includes('Pass Type ID:')) {
    signaturePassTypeIdentifier = certificateCommonName.replace('Pass Type ID: ', '').trim();
  }

  const certificateOrganisationUnit = getCertificateOrgUnit(signerCertificate);

  result.PassTypeIdentifierMatches =
    (manifestPassTypeIdentifier ?? null) === (signaturePassTypeIdentifier ?? null);

  result.TeamIdentifierMatches = (manifestTeamIdentifier ?? null) === (certificateOrganisationUnit ?? null);
}

function formatDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

function certificateExpired(cert?: Certificate): boolean {
  if (!cert) {
    return true;
  }
  const expiry = cert.notAfter.value as Date | undefined;
  if (!expiry) {
    return true;
  }
  return expiry.getTime() < Date.now();
}
