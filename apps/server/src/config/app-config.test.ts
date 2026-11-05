import { describe, expect, it, vi } from 'vitest';
import { ConfigValidationError, loadAppConfig } from './app-config';

const STRONG = 'x'.repeat(40);
const PROD_ENV = {
  NODE_ENV: 'production',
  APP_URL: 'https://game.example.org',
  API_URL: 'https://game.example.org/api',
  DATABASE_URL: 'postgresql://u:p@db:5432/oc',
  JWT_SECRET: STRONG,
  COOKIE_SECRET: STRONG,
  CORS_ORIGINS: 'https://game.example.org',
};
const quiet = { warn: vi.fn() };

describe('loadAppConfig (secrets & proxy)', () => {
  it('production: fails fast when JWT/COOKIE secrets are short or placeholders', () => {
    expect(() => loadAppConfig({ ...PROD_ENV, JWT_SECRET: 'short' }, quiet)).toThrow(ConfigValidationError);
    try {
      loadAppConfig({ ...PROD_ENV, JWT_SECRET: 'short', COOKIE_SECRET: 'change-me-cookie-secret-at-least-32-chars' }, quiet);
    } catch (err) {
      const problems = (err as ConfigValidationError).problems.join('\n');
      expect(problems).toMatch(/JWT_SECRET must be at least 32/);
      expect(problems).toMatch(/COOKIE_SECRET still has the placeholder/);
    }
    expect(() => loadAppConfig({ ...PROD_ENV, JWT_SECRET: undefined }, quiet)).toThrow(/JWT_SECRET is required in production/);
  });

  it('production: requires explicit CORS origins and trusts exactly one proxy hop by default', () => {
    const config = loadAppConfig(PROD_ENV, quiet);
    expect(config.isProd).toBe(true);
    expect(config.corsOrigins).toEqual(['https://game.example.org']);
    expect(config.trustProxyHops).toBe(1);
    expect(() => loadAppConfig({ ...PROD_ENV, CORS_ORIGINS: '*' }, quiet)).toThrow(/invalid origin/);
    expect(() => loadAppConfig({ ...PROD_ENV, CORS_ORIGINS: undefined }, quiet)).toThrow(/CORS_ORIGINS is required/);
  });

  it('development: safe defaults, no trusted proxy (X-Forwarded-For cannot spoof rate limits)', () => {
    const warn = vi.fn();
    const config = loadAppConfig({ NODE_ENV: 'development' }, { warn });
    expect(config.trustProxyHops).toBe(0);
    expect(config.jwtSecret.length).toBeGreaterThanOrEqual(32);
    expect(warn).toHaveBeenCalled();
  });

  it('TRUST_PROXY overrides the hop count and rejects nonsense', () => {
    expect(loadAppConfig({ ...PROD_ENV, TRUST_PROXY: '2' }, quiet).trustProxyHops).toBe(2);
    expect(loadAppConfig({ ...PROD_ENV, TRUST_PROXY: '0' }, quiet).trustProxyHops).toBe(0);
    expect(() => loadAppConfig({ ...PROD_ENV, TRUST_PROXY: 'yes' }, quiet)).toThrow(/TRUST_PROXY/);
    expect(() => loadAppConfig({ ...PROD_ENV, TRUST_PROXY: '99' }, quiet)).toThrow(/TRUST_PROXY/);
  });
});
