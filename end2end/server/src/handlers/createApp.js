const { createApp: create } = require("../zen/apps");

module.exports = function createApp(req, res) {
  const token = create();

  res.json({
    token: token,
  });
};
