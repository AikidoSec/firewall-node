const LOWERCASE = "abcdefghijklmnopqrstuvwxyz".split("");
const UPPERCASE = LOWERCASE.map((char) => char.toUpperCase());
const NUMBERS = "0123456789".split("");
const SPECIAL = "!#$%^&*|;:<>".split("");
const KNOWN_WORD_SEPARATORS = ["-"];
const WHITE_SPACE = /\s+/;
const MINIMUM_LENGTH = 10;

export function looksLikeASecret(str: string) {
  if (str.length <= MINIMUM_LENGTH) {
    return false;
  }

  const hasNumber = NUMBERS.some((char) => str.includes(char));

  if (!hasNumber) {
    return false;
  }

  const hasLower = LOWERCASE.some((char) => str.includes(char));
  const hasUpper = UPPERCASE.some((char) => str.includes(char));
  const hasSpecial = SPECIAL.some((char) => str.includes(char));
  const charsets = [hasLower, hasUpper, hasSpecial];

  // If the string doesn't have at least 2 different charsets, it's not a secret
  if (!charsets.some((charset) => charset)) {
    return false;
  }

  // If the string has white space, it's not a secret
  if (WHITE_SPACE.test(str)) {
    return false;
  }

  if (KNOWN_WORD_SEPARATORS.some((separator) => str.includes(separator))) {
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
    ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;

  return averageRatio > 0.8;
}
