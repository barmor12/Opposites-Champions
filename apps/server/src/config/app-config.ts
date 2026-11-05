import { Logger } from '@nestjs/common';

export interface TeacherInitialConfig {
  email: string;
  password: string;
  name: string;
}

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  appUrl: string;
  apiUrl: string;
  databaseUrl: string;
  jwtSecret: string;
  cookieSecret: string;
  corsOrigins: string[];
  teacherInitial: TeacherInitialConfig;
  logLevel: string;
  isProd: boolean;
  /**
   * Number of reverse-proxy hops to trust for X-Forwarded-* (express `trust proxy`).
   * 0 = none (direct exposure / local dev). Default: 1 in production (nginx), 0 otherwise.
   * Wrong values let clients spoof their IP (rate limiting) – keep it equal to the real proxy depth.
   */
  trustProxyHops: number;
}

const MIN_SECRET_LENGTH = 32;
const MAX_TRUST_PROXY_HOPS = 10;
const DEV_DEFAULTS = {
  databaseUrl: 'postgresql://opposites:opposites@localhost:5432/opposites?schema=public',
  jwtSecret: 'dev-only-jwt-secret-do-not-use-in-production-0000',
  cookieSecret: 'dev-only-cookie-secret-do-not-use-in-production-0',
  appUrl: 'http://localhost:5173',
  apiUrl: 'http://localhost:3000/api',
  corsOrigins: 'http://localhost:5173',
  teacherEmail: 'teacher@example.com',
  teacherPassword: 'change-me-teacher-password',
  teacherName: 'המורה',
} as const;

export class ConfigValidationError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration:\n - ${problems.join('\n - ')}`);
    this.name = 'ConfigValidationError';
  }
}

type Env = Record<string, string | undefined>;

function readString(env: Env, key: string): string | undefined {
  const raw = env[key];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Builds and validates the typed app config from an env map.
 * Production: fails fast on missing/weak secrets. Development/test: safe defaults with a warning.
 */
export function loadAppConfig(env: Env, logger: Pick<Logger, 'warn'> = new Logger('AppConfig')): AppConfig {
  const problems: string[] = [];
  const warnings: string[] = [];

  const nodeEnvRaw = readString(env, 'NODE_ENV') ?? 'development';
  const nodeEnv: AppConfig['nodeEnv'] =
    nodeEnvRaw === 'production' ? 'production' : nodeEnvRaw === 'test' ? 'test' : 'development';
  const isProd = nodeEnv === 'production';

  const requireOrDefault = (key: string, fallback: string, opts: { secret?: boolean } = {}): string => {
    const value = readString(env, key);
    if (value !== undefined) {
      if (opts.secret && value.length < MIN_SECRET_LENGTH) {
        const msg = `${key} must be at least ${MIN_SECRET_LENGTH} characters`;
        if (isProd) problems.push(msg);
        else warnings.push(`${msg} (development only – continuing)`);
      }
      if (opts.secret && isProd && value.startsWith('change-me')) problems.push(`${key} still has the placeholder value`);
      return value;
    }
    if (isProd) {
      problems.push(`${key} is required in production`);
      return '';
    }
    warnings.push(`${key} is not set – using development default`);
    return fallback;
  };

  const portRaw = readString(env, 'PORT') ?? '3000';
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) problems.push(`PORT must be a valid port number (got "${portRaw}")`);

  const appUrl = requireOrDefault('APP_URL', DEV_DEFAULTS.appUrl);
  const apiUrl = requireOrDefault('API_URL', DEV_DEFAULTS.apiUrl);
  if (appUrl && !isHttpUrl(appUrl)) problems.push('APP_URL must be an http(s) URL');
  if (apiUrl && !isHttpUrl(apiUrl)) problems.push('API_URL must be an http(s) URL');

  const databaseUrl = requireOrDefault('DATABASE_URL', DEV_DEFAULTS.databaseUrl);
  if (databaseUrl && !/^postgres(ql)?:\/\//.test(databaseUrl)) problems.push('DATABASE_URL must be a postgresql:// URL');

  const jwtSecret = requireOrDefault('JWT_SECRET', DEV_DEFAULTS.jwtSecret, { secret: true });
  const cookieSecret = requireOrDefault('COOKIE_SECRET', DEV_DEFAULTS.cookieSecret, { secret: true });

  const corsRaw = requireOrDefault('CORS_ORIGINS', DEV_DEFAULTS.corsOrigins);
  const corsOrigins = parseOrigins(corsRaw);
  if (corsOrigins.length === 0) problems.push('CORS_ORIGINS must list at least one origin');
  for (const origin of corsOrigins) {
    if (!isHttpUrl(origin)) problems.push(`CORS_ORIGINS contains an invalid origin: "${origin}"`);
  }

  const teacherInitial: TeacherInitialConfig = {
    email: (readString(env, 'TEACHER_INITIAL_EMAIL') ?? DEV_DEFAULTS.teacherEmail).toLowerCase(),
    password: readString(env, 'TEACHER_INITIAL_PASSWORD') ?? DEV_DEFAULTS.teacherPassword,
    name: readString(env, 'TEACHER_INITIAL_NAME') ?? DEV_DEFAULTS.teacherName,
  };
  if (isProd && teacherInitial.password.startsWith('change-me')) {
    warnings.push('TEACHER_INITIAL_PASSWORD still has the placeholder value – change it before seeding');
  }

  const logLevel = readString(env, 'LOG_LEVEL') ?? (isProd ? 'info' : 'debug');

  const trustProxyRaw = readString(env, 'TRUST_PROXY');
  let trustProxyHops = isProd ? 1 : 0;
  if (trustProxyRaw !== undefined) {
    const parsed = Number.parseInt(trustProxyRaw, 10);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_TRUST_PROXY_HOPS) {
      problems.push(`TRUST_PROXY must be an integer between 0 and ${MAX_TRUST_PROXY_HOPS} (got "${trustProxyRaw}")`);
    } else {
      trustProxyHops = parsed;
    }
  }

  if (problems.length > 0) throw new ConfigValidationError(problems);
  for (const w of warnings) logger.warn(w);

  return {
    nodeEnv,
    port,
    appUrl,
    apiUrl,
    databaseUrl,
    jwtSecret,
    cookieSecret,
    corsOrigins,
    teacherInitial,
    logLevel,
    isProd,
    trustProxyHops,
  };
}
