/**
 * Phala Network TEE attestation verification types
 * These types represent the response structure from the Phala attestation verification API
 */

/** TEE quote header containing attestation metadata */
interface QuoteHeader {
  /** Quote version number */
  version: number;
  /** Attestation key type (e.g., "ECDSA_P256") */
  ak_type: string;
  /** Trusted Execution Environment type (e.g., "TEE_TDX") */
  tee_type: string;
  /** Quoting Enclave vendor identifier */
  qe_vendor: string;
  /** User-defined data included in the quote */
  user_data: string;
}

/** TEE quote body containing measurements and configurations */
interface QuoteBody {
  /** TEE TCB (Trusted Computing Base) security version number */
  tee_tcb_svn: string;
  /** Measurement of SEAM module */
  mrseam: string;
  /** Measurement of SEAM signer */
  mrsignerseam: string;
  /** SEAM attributes */
  seamattributes: string;
  /** TD (Trust Domain) attributes */
  tdattributes: string;
  /** Extended Family ID */
  xfam: string;
  /** Measurement of the TD initial contents */
  mrtd: string;
  /** Measurement of TD configuration */
  mrconfig: string;
  /** Measurement of TD owner */
  mrowner: string;
  /** Measurement of TD owner configuration */
  mrownerconfig: string;
  /** Runtime Measurement Register 0 */
  rtmr0: string;
  /** Runtime Measurement Register 1 */
  rtmr1: string;
  /** Runtime Measurement Register 2 */
  rtmr2: string;
  /** Runtime Measurement Register 3 */
  rtmr3: string;
  /** Report data included in the quote */
  reportdata: string;
}

/** Complete TEE attestation quote */
interface AttestationQuote {
  /** Quote header with metadata */
  header: QuoteHeader;
  /** PEM-encoded certificate chain data */
  cert_data: string;
  /** Quote body with measurements */
  body: QuoteBody;
  /** Whether the quote verification passed */
  verified: boolean;
}

/** Quote collateral data for verification */
interface QuoteCollateral {
  /** PCK CRL issuer certificate chain */
  pck_crl_issuer_chain: string;
  /** Root CA certificate revocation list */
  root_ca_crl: string;
  /** PCK certificate revocation list */
  pck_crl: string;
  /** TCB info issuer certificate chain */
  tcb_info_issuer_chain: string;
  /** TCB (Trusted Computing Base) information JSON */
  tcb_info: string;
  /** TCB info signature */
  tcb_info_signature: string;
  /** QE identity issuer certificate chain */
  qe_identity_issuer_chain: string;
  /** Quoting Enclave identity JSON */
  qe_identity: string;
  /** QE identity signature */
  qe_identity_signature: string;
}

/** Complete Phala attestation verification result */
export interface PhalaAttestationResult {
  /** Whether the verification was successful */
  success: boolean;
  /** The verified attestation quote */
  quote: AttestationQuote;
  /** Checksum of the attestation data */
  checksum: string;
  /** Whether the attestation can be downloaded (null if not applicable) */
  can_download: boolean | null;
  /** Timestamp when the attestation was uploaded (null if not applicable) */
  uploaded_at: string | null;
  /** Additional verification collateral */
  quote_collateral: QuoteCollateral;
}

/**
 * Verifies a Phala Network TEE attestation
 * @param hexData - Hex-encoded attestation data to verify
 * @returns Promise resolving to the verification result
 */
export const verifyPhalaAttestation = async (
  hexData: string
): Promise<PhalaAttestationResult> => {
  const response = await fetch(
    "https://cors-proxy-production-3af0.up.railway.app/https://cloud-api.phala.network/api/v1/attestations/verify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ hex: hexData }),
    }
  );

  if (!response.ok) {
    throw new Error(
      `Phala attestation verification failed: ${response.status} ${response.statusText}`
    );
  }

  const result: PhalaAttestationResult = await response.json();
  return result;
};
