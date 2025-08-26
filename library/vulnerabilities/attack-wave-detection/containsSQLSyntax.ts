import type { Context } from "../../agent/Context";
import { extractStringsFromUserInputCached } from "../../helpers/extractStringsFromUserInputCached";

// Match spaces, tabs inline comments like /* test */ and +
const sqlSpace = "(\\s|\\/\\*.*\\*\\/|\\+)";

const forbiddenKeywords = [
  "@@innodb_version",
  "xp_cmdshell",
  "innodb_table_stats",
  "pg_client_encoding",
  "pg_shadow",
  "pg_group",
  "sleep\\(.*\\)",
].join("|");

const builtinDbTables = [
  "mysql\\.\\w{4,53}",
  "information_schema\\.\\w{4,38}",
].join("|");

const queries = [
  `select${sqlSpace}\\*${sqlSpace}from`,
  `union${sqlSpace}(all${sqlSpace})?select`,
  `insert${sqlSpace}into${sqlSpace}\\w+${sqlSpace}\\(`,
  `create${sqlSpace}user${sqlSpace}\\w+${sqlSpace}identified${sqlSpace}by`,
  `backup${sqlSpace}database${sqlSpace}\\w+${sqlSpace}to`,
  `update${sqlSpace}\\w+${sqlSpace}set${sqlSpace}\\w+${sqlSpace}?=`,
  `drop${sqlSpace}table${sqlSpace}\\w+`,
  `truncate${sqlSpace}table${sqlSpace}\\w+`,
  `delete${sqlSpace}from${sqlSpace}\\w+`,
].join("|");

const queryParts = [
  `(or|and|where|having|&{2}|\\|{2})${sqlSpace}\\w+${sqlSpace}?(=|<)\\w`,
  `("|')${sqlSpace}?(or|and|where|having|&{2}|\\|{2}|<|=)${sqlSpace}?("|')`,
].join("|");

const sqlPathRegex = new RegExp(
  `(${forbiddenKeywords}|${queries}|${builtinDbTables}|${queryParts})`,
  "i"
);

export function containsSQLSyntax(context: Context): boolean {
  if (context.query) {
    const queryStrings = extractStringsFromUserInputCached(context, "query");
    if (queryStrings) {
      for (const str of queryStrings) {
        if (sqlPathRegex.test(str)) {
          return true;
        }
      }
    }
  }

  if (context.route) {
    if (sqlPathRegex.test(context.route)) {
      return true;
    }
  }

  return false;
}
