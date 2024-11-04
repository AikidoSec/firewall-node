const waitOn = require("wait-on");

module.exports = function (port) {
  return waitOn({
    resources: ["tcp:localhost:" + port],
    log: true,
  });
};
