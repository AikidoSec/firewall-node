const LOWERCASE = "abcdefghijklmnopqrstuvwxyz".split("");
const UPPERCASE = LOWERCASE.map((char) => char.toUpperCase());
const NUMBERS = "0123456789".split("");
const SPECIAL = "!#$%^&*|;:<>".split("");
const WHITE_SPACE = /\s+/;

export function looksLikeASecret(str: string) {
  if (str.length <= 10) {
    return false;
  }

  // If the string has 3 repeated characters, it's not a secret
  if (hasRepeatedChars(str, 2)) {
    return false;
  }

  const hasLower = LOWERCASE.some((char) => str.includes(char));
  const hasUpper = UPPERCASE.some((char) => str.includes(char));
  const hasNumber = NUMBERS.some((char) => str.includes(char));
  const hasSpecial = SPECIAL.some((char) => str.includes(char));
  const charsets = [hasLower, hasUpper, hasNumber, hasSpecial];

  // If the string doesn't have at least 2 different charsets, it's not a secret
  if (charsets.filter((type) => type).length < 2) {
    return false;
  }

  // If the string has white space, it's not a secret
  if (WHITE_SPACE.test(str)) {
    return false;
  }

  // Calculate the entropy of a string using Shannon's entropy formula
  // If the string has an entropy lower than 3, it's not a secret
  if (calculateEntropy(str) < 3) {
    return false;
  }

  return true;
}

function calculateEntropy(s: string): number {
  const freq: { [key: string]: number } = {};
  for (const char of s) {
    freq[char] = (freq[char] || 0) + 1;
  }

  const len = s.length;
  let entropy = 0;
  for (const char in freq) {
    const p = freq[char] / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

function hasRepeatedChars(s: string, limit: number): boolean {
  let count = 1;
  for (let i = 1; i < s.length; i++) {
    if (s[i] === s[i - 1]) {
      count++;
      if (count > limit) {
        return true;
      }
    } else {
      count = 1;
    }
  }

  return false;
}
