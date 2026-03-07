// =====================================================
// NO DATA — Client-Side Encryption Module
// ALL encryption/decryption happens IN THE BROWSER
// The server NEVER sees plaintext content
// =====================================================

export interface EncryptedPackage {
  encrypted_blob: string;
  encrypted_aes_key: string;
  iv: string;
}

export interface EncryptedFilePackage {
  encrypted_file: string;
  encrypted_file_key: string;
  iv: string;
  encrypted_metadata: string;
  metadata_iv: string;
  encrypted_size: number;
}

export interface KeyPairResult {
  publicKeyJwk: JsonWebKey;
  privateKeyJwk: JsonWebKey;
}

class NoDataCrypto {
  // ─────────────────────────────────────────────
  // KEY GENERATION (runs once per agent/client)
  // ─────────────────────────────────────────────

  static async generateKeyPair(): Promise<KeyPairResult> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );

    const publicKeyJwk = await crypto.subtle.exportKey(
      "jwk",
      keyPair.publicKey
    );
    const privateKeyJwk = await crypto.subtle.exportKey(
      "jwk",
      keyPair.privateKey
    );

    return { publicKeyJwk, privateKeyJwk };
  }

  // ─────────────────────────────────────────────
  // ENCRYPT MESSAGE (browser → server → recipient)
  // ─────────────────────────────────────────────

  static async encryptMessage(
    plaintext: string,
    recipientPublicKeyJwk: JsonWebKey
  ): Promise<EncryptedPackage> {
    const recipientPublicKey = await crypto.subtle.importKey(
      "jwk",
      recipientPublicKeyJwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );

    const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encodedContent = new TextEncoder().encode(plaintext);
    const encryptedContent = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      aesKey,
      encodedContent
    );

    const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
    const encryptedAesKey = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      recipientPublicKey,
      rawAesKey
    );

    return {
      encrypted_blob: this.arrayBufferToBase64(encryptedContent),
      encrypted_aes_key: this.arrayBufferToBase64(encryptedAesKey),
      iv: this.arrayBufferToBase64(iv),
    };
  }

  // ─────────────────────────────────────────────
  // DECRYPT MESSAGE (recipient browser only)
  // ─────────────────────────────────────────────

  static async decryptMessage(
    encryptedPackage: EncryptedPackage,
    privateKeyJwk: JsonWebKey
  ): Promise<string> {
    const privateKey = await crypto.subtle.importKey(
      "jwk",
      privateKeyJwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["decrypt"]
    );

    const encryptedAesKey = this.base64ToArrayBuffer(
      encryptedPackage.encrypted_aes_key
    );
    const rawAesKey = await crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      privateKey,
      encryptedAesKey
    );

    const aesKey = await crypto.subtle.importKey(
      "raw",
      rawAesKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );

    const iv = this.base64ToArrayBuffer(encryptedPackage.iv);
    const encryptedContent = this.base64ToArrayBuffer(
      encryptedPackage.encrypted_blob
    );
    const decryptedContent = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      aesKey,
      encryptedContent
    );

    return new TextDecoder().decode(decryptedContent);
  }

  // ─────────────────────────────────────────────
  // ENCRYPT FILE
  // ─────────────────────────────────────────────

  static async encryptFile(
    file: File,
    recipientPublicKeyJwk: JsonWebKey
  ): Promise<EncryptedFilePackage> {
    const fileBuffer = await file.arrayBuffer();

    const aesKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedFile = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      aesKey,
      fileBuffer
    );

    const metadata = JSON.stringify({
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    });
    const metadataIv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedMetadata = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: metadataIv, tagLength: 128 },
      aesKey,
      new TextEncoder().encode(metadata)
    );

    const recipientPublicKey = await crypto.subtle.importKey(
      "jwk",
      recipientPublicKeyJwk,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );
    const rawAesKey = await crypto.subtle.exportKey("raw", aesKey);
    const encryptedAesKey = await crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      recipientPublicKey,
      rawAesKey
    );

    return {
      encrypted_file: this.arrayBufferToBase64(encryptedFile),
      encrypted_file_key: this.arrayBufferToBase64(encryptedAesKey),
      iv: this.arrayBufferToBase64(iv),
      encrypted_metadata: this.arrayBufferToBase64(encryptedMetadata),
      metadata_iv: this.arrayBufferToBase64(metadataIv),
      encrypted_size: encryptedFile.byteLength,
    };
  }

  // ─────────────────────────────────────────────
  // OTP-BASED KEY DERIVATION (clients without stored keys)
  // ─────────────────────────────────────────────

  static async deriveKeyFromOTP(
    otp: string,
    salt: string
  ): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(otp),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );

    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode(salt),
        iterations: 310000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );

    return derivedKey;
  }

  // ─────────────────────────────────────────────
  // ENCRYPT WITH DERIVED KEY (for OTP-based flow)
  // ─────────────────────────────────────────────

  static async encryptWithDerivedKey(
    plaintext: string,
    derivedKey: CryptoKey
  ): Promise<{ encrypted: string; iv: string }> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      derivedKey,
      encoded
    );
    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
    };
  }

  static async decryptWithDerivedKey(
    encryptedBase64: string,
    ivBase64: string,
    derivedKey: CryptoKey
  ): Promise<string> {
    const encrypted = this.base64ToArrayBuffer(encryptedBase64);
    const iv = this.base64ToArrayBuffer(ivBase64);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      derivedKey,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  }

  // ─────────────────────────────────────────────
  // ENCRYPT/DECRYPT FILE WITH DERIVED KEY
  // (for Secure Channel OTP-based flow)
  // ─────────────────────────────────────────────

  static async encryptFileWithDerivedKey(
    file: File,
    derivedKey: CryptoKey
  ): Promise<{ encrypted_file: string; iv: string; encrypted_metadata: string; metadata_iv: string; encrypted_size: number }> {
    const fileBuffer = await file.arrayBuffer();

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedFile = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      derivedKey,
      fileBuffer
    );

    // Encrypt metadata separately with the same derived key
    const metadata = JSON.stringify({
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified,
    });
    const metadataIv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedMetadata = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: metadataIv, tagLength: 128 },
      derivedKey,
      new TextEncoder().encode(metadata)
    );

    return {
      encrypted_file: this.arrayBufferToBase64(encryptedFile),
      iv: this.arrayBufferToBase64(iv),
      encrypted_metadata: this.arrayBufferToBase64(encryptedMetadata),
      metadata_iv: this.arrayBufferToBase64(metadataIv),
      encrypted_size: encryptedFile.byteLength,
    };
  }

  static async decryptFileWithDerivedKey(
    encryptedFileBase64: string,
    ivBase64: string,
    derivedKey: CryptoKey
  ): Promise<ArrayBuffer> {
    const encrypted = this.base64ToArrayBuffer(encryptedFileBase64);
    const iv = this.base64ToArrayBuffer(ivBase64);
    return crypto.subtle.decrypt(
      { name: "AES-GCM", iv, tagLength: 128 },
      derivedKey,
      encrypted
    );
  }

  // ─────────────────────────────────────────────
  // SEED PHRASE KEY DERIVATION (C3)
  // Derive a deterministic AES-256-GCM key from a
  // 12-word seed phrase. This key is used to
  // encrypt/decrypt the RSA private key for backup
  // and recovery across devices.
  // ─────────────────────────────────────────────

  private static readonly PBKDF2_ITERATIONS = 310000;
  private static readonly SEED_SALT = 'NoDataChat-Seed-v1';

  /**
   * Derive a deterministic AES-256-GCM key from a 12-word seed phrase.
   *
   * Uses PBKDF2 with 310,000 iterations and a fixed salt to produce
   * a 256-bit key. The same seed phrase always produces the same key,
   * enabling cross-device key recovery.
   *
   * @param seedPhrase - Space-separated 12-word seed phrase
   * @returns AES-256-GCM CryptoKey derived from the seed
   */
  static async deriveSeedKey(seedPhrase: string): Promise<CryptoKey> {
    const normalized = seedPhrase.trim().toLowerCase();

    // Import seed phrase as PBKDF2 key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(normalized),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Derive AES-256-GCM key using PBKDF2
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode(this.SEED_SALT),
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // not extractable — used only for encrypt/decrypt
      ['encrypt', 'decrypt']
    );

    return derivedKey;
  }

  /**
   * Encrypt an RSA private key (JWK) with a seed-derived AES key.
   *
   * This produces a portable encrypted blob that can be stored as a
   * backup. Only the original seed phrase can recover the private key.
   *
   * Format: [12-byte IV] + [AES-GCM ciphertext with 128-bit tag]
   *
   * @param privateKey - The RSA private CryptoKey to backup
   * @param seedKey    - AES-256-GCM key derived from seed phrase
   * @returns Encrypted private key as ArrayBuffer (IV prepended)
   */
  static async exportKeyWithSeed(
    privateKey: CryptoKey,
    seedKey: CryptoKey
  ): Promise<ArrayBuffer> {
    // Export the RSA private key as JWK, then serialize to JSON
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', privateKey);
    const serialized = new TextEncoder().encode(JSON.stringify(privateKeyJwk));

    // Generate random IV for AES-GCM
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt the serialized private key
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      seedKey,
      serialized
    );

    // Prepend IV to ciphertext: [IV(12)] + [ciphertext]
    const result = new Uint8Array(iv.byteLength + encrypted.byteLength);
    result.set(iv, 0);
    result.set(new Uint8Array(encrypted), iv.byteLength);

    return result.buffer;
  }

  /**
   * Decrypt an RSA private key using a seed-derived AES key.
   *
   * Reverses exportKeyWithSeed: extracts the IV, decrypts the blob,
   * and re-imports the RSA-OAEP private key.
   *
   * @param encryptedKey - Encrypted private key (IV-prepended ArrayBuffer)
   * @param seedKey      - AES-256-GCM key derived from seed phrase
   * @returns The recovered RSA-OAEP private CryptoKey
   */
  static async importKeyWithSeed(
    encryptedKey: ArrayBuffer,
    seedKey: CryptoKey
  ): Promise<CryptoKey> {
    const data = new Uint8Array(encryptedKey);

    // Extract IV (first 12 bytes) and ciphertext (rest)
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);

    // Decrypt with AES-GCM
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, tagLength: 128 },
      seedKey,
      ciphertext
    );

    // Parse JWK and re-import as RSA-OAEP private key
    const jwkString = new TextDecoder().decode(decrypted);
    const privateKeyJwk: JsonWebKey = JSON.parse(jwkString);

    const privateKey = await crypto.subtle.importKey(
      'jwk',
      privateKeyJwk,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      true, // extractable — so it can be re-exported if needed
      ['decrypt']
    );

    // Wipe decrypted key material from memory
    new Uint8Array(decrypted).fill(0);

    return privateKey;
  }

  // ─────────────────────────────────────────────
  // HASH PHONE NUMBER
  // ─────────────────────────────────────────────

  static async hashPhone(phone: string): Promise<string> {
    const encoded = new TextEncoder().encode(phone.replace(/\D/g, ""));
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // ─────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────

  static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  static wipeFromMemory(arrayBuffer: ArrayBuffer): void {
    new Uint8Array(arrayBuffer).fill(0);
  }
}

export default NoDataCrypto;
