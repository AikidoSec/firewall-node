import { shouldBlockInvalidSqlQueries } from "./shouldBlockInvalidSqlQueries";

export function warnIfBlockInvalidSqlDisabled() {
  if (shouldBlockInvalidSqlQueries()) {
    return;
  }

  // oxlint-disable-next-line no-console
  console.log(
    "AIKIDO: We recommend setting AIKIDO_BLOCK_INVALID_SQL=true. See https://github.com/AikidoSec/firewall-node/blob/main/docs/invalid-sql-queries.md"
  );
}
