require("@aikidosec/firewall");

const express = require("express");
const { Client } = require("pg");
const http = require("http");
const io = require("socket.io");

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

  const ioServer = io(server);

  ioServer.on("connection", (ws) => {
    // Send chat history to the new client
    db.query(
      "SELECT content, timestamp FROM messages ORDER BY timestamp",
      (err, res) => {
        if (!err) {
          res.rows.forEach((row) => {
            const time = new Date(row.timestamp).toLocaleTimeString();
            ws.emit("message", `[${time}] ${row.content}`);
          });
        }
      }
    );

    // Handle incoming messages
    ws.on("sendMessage", (message) => {
      try {
        const time = new Date().toLocaleTimeString();
        // Broadcast message to all clients
        ioServer.emit("message", `[${time}] ${message}`);
        // Insert message into the database
        db.query(
          `INSERT INTO messages (content) VALUES ('${message}') RETURNING *`,
          (err, res) => {
            if (err) {
              ws.send("An error occurred");
            }
          }
        );
      } catch (err) {
        console.error(err);
        ws.send("An error occurred");
      }
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

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

main(getPort());
