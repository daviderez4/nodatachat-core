// ═══════════════════════════════════════════════════════════
// @nodatachat/core — Open-Source Core
// ═══════════════════════════════════════════════════════════
//
// Zero-knowledge identity & E2E encryption primitives.
// This package contains ONLY the cryptographic core —
// no UI, no server logic, no payment/subscription code.
//
// Everything here uses the Web Crypto API (W3C standard).
// No secrets in the code — security comes from the keys.
//

// Identity & Seed Phrase
export {
  generateSeedPhrase,
  deriveBillingSerial,
  deriveRecoveryKey,
  validateSeedPhrase,
  getWordList,
} from './identity';

// E2E Encryption (re-exported from @nodatachat/crypto)
export {
  NoDataCrypto,
  type EncryptedPackage,
  type EncryptedFilePackage,
  type KeyPairResult,
  solveProofOfWork,
  verifyProofOfWork,
  ALGORITHMS,
  CRYPTO_VERSION,
} from '@nodatachat/crypto';
