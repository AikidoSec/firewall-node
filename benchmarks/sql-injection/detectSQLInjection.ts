/**
 * Runs benchmarks for the detection of SQL Injections
 * @module
 */
const fs = require('fs');
const { detectSQLInjection } = require("../../library/src/vulnerabilities/detectSQLInjection");

const SQL_STATEMENT = "TEST";
const USER_INPUT = "T";
const MAX_TIME = 0.3; // In milliseconds

function runBenchmark() {
    const startTime = performance.now();
    const bool = detectSQLInjection(SQL_STATEMENT, USER_INPUT);
    const endTime = performance.now();
    return endTime - startTime;
}

function getAvgBenchmark() {
    let avgTime = 0;
    for (let i = 0; i < 25; i++) {
        console.log(`Run : ${i + 1} - detectSQLInjection()`);
        avgTime += runBenchmark();
    }
    avgTime = avgTime / 10;

    console.log(`Benchmark complete: ${avgTime}ms`)
}

getAvgBenchmark()