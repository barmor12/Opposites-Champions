import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { buildPinoHttpOptions } from './common/logging';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ContentModule } from './content/content.module';
import { HealthModule } from './health/health.module';
import { HttpThrottlerGuard } from './common/http-throttler.guard';
import { GameFeatureModule } from './games/game-feature.module';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          transport: config.isProd ? undefined : { target: 'pino-pretty', options: { colorize: true, singleLine: true, translateTime: 'HH:MM:ss' } },
          redact: {
            paths: ['req.headers.cookie', 'req.headers.authorization', 'req.headers["x-player-token"]', 'res.headers["set-cookie"]', 'req.body.password'],
            censor: '[redacted]',
          },
          // Minimal serializers – no IPs, headers or bodies (no PII).
          serializers: {
            req: (req: IncomingMessage & { id?: unknown }) => ({ id: req.id, method: req.method, url: req.url }),
            res: (res: { statusCode?: number }) => ({ statusCode: res.statusCode }),
          },
          autoLogging: { ignore: (req: IncomingMessage) => req.url === '/api/health' },
          customProps: () => ({ app: 'oc-server' }),
        },
      }),
    }),
    ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }] }),
    AuthModule,
    ContentModule,
    HealthModule,
    GameFeatureModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: HttpThrottlerGuard }],
})
export class AppModule {}
