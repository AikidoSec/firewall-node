require("dotenv").config();
const { protect, preventPrototypePollution } = require("@aikidosec/guard");

protect({ debug: true });



function getPort() {
    const port = parseInt(process.argv[2], 10) || 4000;
  
    if (isNaN(port)) {
      console.error("Invalid port");
      process.exit(1);
    }
  
    return port;
  }
  
main(getPort());  