const protect = require("@aikidosec/firewall/lambda");

const { someFunction } = require("./submodule");

require("@aikidosec/firewall/nopp");

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
