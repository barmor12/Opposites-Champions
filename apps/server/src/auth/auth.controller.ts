import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import type { TeacherProfile } from '@oc/shared';
import { AppConfigService } from '../config/app-config.service';
import { HE } from '../common/hebrew-messages';
import { AuthService } from './auth.service';
import { CurrentTeacher } from './current-teacher.decorator';
import { LoginDto } from './dto/login.dto';
import { TEACHER_COOKIE, TeacherAuthGuard } from './teacher-auth.guard';
import { hasCsrfHeader, teacherCookieOptions } from './teacher-cookie';
import { CSRF_HEADER } from './auth.constants';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly config: AppConfigService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<TeacherProfile> {
    const { profile, token } = await this.auth.login(dto.email, dto.password);
    res.cookie(TEACHER_COOKIE, token, teacherCookieOptions(this.config.isProd));
    return profile;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Headers(CSRF_HEADER) csrf: string | undefined, @Res({ passthrough: true }) res: Response): { ok: true } {
    if (!hasCsrfHeader(csrf)) throw new ForbiddenException(HE.csrf);
    const { maxAge: _maxAge, ...opts } = teacherCookieOptions(this.config.isProd);
    res.clearCookie(TEACHER_COOKIE, opts);
    return { ok: true };
  }

  @Get('me')
  @UseGuards(TeacherAuthGuard)
  me(@CurrentTeacher() teacher: TeacherProfile): TeacherProfile {
    return teacher;
  }
}
