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

  const hasNumber = NUMBERS.some((char) => str.includes(char));

  if (!hasNumber) {
    return false;
  }

  const hasLower = LOWERCASE.some((char) => str.includes(char));
  const hasUpper = UPPERCASE.some((char) => str.includes(char));
  const hasSpecial = SPECIAL.some((char) => str.includes(char));

  // If the string doesn't have at least 2 different charsets, it's not a secret
  // (together with the number charset)
  if (!hasLower && !hasUpper && !hasSpecial) {
    return false;
  }

  // If the string has less than 80% unique characters, it's not a secret
  const unique = new Set(str);
  if (unique.size / str.length < 0.8) {
    return false;
  }

  // If the string has white space, it's not a secret
  if (WHITE_SPACE.test(str)) {
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
