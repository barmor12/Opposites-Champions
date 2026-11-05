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
      useFactory: (config: AppConfigService) => ({ pinoHttp: buildPinoHttpOptions(config) }),
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
