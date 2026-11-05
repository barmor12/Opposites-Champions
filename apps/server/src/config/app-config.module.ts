import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service';
import { loadAppConfig } from './app-config';

/** Loads .env (via @nestjs/config) and exposes the validated AppConfigService globally. */
@Global()
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, cache: true })],
  providers: [{ provide: AppConfigService, useFactory: (): AppConfigService => new AppConfigService(loadAppConfig(process.env)) }],
  exports: [AppConfigService],
})
export class AppConfigModule {}
