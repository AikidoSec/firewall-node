/**
 * Runs benchmarks for the detection of SQL Injections
 */
const fs = require("fs");
const { join } = require("path");
const {
  detectSQLInjection,
} = require("../../library/build/vulnerabilities/sql-injection/detectSQLInjection");
const {
  SQLDialectMySQL,
} = require("../../library/build/vulnerabilities/sql-injection/dialects/SQLDialectMySQL");

const MAX_TIME_LIMIT = 0.05; // milliseconds / statement

function main() {
  const avgTime = getAvgBenchmark();
  if (avgTime > MAX_TIME_LIMIT) {
    console.error(
      `Average time it took for detectSQLInjection() : ${avgTime}ms, this exceeds the allowed time of ${MAX_TIME_LIMIT}ms!`
    );
    process.exit(1);
  } else {
    console.info(
      `Average time it took for detectSQLInjection() : ${avgTime}ms`
    );
  }
}

main();

function runBenchmark(sql, input) {
  const startTime = performance.now();
  detectSQLInjection(sql, input, new SQLDialectMySQL());
  const endTime = performance.now();
  return endTime - startTime;
}

/**
 * This function calculates the average time in ms / SQL Statement
 * @returns average time in milliseconds
 */
function getAvgBenchmark() {
  const sqlArray = fetchSqlStatements();
  let avgTime = 0;
  for (const sql of sqlArray) {
    avgTime += runBenchmark(sql, sql);
  }
  console.log(avgTime);
  avgTime = avgTime / sqlArray.length;

  return avgTime;
}

function fetchSqlStatements() {
  const files = [
    join(
      __dirname,
      "../../library/vulnerabilities/sql-injection/payloads",
      "Auth_Bypass.txt"
    ),
    join(
      __dirname,
      "../../library/vulnerabilities/sql-injection/payloads",
      "postgres.txt"
    ),
    join(
      __dirname,
      "../../library/vulnerabilities/sql-injection/payloads",
      "mysql.txt"
    ),
    join(
      __dirname,
      "../../library/vulnerabilities/sql-injection/payloads",
      "mssql_and_db2.txt"
    ),
  ];

  return files
    .map((file) => fs.readFileSync(file, "utf-8").split(/\r?\n/))
    .flat();
}
