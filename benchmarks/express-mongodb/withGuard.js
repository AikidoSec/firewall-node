const { protect, preventPrototypePollution } = require("@aikidosec/guard");

protect();

require("./createApp")(4000).then(() => {
  preventPrototypePollution();
  console.log("Listening on port 4000");
  console.log("Secured with @aikidosec/guard!");
});
