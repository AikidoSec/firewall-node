require("@aikidosec/firewall");

const createApp = require("./app");

const app = createApp();

const port = process.env.PORT || 3000;
app.listen(port, function () {
  console.log("Server started on port", port);
});
