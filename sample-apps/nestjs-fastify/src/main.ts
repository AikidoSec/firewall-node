import '@aikidosec/firewall';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  await app.listen({
    port: getPort(),
  });
}
bootstrap();

function getPort() {
  const port = parseInt(process.env.PORT, 10) || 4000;

  if (isNaN(port)) {
    console.error('Invalid port');
    process.exit(1);
  }

  return port;
}
