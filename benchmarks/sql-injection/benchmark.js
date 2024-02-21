/**
 * Runs benchmarks for the detection of SQL Injections
 * @module
 */
const fs = require("fs");
const path = require("path");
const {
  queryContainsUserInput,
} = require("../../library/dist/vulnerabilities/sql-injection/detectSQLInjection");

const MAX_TIME_LIMIT = 0.05; // milliseconds / statement

function main() {
  const avgTime = getAvgBenchmark();
  if (avgTime > MAX_TIME_LIMIT) {
    console.error(
      `Average time it took for queryContainsUserInput() : ${avgTime}ms, this exceeds the allowed time of ${MAX_TIME_LIMIT}ms!`
    );
    process.exit(1);
  } else {
    console.info(
      `Average time it took for queryContainsUserInput() : ${avgTime}ms`
    );
  }
}
main();

function runBenchmark(sql, input) {
  const startTime = performance.now();
  queryContainsUserInput(sql, input);
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

/**
 * This function collects the dangerous sql statements in testing/exploit
 * into a single array
 * @returns An array with dangerous SQL statements
 */
function fetchSqlStatements() {
  const auth_bypass_txt = fs.readFileSync(
    path.join(__dirname, "./../../library/testing/sql-injection-payloads/Auth_Bypass.txt"),
    "utf-8"
  );
  const postgres_txt = fs.readFileSync(
    path.join(__dirname, "./../../library/testing/sql-injection-payloads/postgres.txt"),
    "utf-8"
  );
  const mysql_txt = fs.readFileSync(
    path.join(__dirname, "./../../library/testing/sql-injection-payloads/mysql.txt"),
    "utf-8"
  );
  const mssql_and_db2_txt = fs.readFileSync(
    path.join(__dirname, "./../../library/testing/sql-injection-payloads/mssql_and_db2.txt"),
    "utf-8"
  );

  return [
    ...auth_bypass_txt.split(/\r?\n/),
    ...postgres_txt.split(/\r?\n/),
    ...mysql_txt.split(/\r?\n/),
    ...mssql_and_db2_txt.split(/\r?\n/),
  ];
}
