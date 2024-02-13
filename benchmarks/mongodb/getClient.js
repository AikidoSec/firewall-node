const { MongoClient } = require("mongodb");

module.exports = async function getClient() {
  const url = "mongodb://root:password@127.0.0.1:27017";
  const client = new MongoClient(url);
  await client.connect();

  return client;
};
