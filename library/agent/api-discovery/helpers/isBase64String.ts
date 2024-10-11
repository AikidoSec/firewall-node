const notBase64 = /[^A-Z0-9+\/=]/i;

/**
 * Checks if the string is a base64 string
 * Based on https://github.com/validatorjs/validator.js/blob/master/src/lib/isBase64.js - MIT License - Copyright (c) 2018 Chris O'Hara
 */
export default function isBase64String(str: string) {
  if (!str) {
    return false;
  }

  if (str.length % 4 !== 0 || notBase64.test(str)) {
    return false;
  }

  const firstPaddingChar = str.indexOf("=");

  if (firstPaddingChar === -1 || firstPaddingChar === str.length - 1) {
    return true;
  }

  return firstPaddingChar === str.length - 2 && str[str.length - 1] === "=";
}
