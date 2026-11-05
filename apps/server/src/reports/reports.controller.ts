import { Controller, Get, Param, ParseUUIDPipe, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { GameResults, TeacherProfile } from '@oc/shared';
import { TeacherAuthGuard } from '../auth/teacher-auth.guard';
import { CurrentTeacher } from '../auth/current-teacher.decorator';
import { GamesService } from '../games/games.service';
import { GameError } from '../games/game-error';
import { ReportsService, type ExportFormat } from './reports.service';

const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function optionalSessionId(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw GameError.badRequest('INVALID_SESSION_ID', 'מזהה סבב לא תקין');
  return value;
}

@Controller('games')
@UseGuards(TeacherAuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService, private readonly games: GamesService) {}

  @Get(':id/results')
  async results(
    @CurrentTeacher() teacher: TeacherProfile,
    @Param('id', uuid) id: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<GameResults> {
    await this.games.roomForTeacher(id, teacher.id);
    return this.reports.getResults(id, optionalSessionId(sessionId));
  }

  @Get(':id/export')
  async exportFile(
    @CurrentTeacher() teacher: TeacherProfile,
    @Param('id', uuid) id: string,
    @Res({ passthrough: true }) res: Response,
    @Query('format') format?: string,
    @Query('sessionId') sessionId?: string,
  ): Promise<StreamableFile> {
    await this.games.roomForTeacher(id, teacher.id);
    const fmt: ExportFormat = format === 'xlsx' ? 'xlsx' : format === 'csv' || format === undefined ? 'csv' : 'csv';
    if (format !== undefined && format !== 'csv' && format !== 'xlsx') throw GameError.badRequest('INVALID_FORMAT', 'פורמט הייצוא חייב להיות csv או xlsx');
    const file = await this.reports.exportResults(id, optionalSessionId(sessionId), fmt);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    return new StreamableFile(file.body);
  }
}
