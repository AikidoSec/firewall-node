const protect = require("@aikidosec/firewall/lambda");

require("@aikidosec/firewall/nopp");
const { someFunction } = require("./submodule");

async function main(client, event) {
  someFunction();
}

exports.handler = protect(async function (event, context) {
  try {
    return await main(event, context);
  } catch (e) {
    console.error(e);
  }
});
