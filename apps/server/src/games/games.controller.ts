import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import type { GameSummary, TeacherProfile, TeacherRoomLive } from '@oc/shared';
import { TeacherAuthGuard } from '../auth/teacher-auth.guard';
import { CurrentTeacher } from '../auth/current-teacher.decorator';
import { GamesService, type StatsOverview } from './games.service';
import { GameSettingsDto, JoinOpenDto } from './dto/game-settings.dto';

const uuid = new ParseUUIDPipe({ errorHttpStatusCode: 404 });

@Controller('games')
@UseGuards(TeacherAuthGuard)
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentTeacher() teacher: TeacherProfile, @Body() settings: GameSettingsDto): Promise<GameSummary> {
    return this.games.createGame(teacher.id, settings);
  }

  @Get()
  list(@CurrentTeacher() teacher: TeacherProfile): Promise<GameSummary[]> {
    return this.games.list(teacher.id);
  }

  @Get('stats/overview')
  stats(@CurrentTeacher() teacher: TeacherProfile): Promise<StatsOverview> {
    return this.games.statsOverview(teacher.id);
  }

  @Get(':id')
  live(@CurrentTeacher() teacher: TeacherProfile, @Param('id', uuid) id: string): Promise<TeacherRoomLive> {
    return this.games.getLive(id, teacher.id);
  }

  @Post(':id/start')
  @HttpCode(200)
  start(@CurrentTeacher() teacher: TeacherProfile, @Param('id', uuid) id: string): Promise<TeacherRoomLive> {
    return this.games.start(id, teacher.id);
  }

  @Post(':id/pause')
  @HttpCode(200)
  pause(@CurrentTeacher() teacher: TeacherProfile, @Param('id', uuid) id: string): Promise<TeacherRoomLive> {
    return this.games.pause(id, teacher.id);
  }

  @Post(':id/resume')
  @HttpCode(200)
  resume(@CurrentTeacher() teacher: TeacherProfile, @Param('id', uuid) id: string): Promise<TeacherRoomLive> {
    return this.games.resume(id, teacher.id);
  }

  @Post(':id/finish')
  @HttpCode(200)
  finish(@CurrentTeacher() teacher: TeacherProfile, @Param('id', uuid) id: string): Promise<TeacherRoomLive> {
    return this.games.finish(id, teacher.id);
  }

  @Post(':id/next')
  @HttpCode(200)
  next(@CurrentTeacher() teacher: TeacherProfile, @Param('id', uuid) id: string): Promise<TeacherRoomLive> {
    return this.games.next(id, teacher.id);
  }

  @Post(':id/join-open')
  @HttpCode(200)
  joinOpen(@CurrentTeacher() teacher: TeacherProfile, @Param('id', uuid) id: string, @Body() body: JoinOpenDto): Promise<TeacherRoomLive> {
    return this.games.setJoinOpen(id, teacher.id, body.open);
  }

  @Post(':id/new-round')
  @HttpCode(201)
  newRound(@CurrentTeacher() teacher: TeacherProfile, @Param('id', uuid) id: string): Promise<GameSummary> {
    return this.games.newRound(id, teacher.id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(@CurrentTeacher() teacher: TeacherProfile, @Param('id', uuid) id: string): Promise<TeacherRoomLive> {
    return this.games.cancel(id, teacher.id);
  }

  @Delete(':id/participants/:participantId')
  removeParticipant(
    @CurrentTeacher() teacher: TeacherProfile,
    @Param('id', uuid) id: string,
    @Param('participantId', uuid) participantId: string,
  ): Promise<TeacherRoomLive> {
    return this.games.removeParticipant(id, teacher.id, participantId);
  }

  @Delete(':id')
  remove(@CurrentTeacher() teacher: TeacherProfile, @Param('id', uuid) id: string): Promise<{ ok: true }> {
    return this.games.deleteGame(id, teacher.id);
  }
}
