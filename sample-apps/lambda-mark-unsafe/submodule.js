const { markUnsafe } = require("@aikidosec/firewall");

function someFunction() {
  markUnsafe("abc");
}

module.exports = {
  someFunction,
};
