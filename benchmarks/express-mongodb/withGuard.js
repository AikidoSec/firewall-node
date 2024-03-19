const { protect } = require("@aikidosec/runtime");

protect();

require("./createApp")(4000).then(() => {
  console.log("Listening on port 4000");
  console.log("Secured with @aikidosec/runtime!");
});
