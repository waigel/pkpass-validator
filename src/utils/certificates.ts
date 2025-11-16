import type { AttributeTypeAndValue, Certificate } from 'pkijs';
import { bufferToHex, bufferToUtf8 } from './binary.js';

const OID_COMMON_NAME = '2.5.4.3';
const OID_ORGANIZATION = '2.5.4.10';
const OID_ORG_UNIT = '2.5.4.11';

export function getAttributeValue(
  attributes: AttributeTypeAndValue[] | undefined,
  oid: string
): string | undefined {
  if (!attributes) return undefined;
  const entry = attributes.find((attr) => attr.type === oid);
  if (!entry) return undefined;
  return attributeValueToString(entry.value);
}

export function attributeValueToString(value?: AttributeTypeAndValue['value']): string | undefined {
  if (!value) return undefined;
  const block: any = value.valueBlock;
  if (!block) return undefined;
  if (typeof block.value === 'string' && block.value.length > 0) {
    return block.value;
  }
  if (block.valueHex) {
    return bufferToUtf8(block.valueHex);
  }
  if (typeof block.valueDec === 'number') {
    return String(block.valueDec);
  }
  return undefined;
}

export function findCertificateBySerial(certificates: Certificate[] = [], serialHex: string): Certificate | undefined {
  return certificates.find((cert) => bufferToHex(cert.serialNumber.valueBlock.valueHex) === serialHex);
}

export function isCertificateIssuedByApple(cert: Certificate | undefined): boolean {
  if (!cert) return false;
  const issuerOrg = getAttributeValue(cert.issuer.typesAndValues, OID_ORGANIZATION);
  const issuerCn = getAttributeValue(cert.issuer.typesAndValues, OID_COMMON_NAME);
  return issuerOrg === 'Apple Inc.' && issuerCn === 'Apple Worldwide Developer Relations Certification Authority';
}

export function getCertificateCommonName(cert: Certificate | undefined): string | undefined {
  if (!cert) return undefined;
  return getAttributeValue(cert.subject.typesAndValues, OID_COMMON_NAME);
}

export function getCertificateOrgUnit(cert: Certificate | undefined): string | undefined {
  if (!cert) return undefined;
  return getAttributeValue(cert.subject.typesAndValues, OID_ORG_UNIT);
}

export function getCertificateOrganization(cert: Certificate | undefined): string | undefined {
  if (!cert) return undefined;
  return getAttributeValue(cert.subject.typesAndValues, OID_ORGANIZATION);
}
