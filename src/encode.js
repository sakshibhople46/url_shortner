const BASE62_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// MOD must be a power of 2 for the coprime trick below to work simply.
// 2^34 gives room for ~17 billion unique codes — plenty, and fits in 6 base62 chars.
const MOD = 2 ** 34; // 17,179,869,184
const MULTIPLIER = 2654435761; // Knuth's multiplicative hash constant — odd, coprime to any power of 2

function obfuscateId(id) {
  // Modular multiplication: scrambles sequential ids across the full range
  return (id * MULTIPLIER) % MOD;
}

function encodeBase62(num) {
  if (num === 0) return BASE62_CHARS[0];

  let result = '';
  while (num > 0) {
    result = BASE62_CHARS[num % 62] + result;
    num = Math.floor(num / 62);
  }
  return result;
}

module.exports = { encodeBase62, obfuscateId };