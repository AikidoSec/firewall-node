import Zen from "@aikidosec/firewall";
import express from "express";
import morgan from "morgan";

async function main(port: number) {
  const app = express();

  app.use(morgan("tiny"));
  app.use(express.json());

  Zen.addExpressMiddleware(app);

  app.get("/", (_, res) => {
    res.send("Hello World!");
  });

  return new Promise<void>((resolve, reject) => {
    try {
      app.listen(port, () => {
        console.log(`Listening on port ${port}`);
        resolve();
      });
    } catch (err) {
      reject(err);
    }
  });
}

function getPort() {
  const port = parseInt(process.argv[2], 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

main(getPort());
