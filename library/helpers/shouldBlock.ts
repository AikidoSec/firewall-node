import { envToBool } from "./envToBool";

/**
 * Check the environment variables to see if the firewall should block requests if an attack is detected.
 * - AIKIDO_BLOCKING=true or AIKIDO_BLOCKING=1
 * - AIKIDO_BLOCK=true or AIKIDO_BLOCK=1
 */
export function shouldBlock() {
  return (
    envToBool(process.env.AIKIDO_BLOCKING) ||
    envToBool(process.env.AIKIDO_BLOCK)
  );
}
