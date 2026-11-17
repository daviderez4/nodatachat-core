// Example: Generate identity from seed phrase
// Run: npx tsx examples/identity.ts

import {
  generateSeedPhrase,
  deriveBillingSerial,
  deriveRecoveryKey,
  validateSeedPhrase,
} from '@nodatachat/core';

async function main() {
  // Generate a 12-word seed phrase
  const seed = generateSeedPhrase();
  console.log('Seed phrase:', seed.join(' '));
  console.log('Valid:', validateSeedPhrase(seed));

  // Derive billing serial (one-way hash — can't reverse to seed)
  const serial = await deriveBillingSerial(seed);
  console.log('Billing serial:', serial);

  // Derive recovery key (different hash — independent from billing)
  const recovery = await deriveRecoveryKey(seed);
  console.log('Recovery key:', recovery);

  // Same seed always produces same serial
  const serial2 = await deriveBillingSerial(seed);
  console.log('Deterministic:', serial === serial2);
}

main();
