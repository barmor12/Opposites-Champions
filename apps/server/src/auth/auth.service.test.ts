import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { TeacherJwtPayload } from './teacher-auth.guard';

vi.mock('argon2', async (importOriginal) => {
  const actual = await importOriginal<typeof import('argon2')>();
  return { ...actual, verify: vi.fn(actual.verify) };
});

const findFirst = vi.fn();
const prisma = { teacher: { findFirst } } as unknown as PrismaService;
const jwt = new JwtService({ secret: 'unit-test-secret-at-least-32-chars-long!!', signOptions: { expiresIn: '12h' } });

const TEACHER = { id: '11111111-1111-4111-8111-111111111111', email: 'teacher@example.com', name: 'המורה' };
let passwordHash = '';

describe('AuthService', () => {
  let service: AuthService;

  beforeAll(async () => {
    passwordHash = await argon2.hash('correct-horse', { type: argon2.argon2id });
  });

  beforeEach(() => {
    findFirst.mockReset();
    service = new AuthService(prisma, jwt);
  });

  it('logs in with valid credentials and returns a signed JWT', async () => {
    findFirst.mockResolvedValue({ ...TEACHER, passwordHash });
    const result = await service.login('  Teacher@Example.com ', 'correct-horse');
    expect(result.profile).toEqual(TEACHER);
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email: 'teacher@example.com', deletedAt: null } }));
    const payload = await jwt.verifyAsync<TeacherJwtPayload>(result.token);
    expect(payload.sub).toBe(TEACHER.id);
    expect(payload.email).toBe(TEACHER.email);
  });

  it('rejects a wrong password with a Hebrew 401', async () => {
    findFirst.mockResolvedValue({ ...TEACHER, passwordHash });
    await expect(service.login(TEACHER.email, 'wrong')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login(TEACHER.email, 'wrong')).rejects.toThrow('אימייל או סיסמה שגויים');
  });

  it('rejects an unknown email with the same error and still runs a hash verification', async () => {
    findFirst.mockResolvedValue(null);
    const verifySpy = vi.mocked(argon2.verify);
    verifySpy.mockClear();
    await expect(service.login('nobody@example.com', 'whatever')).rejects.toThrow('אימייל או סיסמה שגויים');
    expect(verifySpy).toHaveBeenCalledTimes(1);
  });

  it('does not match soft-deleted teachers (query filters deletedAt)', async () => {
    findFirst.mockResolvedValue(null);
    await expect(service.login(TEACHER.email, 'correct-horse')).rejects.toBeInstanceOf(UnauthorizedException);
    const call = findFirst.mock.calls[0]?.[0] as { where: { deletedAt: null } };
    expect(call.where.deletedAt).toBeNull();
  });
});
