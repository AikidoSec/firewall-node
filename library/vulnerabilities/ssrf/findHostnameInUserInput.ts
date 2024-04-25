import { tryParseURL } from "../../helpers/tryParseURL";

export function findHostnameInUserInput(
  userInput: string,
  hostname: string
): boolean {
  if (userInput.length <= 1) {
    return false;
  }

  const hostnameURL = tryParseURL(`http://${hostname}`);
  if (!hostnameURL) {
    return false;
  }

  const variants = [userInput, `http://${userInput}`];
  for (const variant of variants) {
    const userInputURL = tryParseURL(variant);
    if (userInputURL && userInputURL.hostname === hostnameURL.hostname) {
      return true;
    }
  }

  return false;
}
