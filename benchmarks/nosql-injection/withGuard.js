require("../../library/build");

const measure = require("./measure");
const getUser = require("./getUser");
const getClient = require("./getClient");
const { runWithContext } = require("../../library/build/agent/Context");

async function main() {
  const client = await getClient();
  const timings = await runWithContext(
    {
      body: {
        email: "email",
        password: "password",
      },
    },
    () => {
      return measure(async () => {
        await getUser(client, {
          email: "email",
          password: "password",
        });
      });
    }
  );

  await client.close();

  console.log(JSON.stringify(timings));
}

main();
