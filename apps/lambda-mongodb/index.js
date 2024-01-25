const { protectLambda, protect } = require("@aikidosec/rasp");

// TODO: How to avoid this and just have the wrapper function?
protect();

const { MongoClient } = require("mongodb");
const { Users, User } = require("./users");

exports.handler = protectLambda(async function (event, context) {
  async function getUsers() {
    // Normally you'd use environment variables for this
    const client = new MongoClient("mongodb://root:password@127.0.0.1:27017");
    await client.connect();

    return new Users(client);
  }

  const users = await getUsers();
  const user = await users.findBy("hans@aikido.dev", "password");

  if (!user) {
    // Ensure a user exists for testing
    await users.persist(new User("hans@aikido.dev", "password"));
  }

  if (!event.body || event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  const body = JSON.parse(event.body);

  if (!body.username || !body.password) {
    return {
      statusCode: 400,
      body: "Bad Request",
    };
  }

  // This is just for demo purposes, normally you'd use bcrypt or something
  // This is a vulnerability, which can be abused for demo purposes
  // If password is { $gt: "" } then it will match any password
  const actualUser = await users.findBy(body.username, body.password);

  if (!actualUser) {
    return {
      statusCode: 401,
      body: "Unauthorized",
    };
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      token: "123",
      success: true,
    }),
  };
});
