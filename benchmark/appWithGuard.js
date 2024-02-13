require("dotenv").config();
const { protect, preventPrototypePollution } = require("@aikidosec/guard");

protect();

require("./createApp")(4001).then(() => {
  preventPrototypePollution();
  console.log("Listening on port 4001");
  console.log("Secured with @aikidosec/guard!");
});

// 6535/7360
