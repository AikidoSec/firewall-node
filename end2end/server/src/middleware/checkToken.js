const { getByToken } = require("../zen/apps");

module.exports = function checkToken(req, res, next) {
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(401).json({
      message: "Token is required",
    });
  }

  const app = getByToken(token);

  if (!app) {
    return res.status(401).json({
      message: "Invalid token",
    });
  }

  req.app = app;

  next();
};
