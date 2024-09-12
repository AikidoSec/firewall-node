const protect = require("@aikidosec/zen/cloud-function");

const { MongoClient } = require("mongodb");
const { Users, User } = require("./users");

require("@aikidosec/zen/nopp");

exports.getToken = protect(async (req, res) => {
  const client = new MongoClient("mongodb://root:password@127.0.0.1:27017");
  await client.connect();
  const users = new Users(client);
  const user = await users.findBy("hans@aikido.dev", "password");

  if (!user) {
    // Ensure a user exists for testing
    await users.persist(new User("hans@aikido.dev", "password"));
  }

  if (!req.body.username || !req.body.password) {
    return res.sendStatus(400);
  }

  // This is just for demo purposes, normally you'd use bcrypt or something
  // This is a vulnerability, which can be abused for demo purposes
  // If password is { $gt: "" } then it will match any password
  const actualUser = await users.findBy(req.body.username, req.body.password);

  if (!actualUser) {
    return res.sendStatus(401);
  }

  return res.send({
    token: "123",
    success: true,
  });
});
