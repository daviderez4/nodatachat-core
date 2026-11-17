// ═══════════════════════════════════════════════════════════
// @nodatachat/core — Identity & Seed Phrase Primitives
//
// Pure cryptographic identity functions.
// No storage, no side effects, no platform dependencies.
// Uses only the Web Crypto API (available in browsers & Node 20+).
// ═══════════════════════════════════════════════════════════

// BIP39-like word list (256 words for 12-word phrases)
// Each word = 8 bits of entropy → 12 words = 96 bits
const WORD_LIST = [
  'abandon','ability','able','about','above','absent','absorb','abstract',
  'absurd','abuse','access','accident','account','accuse','achieve','acid',
  'across','act','action','actor','address','adjust','admit','adult',
  'advance','advice','aerobic','afford','agree','ahead','aim','air',
  'airport','aisle','alarm','album','alert','alien','all','alley',
  'allow','almost','alone','alpha','already','alter','always','amateur',
  'amazing','among','amount','amused','anchor','ancient','anger','angle',
  'angry','animal','ankle','announce','annual','another','answer','anxiety',
  'any','apart','apology','appear','apple','approve','april','arch',
  'arctic','area','arena','argue','arm','armed','armor','army',
  'around','arrange','arrest','arrive','arrow','art','artefact','artist',
  'artwork','ask','aspect','assault','asset','assist','assume','asthma',
  'athlete','atom','attack','attend','auction','audit','august','aunt',
  'author','auto','autumn','average','avocado','avoid','awake','aware',
  'awesome','awful','awkward','axis','baby','bachelor','bacon','badge',
  'bag','balance','balcony','ball','bamboo','banana','banner','bar',
  'barely','bargain','barrel','base','basic','basket','battle','beach',
  'bean','beauty','because','become','beef','before','begin','behave',
  'behind','believe','below','bench','benefit','best','betray','better',
  'between','beyond','bicycle','bid','bike','bind','biology','bird',
  'birth','bitter','black','blade','blame','blanket','blast','bleak',
  'bless','blind','blood','blossom','blow','blue','blur','blush',
  'board','boat','body','boil','bomb','bone','bonus','book',
  'boost','border','boring','borrow','boss','bottom','bounce','box',
  'boy','bracket','brain','brand','brass','brave','bread','breeze',
  'brick','bridge','brief','bright','bring','brisk','broad','broken',
  'bronze','broom','brother','brown','brush','bubble','buddy','budget',
  'buffalo','build','bulb','bulk','bullet','bundle','bunker','burden',
  'burger','burst','bus','business','busy','butter','buyer','buzz',
  'cabbage','cabin','cable','cactus','cage','cake','call','calm',
  'camera','camp','can','canal','cancel','candy','cannon','canoe',
  'canvas','canyon','capable','capital','captain','car','carbon','card',
  'cargo','carpet','carry','cart','case','cash','casino','castle',
];

/**
 * Generate a cryptographically random 12-word seed phrase.
 */
export function generateSeedPhrase(): string[] {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => WORD_LIST[b % WORD_LIST.length]);
}

/**
 * Derive a stable billing_serial hash from a seed phrase.
 * SHA-256 with domain separator — irreversible and unique per purpose.
 */
export async function deriveBillingSerial(seedPhrase: string[]): Promise<string> {
  const input = `nodatachat:billing:${seedPhrase.join(' ')}`;
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derive a device-recovery key from seed phrase.
 * Different domain separator than billing — the two hashes are independent.
 */
export async function deriveRecoveryKey(seedPhrase: string[]): Promise<string> {
  const input = `nodatachat:recovery:${seedPhrase.join(' ')}`;
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate that a seed phrase has 12 valid words.
 */
export function validateSeedPhrase(words: string[]): boolean {
  if (words.length !== 12) return false;
  return words.every(w => WORD_LIST.includes(w.toLowerCase().trim()));
}

/**
 * Get the word list (for UI rendering of seed phrase input).
 */
export function getWordList(): readonly string[] {
  return WORD_LIST;
}
