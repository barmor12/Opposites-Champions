import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { TeacherProfile } from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';

export const TEACHER_COOKIE = 'oc_teacher';
export interface TeacherJwtPayload { sub: string; email: string; name: string }
export type RequestWithTeacher = Request & { teacher?: TeacherProfile };

/** מגן על נתיבי מורה: cookie JWT HttpOnly + הגנת CSRF בסיסית לבקשות משנות מצב */
@Injectable()
export class TeacherAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<RequestWithTeacher>();
    const token = (req.cookies as Record<string, string> | undefined)?.[TEACHER_COOKIE];
    if (!token) throw new UnauthorizedException('נדרשת התחברות מורה');
    let payload: TeacherJwtPayload;
    try {
      payload = await this.jwt.verifyAsync<TeacherJwtPayload>(token);
    } catch {
      throw new UnauthorizedException('ההתחברות פגה, יש להתחבר מחדש');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.header('x-requested-with') !== 'XMLHttpRequest') {
      throw new ForbiddenException('בקשה לא חוקית');
    }
    const teacher = await this.prisma.teacher.findFirst({ where: { id: payload.sub, deletedAt: null }, select: { id: true, email: true, name: true } });
    if (!teacher) throw new UnauthorizedException('המורה לא נמצאה');
    req.teacher = teacher;
    return true;
  }
}
