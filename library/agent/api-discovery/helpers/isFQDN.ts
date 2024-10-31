/**
 * Based on https://github.com/validatorjs/validator.js/blob/master/src/lib/isFQDN.js
 * MIT License - Copyright (c) 2018 Chris O'Hara
 */

export default function isFQDNString(str: string): boolean {
  const parts = str.split(".");

  if (parts.length < 2) {
    return false;
  }

  const tld = parts[parts.length - 1];

  if (
    !/^([a-z\u00A1-\u00A8\u00AA-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]{2,}|xn[a-z0-9-]{2,})$/i.test(
      tld
    )
  ) {
    return false;
  }

  return parts.every((part) => {
    if (part.length > 63) {
      return false;
    }

    if (!/^[a-z_\u00a1-\uffff0-9-]+$/i.test(part)) {
      return false;
    }

    // disallow full-width chars
    if (/[\uff01-\uff5e]/.test(part)) {
      return false;
    }

    // disallow parts starting or ending with hyphen
    if (/^-|-$/.test(part)) {
      return false;
    }

    return true;
  });
}
