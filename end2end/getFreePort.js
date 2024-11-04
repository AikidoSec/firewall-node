const { randomInt } = require("crypto");
const used = [];

module.exports = function getFreePort(t) {
  const port = randomInt(3000, 10000) + t.childId;

  if (used.includes(port)) {
    return getFreePort(t);
  }

  used.push(port);

  return port;
};
