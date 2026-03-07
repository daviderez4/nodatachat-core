// ═══════════════════════════════════════════════════════════
// @nodatachat/crypto — E2E Encryption Module
// ═══════════════════════════════════════════════════════════
//
// Everything is encrypted client-side.
// The server NEVER sees plaintext.
// The server NEVER has private keys.
//

// Core encryption module
export { default as NoDataCrypto } from './nodata-crypto';
export type {
  EncryptedPackage,
  EncryptedFilePackage,
  KeyPairResult,
} from './nodata-crypto';

// Proof of Work (anti-spam)
export {
  solveProofOfWork,
  verifyProofOfWork,
} from './proof-of-work';

// Constants
export const CRYPTO_VERSION = '0.2.0';
export const ALGORITHMS = {
  ENCRYPTION: 'AES-256-GCM',
  KEY_EXCHANGE: 'RSA-OAEP-4096',
  KEY_DERIVATION: 'PBKDF2-SHA256-310K',
  SIGNING: 'Ed25519',
  HASHING: 'SHA-256',
  PROOF_OF_WORK: 'SHA-256-NONCE',
} as const;
