import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';
import { AppConfigService } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  // bodyParser: false → only the size-limited parsers from setupApp are registered.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true, bodyParser: false });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.flushLogs();

  const config = app.get(AppConfigService);
  setupApp(app, {
    corsOrigins: config.corsOrigins,
    cookieSecret: config.cookieSecret,
    isProd: config.isProd,
    trustProxyHops: config.trustProxyHops,
  });
  app.enableShutdownHooks();

  await app.listen(config.port, '0.0.0.0');
  logger.log(`אלופי ההפכים – השרת מאזין על פורט ${config.port} (${config.nodeEnv})`, 'Bootstrap');
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
