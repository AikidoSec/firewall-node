const measure = require("./measure");
const getUser = require("./getUser");
const getClient = require("./getClient");

async function main() {
  const client = await getClient();
  const averageTimeInMS = await measure(async () => {
    await getUser(client, {
      email: "email",
      password: "password",
    });
  });

  await client.close();

  return averageTimeInMS;
}

main().then(
  (averageTimeInMS) => {
    console.log(JSON.stringify({ averageTimeInMS }));
  },
  (error) => {
    console.error(error);
  }
);
