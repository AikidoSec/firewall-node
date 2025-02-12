const { MongoClient } = require("mongodb");

const client = new MongoClient("mongodb://root:password@127.0.0.1:27017");

let users;

module.exports = {
  setup: async function setup() {
    await client.connect();
    const db = client.db("test");
    users = db.collection("users");
    await users.insertOne({ email: "john@acme.com", password: "password" });
  },
  step: async function step() {
    await users.find({ email: "john@acme.com", password: "password" });
  },
  teardown: async function teardown() {
    await client.close();
  },
};
