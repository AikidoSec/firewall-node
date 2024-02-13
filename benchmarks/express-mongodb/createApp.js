const express = require("express");
const asyncHandler = require("express-async-handler");
const { MongoClient } = require("mongodb");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

module.exports = async function (port) {
  const url = "mongodb://root:password@127.0.0.1:27017";
  const client = new MongoClient(url);
  await client.connect();

  const app = express();

  app.use(morgan("tiny"));
  app.use(cookieParser());
  app.use(express.json());

  app.post(
    "/login",
    asyncHandler(async (req, res) => {
      if (!req.body || !req.body.email || !req.body.password) {
        res.status(400).send({
          error: true,
          message: "Missing body",
        });
        return;
      }

      // Normally you would store a hash of passwords
      // Using e.g. bcrypt and compare them in constant time
      // We don't want to measure the hashing in our benchmark
      const user = await client
        .db("bench")
        .collection("users")
        .findOne({
          email: String(req.body.email),
          password: String(req.body.password),
        });

      if (!user) {
        res.send({
          error: true,
          message: "Invalid credentials",
        });
        return;
      }

      res.send({
        user: {
          id: user.id,
          email: user.email,
        },
        token: "123",
      });
    })
  );

  return new Promise((resolve, reject) => {
    try {
      const server = app.listen(port, () => {
        resolve(server);
      });
    } catch (err) {
      reject(err);
    }
  });
};
