/**
 * Based on https://github.com/validatorjs/validator.js/blob/master/src/lib/isEmail.js
 * MIT License - Copyright (c) 2018 Chris O'Hara
 */

import isFQDNString from "./isFQDN";

const emailUserUtf8Part =
  /^[a-z\d!#\$%&'\*\+\-\/=\?\^_`{\|}~\u00A1-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+$/i;
const quotedEmailUserUtf8 =
  /^([\s\x01-\x08\x0b\x0c\x0e-\x1f\x7f\x21\x23-\x5b\x5d-\x7e\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]|(\\[\x01-\x09\x0b\x0c\x0d-\x7f\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))*$/i;

export default function isEmailString(str: string): boolean {
  if (str.length > 100) {
    return false;
  }

  const parts = str.split("@");
  if (parts.length < 2) {
    return false;
  }

  const domain = parts.pop();
  if (!domain) {
    return false;
  }

  const user = parts.join("@");
  if (!user) {
    return false;
  }

  if (!isFQDNString(domain)) {
    return false;
  }

  if (user[0] === '"' && user[user.length - 1] === '"') {
    return quotedEmailUserUtf8.test(user.slice(1, user.length - 1));
  }

  const userParts = user.split(".");
  for (const part of userParts) {
    if (!emailUserUtf8Part.test(part)) {
      return false;
    }
  }

  return true;
}
