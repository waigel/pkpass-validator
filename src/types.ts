export interface ValidationResult {
  HasPass: boolean;
  HasManifest: boolean;
  HasSignature: boolean;
  TeamIdentifierMatches: boolean;
  PassTypeIdentifierMatches: boolean;
  SignedByApple: boolean;
  HasSignatureExpired: boolean;
  SignatureExpirationDate: string | null;
  HasIcon3x: boolean;
  HasIcon2x: boolean;
  HasIcon1x: boolean;
  HasPassTypeIdentifier: boolean;
  HasTeamIdentifier: boolean;
  HasDescription: boolean;
  HasFormatVersion: boolean;
  HasSerialNumber: boolean;
  HasSerialNumberOfCorrectLength: boolean;
  HasOrganizationName: boolean;
  HasAppLaunchUrl: boolean;
  HasAssociatedStoreIdentifiers: boolean;
  WwdrCertificateExpired: boolean;
  WwdrCertificateSubjectMatches: boolean;
  WwdrCertificateIsCorrectVersion: boolean;
  HasAuthenticationToken: boolean;
  HasWebServiceUrl: boolean;
  WebServiceUrlIsHttps: boolean;
  AuthenticationTokenRequiresWebServiceUrl: boolean;
  WebServiceUrlRequiresAuthenticationToken: boolean;
  PassKitCertificateNameCorrect: boolean;
  PassKitCertificateExpired: boolean;
  WwdrCertificateFound: boolean;
  PassKitCertificateFound: boolean;
  AuthenticationTokenCorrectLength: boolean;
  PassKitCertificateIssuedByApple: boolean;
}

export type PkPassInput = ArrayBuffer | ArrayBufferView | Blob;

export interface ValidatorOptions {
  /**
   * Skip CMS signature verification when the runtime lacks WebCrypto support.
   */
  skipSignatureVerification?: boolean;
}
