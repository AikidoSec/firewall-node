require("@aikidosec/firewall");

const express = require("express");
const { Client } = require("pg");
const http = require("http");
const WebSocket = require("ws");
const { getContext } = require("@aikidosec/firewall/agent/context");

require("@aikidosec/firewall/nopp");

async function createConnection() {
  const client = new Client({
    user: "root",
    host: "127.0.0.1",
    database: "main_db",
    password: "password",
    port: 27016,
  });

  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      content TEXT NOT NULL,
      timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Delete all messages
  await client.query("DELETE FROM messages");

  return client;
}

async function main(port) {
  const db = await createConnection();

  const app = express();
  const server = http.createServer(app);

  app.use(express.static(__dirname + "/public"));

  app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
  });

  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    // Send chat history to the new client
    db.query(
      "SELECT content, timestamp FROM messages ORDER BY timestamp",
      (err, res) => {
        if (!err) {
          res.rows.forEach((row) => {
            const time = new Date(row.timestamp).toLocaleTimeString();
            ws.send(`[${time}] ${row.content}`);
          });
        }
      }
    );

    // Handle incoming messages
    ws.on("message", (message) => {
      // Insert message into the database
      db.query(
        `INSERT INTO messages (content) VALUES ('${message}') RETURNING *`,
        (err, res) => {
          if (!err) {
            if (!res.rows) {
              return;
            }

            const time = new Date(res.rows[0].timestamp).toLocaleTimeString();
            const msg = `[${time}] ${res.rows[0].content}`;
            // Broadcast message to all clients
            wss.clients.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(msg);
              }
            });
          }
        }
      );
    });

    ws.send("Welcome to the chat!");
  });

  return new Promise((resolve, reject) => {
    try {
      server.listen(port, () => {
        console.log(`Listening on port ${port}`);
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

main(8090);
