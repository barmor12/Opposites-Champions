import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { TeacherProfile } from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { HE } from '../common/hebrew-messages';
import type { TeacherJwtPayload } from './teacher-auth.guard';

export interface LoginResult {
  profile: TeacherProfile;
  token: string;
}

/** Password hashing options shared with the seed (argon2id defaults are fine). */
export const ARGON2_OPTIONS: argon2.HashOptions = { type: argon2.argon2id };

@Injectable()
export class AuthService {
  // Hash verified for unknown emails so that timing does not reveal account existence.
  private dummyHash: Promise<string> | null = null;

  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async login(emailRaw: string, password: string): Promise<LoginResult> {
    const email = emailRaw.trim().toLowerCase();
    const teacher = await this.prisma.teacher.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true, name: true, passwordHash: true },
    });

    if (!teacher) {
      await this.verifyPassword(await this.getDummyHash(), password);
      throw new UnauthorizedException(HE.invalidCredentials);
    }
    const ok = await this.verifyPassword(teacher.passwordHash, password);
    if (!ok) throw new UnauthorizedException(HE.invalidCredentials);

    const profile: TeacherProfile = { id: teacher.id, email: teacher.email, name: teacher.name };
    const token = await this.signToken(profile);
    return { profile, token };
  }

  async signToken(profile: TeacherProfile): Promise<string> {
    const payload: TeacherJwtPayload = { sub: profile.id, email: profile.email, name: profile.name };
    return this.jwt.signAsync(payload);
  }

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  private async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  private getDummyHash(): Promise<string> {
    if (!this.dummyHash) this.dummyHash = argon2.hash('dummy-password-for-constant-time', ARGON2_OPTIONS);
    return this.dummyHash;
  }
}
