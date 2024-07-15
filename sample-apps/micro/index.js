const { send, json } = require("micro");
const { getContext } = require("@aikidosec/firewall/agent/Context");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return send(res, 405, {
      message: "Method Not Allowed",
    });
  }

  const body = await json(req);

  if (!body.url) {
    return send(res, 400, {
      message: "Missing URL in request body",
    });
  }

  const data = await (await fetch(body.url)).arrayBuffer();
  res.setHeader("Content-Type", "image/jpeg");
  res.statusCode = 200;
  res.end(Buffer.from(data));
};
