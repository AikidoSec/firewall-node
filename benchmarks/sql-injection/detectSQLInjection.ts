/**
 * Runs benchmarks for the detection of SQL Injections
 * @module
 */
const fs = require("fs");
const path = require("path");
const {
  detectSQLInjection,
} = require("../../library/src/vulnerabilities/detectSQLInjection");

function runBenchmark(sql:string, input:string) {
  const startTime = performance.now();
  detectSQLInjection(sql, input);
  const endTime = performance.now();
  return endTime - startTime;
}

/**
 * This function calculates the average time in ms / SQL Statement
 */
function getAvgBenchmark() {
    const sqlArray = fetchSqlStatements();
    let avgTime = 0;
    for (const sql of sqlArray) {
        avgTime += runBenchmark(sql, sql)
    }
    console.log(avgTime)
    avgTime = avgTime / sqlArray.length

  console.log(`Benchmark complete: ${avgTime}ms`);
}
getAvgBenchmark();
/**
 * This function collects the dangerous sql statements in testing/exploit
 * into a single array
 * @returns An array with dangerous SQL statements
 */
function fetchSqlStatements() {
  const auth_bypass_txt = fs.readFileSync(
    path.join(__dirname, "./../../library/testing/exploit/Auth_Bypass.txt"),
    "utf-8"
  );
  const postgres_txt = fs.readFileSync(
    path.join(__dirname, "./../../library/testing/exploit/postgres.txt"),
    "utf-8"
  );
  const mysql_txt = fs.readFileSync(
    path.join(__dirname, "./../../library/testing/exploit/mysql.txt"),
    "utf-8"
  );
  const mssql_and_db2_txt = fs.readFileSync(
    path.join(__dirname, "./../../library/testing/exploit/mssql_and_db2.txt"),
    "utf-8"
  );

  return [
    ...auth_bypass_txt.split(/\r?\n/),
    ...postgres_txt.split(/\r?\n/),
    ...mysql_txt.split(/\r?\n/),
    ...mssql_and_db2_txt.split(/\r?\n/),
  ];
}
