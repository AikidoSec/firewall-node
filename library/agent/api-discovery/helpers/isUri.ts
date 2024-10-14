import { tryParseURL } from "../../../helpers/tryParseURL";

export default function isUriString(str: string): boolean {
  if (str.length > 2084) {
    return false;
  }

  const url = tryParseURL(str);

  if (!url) {
    return false;
  }
  if (!url.hostname) {
    return false;
  }

  return true;
}
