// =====================================================
// NO DATA — Proof of Work Module (C4)
// Anti-spam: clients must solve a computational puzzle
// before sending messages through dead drops.
// =====================================================

/**
 * Convert an ArrayBuffer to a hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Compute SHA-256 hash of a string using Web Crypto API.
 */
async function sha256(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  return bufferToHex(hashBuffer);
}

/**
 * Solve a Proof of Work challenge.
 *
 * Finds a nonce such that SHA-256(messageHash + nonce) starts with
 * `difficulty` hex zeros (each zero = 4 bits of difficulty).
 *
 * Default difficulty: 4 → prefix "0000" → ~65,536 average attempts.
 *
 * @param messageHash - The hash of the message to prove work for
 * @param difficulty  - Number of leading hex zeros required (default: 4)
 * @returns The nonce and resulting hash that satisfy the difficulty
 */
export async function solveProofOfWork(
  messageHash: string,
  difficulty: number = 4
): Promise<{ nonce: number; hash: string }> {
  if (difficulty < 1 || difficulty > 16) {
    throw new Error('Difficulty must be between 1 and 16');
  }

  const prefix = '0'.repeat(difficulty);
  let nonce = 0;

  while (true) {
    const candidate = messageHash + nonce.toString();
    const hash = await sha256(candidate);

    if (hash.startsWith(prefix)) {
      return { nonce, hash };
    }

    nonce++;

    // Safety valve: prevent infinite loops in edge cases
    if (nonce > 2_000_000_000) {
      throw new Error('Proof of work exceeded maximum attempts');
    }
  }
}

/**
 * Verify a Proof of Work solution.
 *
 * Checks that SHA-256(messageHash + nonce) starts with `difficulty` hex zeros.
 *
 * @param messageHash - The original message hash
 * @param nonce       - The nonce claimed to solve the puzzle
 * @param difficulty  - Number of leading hex zeros required (default: 4)
 * @returns true if the proof is valid
 */
export async function verifyProofOfWork(
  messageHash: string,
  nonce: number,
  difficulty: number = 4
): Promise<boolean> {
  if (difficulty < 1 || difficulty > 16) {
    return false;
  }

  const prefix = '0'.repeat(difficulty);
  const candidate = messageHash + nonce.toString();
  const hash = await sha256(candidate);

  return hash.startsWith(prefix);
}
