const { protect } = require("@aikidosec/guard");

protect();

require("./createApp")(4000).then(() => {
  console.log("Listening on port 4000");
  console.log("Secured with @aikidosec/guard!");
});
