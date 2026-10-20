import "@aikidosec/firewall";

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ZenGuard } from "./zen.guard";
import "@aikidosec/firewall/nopp";
import { UserGuard } from "./user.guard";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter()
  );

  app.useGlobalGuards(new UserGuard());
  app.useGlobalGuards(new ZenGuard());

  await app.listen({
    port: getPort(),
  });
}
bootstrap();

function getPort() {
  const port = parseInt(process.env.PORT, 10) || 4000;

  if (isNaN(port)) {
    console.error("Invalid port");
    process.exit(1);
  }

  return port;
}
