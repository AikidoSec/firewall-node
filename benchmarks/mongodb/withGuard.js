require("@aikidosec/guard").protect();

const measure = require("./measure");
const getUser = require("./getUser");
const getClient = require("./getClient");
const { runWithContext } = require("@aikidosec/guard");

async function main() {
  const client = await getClient();
  const averageTimeInMS = await measure(async () => {
    await runWithContext(
      { body: { email: "email", password: "password" } },
      async () => {
        await getUser(client, {
          email: "email",
          password: "password",
        });
      }
    );
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
