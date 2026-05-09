const Zen = require("@aikidosec/firewall");
const express = require("express");
const mysql = require("mysql");

if (process.env.IDOR_ENABLED === "true") {
  Zen.enableIdorProtection({
    tenantColumnName: "tenant_id",
    excludedTables: ["migrations"],
  });
}

function getPort() {
  const port = parseInt(process.env.PORT, 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

const connection = mysql.createConnection({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "mypassword",
  database: process.env.MYSQL_DATABASE || "catsdb",
  port: parseInt(process.env.MYSQL_PORT, 10) || 27015,
});

function query(sql, values) {
  return new Promise((resolve, reject) => {
    connection.query(sql, values, (error, results) => {
      if (error) {
        return reject(error);
      }
      resolve(results);
    });
  });
}

async function setup() {
  await query(`
    CREATE TABLE IF NOT EXISTS posts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255),
      tenant_id VARCHAR(255)
    )
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS comments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      post_id INT,
      body TEXT,
      tenant_id VARCHAR(255)
    )
  `);
  await query("DELETE FROM posts");
  await query("DELETE FROM comments");

  // Seed some data
  for (let i = 0; i < 10; i++) {
    await query("INSERT INTO posts (title, tenant_id) VALUES (?, ?)", [
      `Post ${i}`,
      "org_123",
    ]);
    await query(
      "INSERT INTO comments (post_id, body, tenant_id) VALUES (?, ?, ?)",
      [i + 1, `Comment on post ${i}`, "org_123"]
    );
  }
}

function start() {
  const app = express();

  if (process.env.IDOR_ENABLED === "true") {
    app.use((req, res, next) => {
      Zen.setTenantId("org_123");
      next();
    });
  }

  // Cached query: parameterized, always the same SQL string
  app.get("/posts", async (req, res) => {
    const rows = await query(
      "SELECT * FROM posts WHERE tenant_id = ? ORDER BY id LIMIT 10",
      ["org_123"]
    );
    res.json(rows);
  });

  // Cached query: parameterized with a join
  app.get("/posts-with-comments", async (req, res) => {
    const rows = await query(
      `SELECT p.*, c.body AS comment_body
       FROM posts p
       LEFT JOIN comments c ON p.id = c.post_id AND c.tenant_id = ?
       WHERE p.tenant_id = ?
       ORDER BY p.id LIMIT 10`,
      ["org_123", "org_123"]
    );
    res.json(rows);
  });

  // Unique query: inline integer ID that changes per request (cache miss)
  app.get("/posts/:id", async (req, res) => {
    const id = parseInt(req.params.id, 10) || 1;
    const rows = await query(
      `SELECT * FROM posts WHERE tenant_id = 'org_123' AND id = ${id}`
    );
    res.json(rows);
  });

  app.listen(getPort(), () => {
    console.log(`Server listening on port ${getPort()}`);
  });
}

setup()
  .then(() => start())
  .catch((err) => {
    console.error("Setup failed:", err);
    process.exit(1);
  });
