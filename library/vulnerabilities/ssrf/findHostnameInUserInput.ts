import { getPortFromURL } from "../../helpers/getPortFromURL";
import { tryParseURL } from "../../helpers/tryParseURL";
import { Hostname } from "./Hostname";

export function findHostnameInUserInput(
  userInput: string,
  hostnameURL: Hostname,
  port?: number
): boolean {
  if (userInput.length <= 1) {
    return false;
  }

  const variants = [userInput, `http://${userInput}`, `https://${userInput}`];
  for (const variant of variants) {
    const userInputURL = tryParseURL(variant);
    if (userInputURL && userInputURL.hostname === hostnameURL.asString()) {
      const userPort = getPortFromURL(userInputURL);

      if (!port) {
        return true;
      }

      if (port && userPort === port) {
        return true;
      }
    }
  }

  return false;
}
