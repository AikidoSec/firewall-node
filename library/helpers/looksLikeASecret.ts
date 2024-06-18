const LOWERCASE = "abcdefghijklmnopqrstuvwxyz".split("");
const UPPERCASE = LOWERCASE.map((char) => char.toUpperCase());
const NUMBERS = "0123456789".split("");
const SPECIAL = "!#$%^&*|;:<>".split("");
const WHITE_SPACE = /\s+/;
const MINIMUM_LENGTH = 10;

export function looksLikeASecret(str: string) {
  if (str.length <= MINIMUM_LENGTH) {
    return false;
  }

  const hasNumber = NUMBERS.some((char) => str.includes(char));
  const hasLower = LOWERCASE.some((char) => str.includes(char));
  const hasUpper = UPPERCASE.some((char) => str.includes(char));
  const hasSpecial = SPECIAL.some((char) => str.includes(char));
  const charsets = [hasNumber, hasLower, hasUpper, hasSpecial];

  // If the string doesn't have at least 2 different charsets, it's not a secret
  if (charsets.filter((type) => type).length < 2) {
    return false;
  }

  // If the string has white space, it's not a secret
  if (WHITE_SPACE.test(str)) {
    return false;
  }

  // Check uniqueness of characters in a window of 10 characters
  const windowSize = MINIMUM_LENGTH;
  const ratios: number[] = [];
  for (let i = 0; i <= str.length - windowSize; i++) {
    const window = str.slice(i, i + windowSize);
    const uniqueChars = new Set(window);
    ratios.push(uniqueChars.size / windowSize);
  }

  const averageRatio =
    ratios.reduce((acc, ratio) => acc + ratio, 0) / ratios.length;
  if (averageRatio < 0.8) {
    return false;
  }

  return true;
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
