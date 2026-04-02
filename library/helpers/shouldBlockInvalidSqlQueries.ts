import { envToBool } from "./envToBool";

export function shouldBlockInvalidSqlQueries(): boolean {
  if (process.env.AIKIDO_BLOCK_INVALID_SQL === undefined) {
    return false;
  }

  return envToBool(process.env.AIKIDO_BLOCK_INVALID_SQL);
}
