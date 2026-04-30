import { envToBool } from "./envToBool";
import { isAikidoCI } from "./isAikidoCI";
import { isDebugging } from "./isDebugging";
import { shouldBlock } from "./shouldBlock";
import { shouldInstrument } from "./shouldInstrument";

/**
 * Only enable firewall if at least one of the following environment variables is set to a valid value:
 * - AIKIDO_BLOCKING
 * - AIKIDO_BLOCK
 * - AIKIDO_TOKEN
 * - AIKIDO_DEBUG
 * - AIKIDO_INSTRUMENT
 */
export default function shouldEnableFirewall() {
  if (envToBool(process.env.AIKIDO_DISABLE)) {
    return false;
  }

  if (shouldInstrument()) {
    return true;
  }

  if (shouldBlock()) {
    return true;
  }

  if (process.env.AIKIDO_TOKEN) {
    return true;
  }

  if (isDebugging()) {
    return true;
  }

  if (!isAikidoCI()) {
    // oxlint-disable-next-line no-console
    console.log(
      "AIKIDO: Zen is disabled. Configure one of the following environment variables to enable it: AIKIDO_BLOCK, AIKIDO_TOKEN, AIKIDO_DEBUG, AIKIDO_INSTRUMENT."
    );
  }
  return false;
}
