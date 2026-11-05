import { Injectable } from '@nestjs/common';
import { type AppConfig, loadAppConfig, type TeacherInitialConfig } from './app-config';

/** Typed, validated configuration – single source of truth for env access. */
@Injectable()
export class AppConfigService implements AppConfig {
  readonly nodeEnv: AppConfig['nodeEnv'];
  readonly port: number;
  readonly appUrl: string;
  readonly apiUrl: string;
  readonly databaseUrl: string;
  readonly jwtSecret: string;
  readonly cookieSecret: string;
  readonly corsOrigins: string[];
  readonly teacherInitial: TeacherInitialConfig;
  readonly logLevel: string;
  readonly isProd: boolean;
  readonly trustProxyHops: number;

  constructor(config: AppConfig = loadAppConfig(process.env)) {
    this.nodeEnv = config.nodeEnv;
    this.port = config.port;
    this.appUrl = config.appUrl;
    this.apiUrl = config.apiUrl;
    this.databaseUrl = config.databaseUrl;
    this.jwtSecret = config.jwtSecret;
    this.cookieSecret = config.cookieSecret;
    this.corsOrigins = [...config.corsOrigins];
    this.teacherInitial = { ...config.teacherInitial };
    this.logLevel = config.logLevel;
    this.isProd = config.isProd;
    this.trustProxyHops = config.trustProxyHops;
  }
}
