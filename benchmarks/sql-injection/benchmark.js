/**
 * Runs benchmarks for the detection of SQL Injections
 */
const fs = require("fs");
const { join } = require("path");
const {
  detectSQLInjection,
} = require("../../build/vulnerabilities/sql-injection/detectSQLInjection");
const {
  SQLDialectMySQL,
} = require("../../build/vulnerabilities/sql-injection/dialects/SQLDialectMySQL");
const {
  SQLDialectPostgres,
} = require("../../build/vulnerabilities/sql-injection/dialects/SQLDialectPostgres");
const {
  SQLDialectSQLite,
} = require("../../build/vulnerabilities/sql-injection/dialects/SQLDialectSQLite");

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

function runBenchmark(sql, input, dialect) {
  const startTime = performance.now();
  detectSQLInjection(sql, input, dialect);
  const endTime = performance.now();
  return endTime - startTime;
}

function randomEntry(array) {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * This function calculates the average time in ms / SQL Statement
 * @returns average time in milliseconds
 */
function getAvgBenchmark() {
  const sqlQueries = getSQLQueries();
  const userInputStrings = getUserInputStrings();
  const dialects = {
    mysql: new SQLDialectMySQL(),
    postgres: new SQLDialectPostgres(),
    sqlite: new SQLDialectSQLite(),
  };
  let avgTime = 0;
  let amount = 1000;
  for (let i = 0; i < amount; i++) {
    const sql = randomEntry(sqlQueries);
    const input = randomEntry(userInputStrings);
    const dialect = randomEntry(Object.values(dialects));
    avgTime += runBenchmark(sql, input, dialect);
  }
  console.log(avgTime);
  avgTime = avgTime / amount;

  return avgTime;
}

function getUserInputStrings() {
  return [
    "1",
    "1,2,3",
    "abc",
    "host",
    "localhost:4000",
    "connection",
    "keep-alive",
    "sec-ch-ua",
    '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
    "sec-ch-ua-mobile",
    "?0",
    "sec-ch-ua-platform",
    '"macOS"',
    "upgrade-insecure-requests",
    "user-agent",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "accept",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    "sec-fetch-site",
    "same-origin",
    "sec-fetch-mode",
    "navigate",
    "sec-fetch-user",
    "?1",
    "sec-fetch-dest",
    "document",
    "referer",
    "http://localhost:4000/",
    "accept-encoding",
    "gzip, deflate, br, zstd",
    "accept-language",
    "nl,en;q=0.9,en-US;q=0.8",
    "cookie",
    "this is a long long text",
    "' OR 1=1 -- ",
    "views.id",
    "users",
    "187 AND SLEEP(5)",
    "created_at desc",
    "name ASC",
    "DO UPDATE",
    "DO NOTHING",
    "ON DUPLICATE KEY UPDATE",
    "GROUP BY",
    "users",
    "recommendations",
    "COUNT(*)",
    "recommendation_click_events",
    "recommendation_id",
    "count__clicks",
    "user@example.com",
    "SELECT",
    "users.id = orders.user_id",
    "shipped_at IS NULL",
    "INSERT INTO wishlists",
    "wishlists",
    "views.business_id = ?",
  ];
}

function getSQLQueries() {
  return [
    "SELECT * FROM products WHERE id IN (1,2,3)",
    "SELECT * FROM products WHERE id IN (1)",
    "SELECT * FROM users WHERE id = '' OR 1=1 -- '",
    "SELECT * FROM users WHERE id = 187 AND SLEEP(5)",
    "SELECT * FROM users WHERE username = ? AND password = ?",
    `
      SELECT views.id AS view_id, view_settings.user_id, view_settings.settings
            FROM views
            INNER JOIN view_settings ON views.id = view_settings.view_id AND view_settings.user_id = ?
            WHERE views.business_id = ?
    `,
    "select `recommendations`.*, (select count(*) from `recommendation_click_events` where `recommendation_click_events`.`recommendation_id` = recommendations.id) as `count__clicks`, (select count(*) from `recommendation_subscribe_events` where `recommendation_subscribe_events`.`recommendation_id` = recommendations.id) as `count__subscribers` from `recommendations` order by created_at desc limit ?",
    "SELECT * FROM users ORDER BY name ASC",
    `
      SELECT DISTINCT ON (email) email, first_name, last_name
      FROM users
      ORDER BY email, created_at DESC
    `,
    "SELECT * FROM users WHERE NOT EXISTS (SELECT 1 FROM orders WHERE users.id = orders.user_id)",
    "SELECT * FROM orders WHERE shipped_at IS NULL",
    "INSERT INTO wishlists (user_id, product_id) VALUES (1, 3) ON CONFLICT (user_id, product_id) DO NOTHING",
    "INSERT INTO wishlists (user_id, product_id) VALUES (1, 3) ON DUPLICATE KEY UPDATE user_id = 1",
    `
      INSERT INTO users (id, email, login_count)
      VALUES (1, 'user@example.com', 1)
      ON CONFLICT (id)
      DO UPDATE SET login_count = users.login_count + 1
    `,
    `
      SELECT category_id, COUNT(*) AS total_products
      FROM products
      GROUP BY category_id
    `,
    `
      SELECT orders.order_id, users.first_name, users.last_name
      FROM orders
      RIGHT OUTER JOIN users ON orders.user_id = users.id
    `,
  ];
}
