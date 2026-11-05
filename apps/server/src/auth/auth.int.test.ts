import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppConfigModule } from '../config/app-config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ContentModule } from '../content/content.module';
import { setupApp } from '../app.setup';
import { AuthModule } from './auth.module';
import { TEACHER_COOKIE } from './teacher-auth.guard';

const EMAIL = 'int-test-teacher@example.com';
const PASSWORD = 'int-test-password-123';
const NAME = 'מורה לבדיקות';

function cookieFrom(res: request.Response): string {
  const header = res.headers['set-cookie'];
  const list = Array.isArray(header) ? header : header ? [header] : [];
  const cookie = list.find((c) => c.startsWith(`${TEACHER_COOKIE}=`));
  if (!cookie) throw new Error('teacher cookie not set');
  return cookie;
}

describe('auth (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule, AuthModule, ContentModule],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app, { corsOrigins: ['http://localhost:5173'], cookieSecret: 'int-test-cookie-secret-32-chars-long!!', isProd: false });
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.teacher.deleteMany({ where: { email: EMAIL } });
    await prisma.teacher.create({ data: { email: EMAIL, name: NAME, passwordHash: await argon2.hash(PASSWORD, { type: argon2.argon2id }) } });
  });

  afterAll(async () => {
    await prisma.teacher.deleteMany({ where: { email: EMAIL } });
    await app.close();
  });

  it('POST /api/auth/login succeeds and sets the HttpOnly oc_teacher cookie', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email: EMAIL.toUpperCase(), password: PASSWORD }).expect(200);
    expect(res.body).toEqual({ id: expect.any(String), email: EMAIL, name: NAME });
    const cookie = cookieFrom(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).not.toMatch(/Secure/i);
  });

  it('POST /api/auth/login fails with 401 + Hebrew message for a wrong password or unknown email', async () => {
    const wrong = await request(app.getHttpServer()).post('/api/auth/login').send({ email: EMAIL, password: 'nope' }).expect(401);
    expect(wrong.body).toEqual({ statusCode: 401, message: 'אימייל או סיסמה שגויים', error: 'Unauthorized' });
    expect(wrong.headers['set-cookie']).toBeUndefined();
    const unknown = await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'nope' }).expect(401);
    expect(unknown.body.message).toBe('אימייל או סיסמה שגויים');
  });

  it('POST /api/auth/login validates the body (400, Hebrew)', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'not-an-email', password: 'x', extra: 1 }).expect(400);
    expect(res.body.statusCode).toBe(400);
    expect(typeof res.body.message).toBe('string');
    expect(res.body.message).toMatch(/[֐-׿]/);
  });

  it('GET /api/auth/me returns 401 without a cookie and the profile with one', async () => {
    const noCookie = await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    expect(noCookie.body.message).toBe('נדרשת התחברות מורה');

    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
    const me = await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', cookieFrom(login)).expect(200);
    expect(me.body).toEqual({ id: login.body.id, email: EMAIL, name: NAME });

    await request(app.getHttpServer()).get('/api/auth/me').set('Cookie', `${TEACHER_COOKIE}=garbage.token.value`).expect(401);
  });

  it('enforces the X-Requested-With CSRF header on state-changing teacher requests', async () => {
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
    const cookie = cookieFrom(login);

    const blocked = await request(app.getHttpServer()).post('/api/word-pairs').set('Cookie', cookie).send({}).expect(403);
    expect(blocked.body).toEqual({ statusCode: 403, message: 'בקשה לא חוקית', error: 'Forbidden' });

    // With the header the guard passes and validation runs (400 instead of 403).
    const validated = await request(app.getHttpServer())
      .post('/api/word-pairs')
      .set('Cookie', cookie)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({})
      .expect(400);
    expect(validated.body.statusCode).toBe(400);

    // GET is allowed without the header.
    await request(app.getHttpServer()).get('/api/categories').set('Cookie', cookie).expect(200);
  });

  it('POST /api/auth/logout requires the CSRF header and clears the cookie', async () => {
    await request(app.getHttpServer()).post('/api/auth/logout').expect(403);
    const res = await request(app.getHttpServer()).post('/api/auth/logout').set('X-Requested-With', 'XMLHttpRequest').expect(200);
    expect(res.body).toEqual({ ok: true });
    const cleared = cookieFrom(res);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
  });
});
