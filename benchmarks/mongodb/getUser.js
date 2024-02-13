module.exports = async function getUser(client, { email, password }) {
  return await client.db("bench").collection("users").findOne({
    email: email,
    password: password,
  });
};
