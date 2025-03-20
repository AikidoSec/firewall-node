import "@aikidosec/firewall";
import * as Sentry from "@sentry/nestjs";

Sentry.init({
  dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
});

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ZenGuard } from "./zen.guard";

function getPort() {
  const port = parseInt(process.env.PORT, 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalGuards(new ZenGuard());
  await app.listen(getPort());
}

bootstrap();
