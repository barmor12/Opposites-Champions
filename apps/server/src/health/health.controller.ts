import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthResponse {
  status: 'ok' | 'error';
  db: 'ok' | 'error';
  uptime: number;
}

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    let db: HealthResponse['db'] = 'ok';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'error';
    }
    if (db !== 'ok') res.status(HttpStatus.SERVICE_UNAVAILABLE);
    return { status: db === 'ok' ? 'ok' : 'error', db, uptime: Math.round(process.uptime()) };
  }
}
