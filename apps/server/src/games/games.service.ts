import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { GameMode, GameState, type GameRoom, type GameSession, type Prisma } from '@prisma/client';
import { canTransition, COUNTDOWN_SECONDS, type GameSettings, type GameSummary, type TeacherRoomLive } from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { QuestionsService, type SessionQuestionFull } from '../questions/questions.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { GameEventsService } from '../websocket/game-events.service';
import { RoomsService } from '../rooms/rooms.service';
import { GameError } from './game-error';
import { parseSettings, settingsToJson } from './settings';
import { TimerRegistry } from './timer-registry';
import { ANSWER_GRACE_MS, COUNTDOWN_MS } from './game-constants';
import { toGameSummary } from '../rooms/room-views';

export interface StatsOverview {
  activeRooms: number;
  totalSessions: number;
  totalParticipants: number;
  averageAccuracy: number;
}

const ACTIVE_ROOM_STATES: GameState[] = [
  GameState.WAITING_FOR_PLAYERS, GameState.COUNTDOWN, GameState.QUESTION_ACTIVE,
  GameState.QUESTION_RESULTS, GameState.NEXT_QUESTION, GameState.PAUSED,
];

type PausedPhase = 'countdown' | 'question' | 'results';

@Injectable()
export class GamesService implements OnModuleInit {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionsService,
    private readonly leaderboard: LeaderboardService,
    private readonly events: GameEventsService,
    private readonly rooms: RoomsService,
    private readonly timers: TimerRegistry,
    private readonly config: AppConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.rearmTimers();
    } catch (err) {
      this.logger.warn(`timer re-arm skipped: ${String(err)}`);
    }
  }

  // ===== מכונת מצבים =====

  /** מעבר מצב אטומי (compare-and-set) – זורק 409 אם המעבר אינו חוקי */
  async transition(sessionId: string, to: GameState, data: Prisma.GameSessionUpdateManyMutationInput = {}): Promise<GameSession> {
    const session = await this.requireSession(sessionId);
    if (!canTransition(session.state, to)) {
      throw GameError.conflict('INVALID_TRANSITION', `לא ניתן לעבור ממצב ${session.state} למצב ${to}`);
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const res = await tx.gameSession.updateMany({ where: { id: sessionId, state: session.state }, data: { ...data, state: to } });
      if (res.count === 0) throw GameError.conflict('STATE_CHANGED', 'מצב המשחק השתנה בינתיים, רעננו ונסו שוב');
      await tx.gameRoom.updateMany({ where: { id: session.roomId, currentSessionId: sessionId }, data: { state: to } });
      return tx.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
    });
    return updated;
  }

  // ===== פעולות מורה =====

  async createGame(teacherId: string, settings: GameSettings): Promise<GameSummary> {
    const room = await this.rooms.createRoom(teacherId, settings);
    const session = await this.createSession(room, 1, settings);
    const updatedRoom = await this.prisma.gameRoom.update({ where: { id: room.id }, data: { currentSessionId: session.id } });
    await this.prisma.auditLog.create({ data: { teacherId, roomId: room.id, action: 'GAME_CREATED', details: { sessionId: session.id, code: room.code } } });
    return toGameSummary(updatedRoom, 0, 1);
  }

  async list(teacherId: string): Promise<GameSummary[]> {
    const rooms = await this.prisma.gameRoom.findMany({
      where: { teacherId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { sessions: true, participants: { where: { removedAt: null } } } } },
    });
    return rooms.map((r) => toGameSummary(r, r._count.participants, r._count.sessions));
  }

  async getLive(roomId: string, teacherId: string): Promise<TeacherRoomLive> {
    const room = await this.roomForTeacher(roomId, teacherId);
    return this.buildLive(room);
  }

  async start(roomId: string, teacherId: string): Promise<TeacherRoomLive> {
    const room = await this.roomForTeacher(roomId, teacherId);
    const session = await this.currentSessionOf(room);
    if (session.state !== GameState.WAITING_FOR_PLAYERS) throw GameError.conflict('NOT_WAITING', 'המשחק כבר התחיל');
    const participants = await this.prisma.gameParticipant.count({ where: { roomId, removedAt: null } });
    if (participants === 0) throw GameError.badRequest('NO_PLAYERS', 'אין תלמידים בחדר, המתינו להצטרפות');
    const now = new Date();
    await this.transition(session.id, GameState.COUNTDOWN, { startedAt: now, pausedAt: null, pausedRemainingMs: null });
    await this.prisma.auditLog.create({ data: { teacherId, roomId, action: 'GAME_STARTED', details: { sessionId: session.id } } });
    this.emitCountdown(room.id, now.getTime() + COUNTDOWN_MS);
    this.armCountdown(session.id, COUNTDOWN_MS);
    return this.buildLive(room);
  }

  async pause(roomId: string, teacherId: string): Promise<TeacherRoomLive> {
    const room = await this.roomForTeacher(roomId, teacherId);
    const session = await this.currentSessionOf(room);
    const now = Date.now();
    let remaining: number | null = null;
    if (session.state === GameState.COUNTDOWN && session.startedAt) {
      remaining = Math.max(0, session.startedAt.getTime() + COUNTDOWN_MS - now);
    } else if (session.state === GameState.QUESTION_ACTIVE && session.questionEndsAt) {
      remaining = Math.max(0, session.questionEndsAt.getTime() - now);
    }
    await this.transition(session.id, GameState.PAUSED, { pausedAt: new Date(now), pausedRemainingMs: remaining });
    this.timers.clear(session.id);
    this.events.toRoom(roomId, 'game:paused', { serverNow: now });
    await this.rooms.emitRoomUpdated(roomId);
    return this.buildLive(room);
  }

  async resume(roomId: string, teacherId: string): Promise<TeacherRoomLive> {
    const room = await this.roomForTeacher(roomId, teacherId);
    const session = await this.currentSessionOf(room);
    if (session.state !== GameState.PAUSED) throw GameError.conflict('NOT_PAUSED', 'המשחק אינו מושהה');
    const now = Date.now();
    const pausedFor = session.pausedAt ? Math.max(0, now - session.pausedAt.getTime()) : 0;
    const phase = await this.pausedPhase(session);

    if (phase === 'countdown') {
      const remaining = session.pausedRemainingMs ?? COUNTDOWN_MS;
      await this.transition(session.id, GameState.COUNTDOWN, { startedAt: new Date(now + remaining - COUNTDOWN_MS), pausedAt: null, pausedRemainingMs: null });
      this.emitCountdown(roomId, now + remaining);
      this.armCountdown(session.id, remaining);
    } else if (phase === 'results') {
      await this.transition(session.id, GameState.QUESTION_RESULTS, { pausedAt: null, pausedRemainingMs: null });
      this.events.toRoom(roomId, 'game:resumed', { serverNow: now });
    } else if (session.mode === GameMode.TEACHER_PACED) {
      const index = session.currentQuestionIndex ?? 0;
      const sq = await this.questions.getSessionQuestion(session.id, index);
      if (!sq) throw GameError.notFound('QUESTION_NOT_FOUND', 'השאלה הפעילה לא נמצאה');
      const startedAt = new Date((sq.startedAt?.getTime() ?? now) + pausedFor);
      const endsAt = sq.timeLimitMs > 0 ? new Date(now + (session.pausedRemainingMs ?? sq.timeLimitMs)) : null;
      await this.prisma.sessionQuestion.update({ where: { id: sq.id }, data: { startedAt, endsAt } });
      await this.transition(session.id, GameState.QUESTION_ACTIVE, { questionStartedAt: startedAt, questionEndsAt: endsAt, pausedAt: null, pausedRemainingMs: null });
      const total = await this.questionTotal(session.id);
      this.events.toRoom(roomId, 'game:resumed', { serverNow: now, question: this.questions.toQuestionView(sq, startedAt, total, now) });
      if (endsAt) this.armQuestionClose(session.id, endsAt.getTime() + ANSWER_GRACE_MS - now);
    } else {
      // self-paced: הזזת זמני ההתחלה של כל משתתף בפרק הזמן שהמשחק היה מושהה
      const rows = await this.prisma.participantProgress.findMany({ where: { sessionId: session.id, finished: false, participant: { removedAt: null } } });
      await this.prisma.$transaction(rows.filter((r) => r.questionStartedAt).map((r) => this.prisma.participantProgress.update({
        where: { id: r.id },
        data: { questionStartedAt: new Date((r.questionStartedAt as Date).getTime() + pausedFor) },
      })));
      await this.transition(session.id, GameState.QUESTION_ACTIVE, { pausedAt: null, pausedRemainingMs: null });
      const all = await this.questions.listSessionQuestions(session.id);
      for (const r of rows) {
        const sq = all[r.currentIndex];
        const startedAt = r.questionStartedAt ? r.questionStartedAt.getTime() + pausedFor : now;
        this.events.toParticipant(r.participantId, 'game:resumed', {
          serverNow: now,
          ...(sq ? { question: this.questions.toQuestionView(sq, startedAt, all.length, now) } : {}),
        });
      }
      this.events.toTeacher(roomId, 'game:resumed', { serverNow: now });
    }
    await this.rooms.emitRoomUpdated(roomId);
    return this.buildLive(room);
  }

  /** teacher-paced: מעבר לשאלה הבאה (או סיום) */
  async next(roomId: string, teacherId: string): Promise<TeacherRoomLive> {
    const room = await this.roomForTeacher(roomId, teacherId);
    let session = await this.currentSessionOf(room);
    if (session.mode !== GameMode.TEACHER_PACED) throw GameError.badRequest('NOT_TEACHER_PACED', 'במצב קצב אישי כל תלמיד מתקדם לבד');
    if (session.state === GameState.QUESTION_ACTIVE) {
      await this.closeQuestion(session.id);
      session = await this.requireSession(session.id);
    }
    if (session.state !== GameState.QUESTION_RESULTS) throw GameError.conflict('NOT_IN_RESULTS', 'אין שאלה פעילה לעבור ממנה');
    const total = await this.questionTotal(session.id);
    const nextIndex = (session.currentQuestionIndex ?? -1) + 1;
    if (nextIndex >= total) {
      await this.finishSession(session.id);
    } else {
      await this.transition(session.id, GameState.NEXT_QUESTION);
      await this.activateQuestion(session.id, nextIndex);
    }
    return this.buildLive(room);
  }

  async finish(roomId: string, teacherId: string): Promise<TeacherRoomLive> {
    const room = await this.roomForTeacher(roomId, teacherId);
    const session = await this.currentSessionOf(room);
    await this.finishSession(session.id);
    await this.prisma.auditLog.create({ data: { teacherId, roomId, action: 'GAME_FINISHED', details: { sessionId: session.id } } });
    return this.buildLive(room);
  }

  async cancel(roomId: string, teacherId: string): Promise<TeacherRoomLive> {
    const room = await this.roomForTeacher(roomId, teacherId);
    const session = await this.currentSessionOf(room);
    this.timers.clear(session.id);
    await this.transition(session.id, GameState.CANCELLED, { finishedAt: new Date() });
    await this.prisma.gameRoom.update({ where: { id: roomId }, data: { joinOpen: false } });
    await this.prisma.auditLog.create({ data: { teacherId, roomId, action: 'GAME_CANCELLED', details: { sessionId: session.id } } });
    this.events.toRoom(roomId, 'error:message', { code: 'GAME_CANCELLED', message: 'המורה ביטלה את המשחק' });
    await this.rooms.emitRoomUpdated(roomId);
    return this.buildLive(room);
  }

  async setJoinOpen(roomId: string, teacherId: string, open: boolean): Promise<TeacherRoomLive> {
    const room = await this.roomForTeacher(roomId, teacherId);
    const updated = await this.prisma.gameRoom.update({ where: { id: room.id }, data: { joinOpen: open } });
    await this.rooms.emitRoomUpdated(roomId);
    return this.buildLive(updated);
  }

  async removeParticipant(roomId: string, teacherId: string, participantId: string): Promise<TeacherRoomLive> {
    const room = await this.roomForTeacher(roomId, teacherId);
    const participant = await this.prisma.gameParticipant.findFirst({ where: { id: participantId, roomId, removedAt: null } });
    if (!participant) throw GameError.notFound('PARTICIPANT_NOT_FOUND', 'התלמיד לא נמצא בחדר');
    await this.prisma.gameParticipant.update({ where: { id: participantId }, data: { removedAt: new Date(), connected: false } });
    await this.prisma.auditLog.create({ data: { teacherId, roomId, action: 'PARTICIPANT_REMOVED', details: { participantId } } });
    this.events.toParticipant(participantId, 'player:removed', { participantId, reason: 'המורה הסירה אותך מהחדר' });
    this.events.disconnectParticipant(participantId);
    const snap = await this.rooms.emitRoomUpdated(roomId);
    this.events.toRoom(roomId, 'player:disconnected', { participantId, participantCount: snap?.participants.length ?? 0 });
    if (room.currentSessionId) {
      this.leaderboard.broadcast(room.currentSessionId);
      await this.maybeFinishIfAllDone(room.currentSessionId);
    }
    return this.buildLive(room);
  }

  /** סבב חדש באותו חדר עם אותם משתתפים (ניקוד מאופס לסבב) */
  async newRound(roomId: string, teacherId: string): Promise<GameSummary> {
    const room = await this.roomForTeacher(roomId, teacherId);
    if (ACTIVE_ROOM_STATES.includes(room.state) && room.state !== GameState.WAITING_FOR_PLAYERS) {
      throw GameError.conflict('ROUND_IN_PROGRESS', 'יש לסיים את הסבב הנוכחי לפני פתיחת סבב חדש');
    }
    const last = await this.prisma.gameSession.aggregate({ where: { roomId }, _max: { roundNumber: true } });
    const roundNumber = (last._max.roundNumber ?? 0) + 1;
    const settings = parseSettings(room.settings);
    const session = await this.createSession(room, roundNumber, settings);
    const participants = await this.prisma.gameParticipant.findMany({ where: { roomId, removedAt: null }, select: { id: true } });
    await this.prisma.$transaction([
      this.prisma.participantProgress.createMany({ data: participants.map((p) => ({ sessionId: session.id, participantId: p.id })), skipDuplicates: true }),
      this.prisma.gameRoom.update({ where: { id: roomId }, data: { currentSessionId: session.id, state: GameState.WAITING_FOR_PLAYERS, joinOpen: true } }),
      this.prisma.auditLog.create({ data: { teacherId, roomId, action: 'NEW_ROUND', details: { sessionId: session.id, roundNumber } } }),
    ]);
    await this.rooms.emitRoomUpdated(roomId);
    const [participantCount, sessionCount] = await Promise.all([
      this.prisma.gameParticipant.count({ where: { roomId, removedAt: null } }),
      this.prisma.gameSession.count({ where: { roomId } }),
    ]);
    const updated = await this.prisma.gameRoom.findUniqueOrThrow({ where: { id: roomId } });
    return toGameSummary(updated, participantCount, sessionCount);
  }

  /** מחיקה קשיחה של חדר וכל נתוני התלמידים (מדיניות מחיקה) */
  async deleteGame(roomId: string, teacherId: string): Promise<{ ok: true }> {
    const room = await this.roomForTeacher(roomId, teacherId);
    const sessions = await this.prisma.gameSession.findMany({ where: { roomId }, select: { id: true } });
    for (const s of sessions) this.timers.clear(s.id);
    this.events.toRoom(roomId, 'error:message', { code: 'ROOM_DELETED', message: 'החדר נמחק על ידי המורה' });
    this.events.disconnectRoom(roomId);
    const questionIds = (await this.prisma.sessionQuestion.findMany({ where: { sessionId: { in: sessions.map((s) => s.id) } }, select: { questionId: true } }))
      .map((q) => q.questionId);
    const studentIds = (await this.prisma.gameParticipant.findMany({ where: { roomId }, select: { studentId: true } })).map((p) => p.studentId);
    await this.prisma.$transaction(async (tx) => {
      await tx.gameRoom.update({ where: { id: roomId }, data: { currentSessionId: null } });
      await tx.gameSession.deleteMany({ where: { roomId } }); // cascade: שאלות סבב, תשובות, ניקוד, הישגים, התקדמות
      await tx.gameParticipant.deleteMany({ where: { roomId } });
      await tx.student.deleteMany({ where: { id: { in: studentIds }, participants: { none: {} } } });
      await tx.auditLog.deleteMany({ where: { roomId } });
      await tx.gameRoom.delete({ where: { id: roomId } });
      if (questionIds.length > 0) {
        await tx.question.deleteMany({ where: { id: { in: questionIds }, sessionQuestions: { none: {} } } });
      }
      await tx.auditLog.create({ data: { teacherId, action: 'ROOM_DELETED', details: { roomId, code: room.code } } });
    });
    return { ok: true };
  }

  async statsOverview(teacherId: string): Promise<StatsOverview> {
    const [activeRooms, totalSessions, totalParticipants, sums] = await Promise.all([
      this.prisma.gameRoom.count({ where: { teacherId, deletedAt: null, state: { in: ACTIVE_ROOM_STATES } } }),
      this.prisma.gameSession.count({ where: { room: { teacherId, deletedAt: null } } }),
      this.prisma.gameParticipant.count({ where: { removedAt: null, room: { teacherId, deletedAt: null } } }),
      this.prisma.participantProgress.aggregate({
        where: { session: { room: { teacherId, deletedAt: null } } },
        _sum: { correctAnswers: true, answeredCount: true },
      }),
    ]);
    const answered = sums._sum.answeredCount ?? 0;
    const correct = sums._sum.correctAnswers ?? 0;
    return { activeRooms, totalSessions, totalParticipants, averageAccuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0 };
  }

  // ===== לוגיקת ריצה (נגישה גם ל־ScoringService) =====

  /** הפעלת הסבב בתום הספירה לאחור */
  async activate(sessionId: string): Promise<void> {
    const session = await this.requireSession(sessionId);
    if (session.state !== GameState.COUNTDOWN) return;
    const now = new Date();
    const all = await this.questions.listSessionQuestions(sessionId);
    await this.transition(sessionId, GameState.QUESTION_ACTIVE, { questionStartedAt: now });
    this.events.toRoom(session.roomId, 'game:started', { gameSessionId: sessionId, mode: session.mode, questionCount: all.length });
    if (session.mode === GameMode.TEACHER_PACED) {
      await this.activateQuestion(sessionId, 0, all);
    } else {
      await this.prisma.participantProgress.updateMany({ where: { sessionId, finished: false }, data: { questionStartedAt: now } });
      const rows = await this.prisma.participantProgress.findMany({ where: { sessionId, finished: false, participant: { removedAt: null } } });
      for (const r of rows) {
        const sq = all[r.currentIndex];
        if (sq) this.events.toParticipant(r.participantId, 'question:started', this.questions.toQuestionView(sq, now, all.length, now.getTime()));
      }
    }
    await this.rooms.emitRoomUpdated(session.roomId);
  }

  /** teacher-paced: הפעלת שאלה לפי אינדקס */
  async activateQuestion(sessionId: string, index: number, preloaded?: SessionQuestionFull[]): Promise<void> {
    const session = await this.requireSession(sessionId);
    const all = preloaded ?? (await this.questions.listSessionQuestions(sessionId));
    const sq = all[index];
    if (!sq) throw GameError.notFound('QUESTION_NOT_FOUND', 'השאלה לא נמצאה');
    const now = new Date();
    const endsAt = sq.timeLimitMs > 0 ? new Date(now.getTime() + sq.timeLimitMs) : null;
    await this.prisma.sessionQuestion.update({ where: { id: sq.id }, data: { startedAt: now, endsAt, closedAt: null } });
    if (session.state !== GameState.QUESTION_ACTIVE) {
      await this.transition(sessionId, GameState.QUESTION_ACTIVE, { currentQuestionIndex: index, questionStartedAt: now, questionEndsAt: endsAt });
    } else {
      await this.prisma.gameSession.update({ where: { id: sessionId }, data: { currentQuestionIndex: index, questionStartedAt: now, questionEndsAt: endsAt } });
    }
    this.events.toRoom(session.roomId, 'question:started', this.questions.toQuestionView(sq, now, all.length, now.getTime()));
    if (endsAt) this.armQuestionClose(sessionId, sq.timeLimitMs + ANSWER_GRACE_MS);
    await this.rooms.emitRoomUpdated(session.roomId);
  }

  /** teacher-paced: סגירת השאלה הפעילה וחשיפת התשובה הנכונה */
  async closeQuestion(sessionId: string): Promise<void> {
    const session = await this.requireSession(sessionId);
    if (session.state !== GameState.QUESTION_ACTIVE || session.currentQuestionIndex === null) return;
    this.timers.clear(sessionId, 'question');
    const sq = await this.questions.getSessionQuestion(sessionId, session.currentQuestionIndex);
    if (!sq) return;
    await this.transition(sessionId, GameState.QUESTION_RESULTS);
    await this.prisma.sessionQuestion.update({ where: { id: sq.id }, data: { closedAt: new Date() } });
    const settings = parseSettings(session.settings);
    const info = settings.showCorrectAnswers ? this.questions.correctInfo(sq) : {};
    this.events.toRoom(session.roomId, 'question:ended', { sessionQuestionId: sq.id, ...info });
    await this.leaderboard.emitNow(sessionId);
    await this.rooms.emitRoomUpdated(session.roomId);
  }

  /** teacher-paced: האם כל המשתתפים הפעילים ענו על השאלה הפעילה */
  async closeQuestionIfAllAnswered(sessionId: string): Promise<void> {
    const session = await this.requireSession(sessionId);
    if (session.mode !== GameMode.TEACHER_PACED || session.state !== GameState.QUESTION_ACTIVE || session.currentQuestionIndex === null) return;
    const sq = await this.prisma.sessionQuestion.findUnique({ where: { sessionId_index: { sessionId, index: session.currentQuestionIndex } }, select: { id: true } });
    if (!sq) return;
    const [active, answered] = await Promise.all([
      this.prisma.gameParticipant.count({ where: { roomId: session.roomId, removedAt: null, connected: true } }),
      this.prisma.studentAnswer.count({ where: { sessionQuestionId: sq.id, participant: { removedAt: null } } }),
    ]);
    if (active > 0 && answered >= active) {
      try {
        await this.closeQuestion(sessionId);
      } catch (err) {
        if (!(err instanceof GameError)) throw err;
      }
    }
  }

  /** סיום סבב: FINAL_RESULTS → הישגים → COMPLETED */
  async finishSession(sessionId: string): Promise<void> {
    const session = await this.requireSession(sessionId);
    if (!canTransition(session.state, GameState.FINAL_RESULTS)) {
      throw GameError.conflict('INVALID_TRANSITION', `לא ניתן לסיים משחק במצב ${session.state}`);
    }
    this.timers.clear(sessionId);
    const now = new Date();
    await this.transition(sessionId, GameState.FINAL_RESULTS, { finishedAt: now, pausedAt: null, pausedRemainingMs: null, questionEndsAt: null });
    if (session.mode === GameMode.TEACHER_PACED) {
      await this.prisma.participantProgress.updateMany({ where: { sessionId, finished: false }, data: { finished: true, finishedAt: now } });
    }
    const board = await this.leaderboard.compute(sessionId);
    const awards = await this.leaderboard.awardAchievements(sessionId);
    this.events.toRoom(session.roomId, 'game:finished', { gameSessionId: sessionId, leaderboard: board });
    if (awards.length > 0) this.events.toRoom(session.roomId, 'achievement:awarded', awards);
    await this.transition(sessionId, GameState.COMPLETED);
    await this.rooms.emitRoomUpdated(session.roomId);
  }

  /** self-paced: אם כל המשתתפים (שלא הוסרו) סיימו – סיום אוטומטי */
  async maybeFinishIfAllDone(sessionId: string): Promise<boolean> {
    const session = await this.requireSession(sessionId);
    if (session.state !== GameState.QUESTION_ACTIVE || session.mode !== GameMode.SELF_PACED) return false;
    const [total, finished] = await Promise.all([
      this.prisma.participantProgress.count({ where: { sessionId, participant: { removedAt: null } } }),
      this.prisma.participantProgress.count({ where: { sessionId, finished: true, participant: { removedAt: null } } }),
    ]);
    if (total === 0 || finished < total) return false;
    try {
      await this.finishSession(sessionId);
      return true;
    } catch (err) {
      if (err instanceof GameError) return false; // כבר הסתיים במקביל
      throw err;
    }
  }

  /** שחזור טיימרים מחותמות זמן במסד הנתונים (לאחר הפעלה מחדש) */
  async rearmTimers(): Promise<number> {
    const sessions = await this.prisma.gameSession.findMany({
      where: { state: { in: [GameState.COUNTDOWN, GameState.QUESTION_ACTIVE] }, room: { deletedAt: null } },
    });
    const now = Date.now();
    let armed = 0;
    for (const s of sessions) {
      if (s.state === GameState.COUNTDOWN) {
        const startsAt = (s.startedAt?.getTime() ?? now) + COUNTDOWN_MS;
        this.armCountdown(s.id, startsAt - now);
        armed += 1;
      } else if (s.mode === GameMode.TEACHER_PACED && s.questionEndsAt) {
        this.armQuestionClose(s.id, s.questionEndsAt.getTime() + ANSWER_GRACE_MS - now);
        armed += 1;
      }
    }
    if (armed > 0) this.logger.log(`re-armed ${armed} game timer(s)`);
    return armed;
  }

  // ===== עזר =====

  async roomForTeacher(roomId: string, teacherId: string): Promise<GameRoom> {
    const room = await this.prisma.gameRoom.findFirst({ where: { id: roomId, deletedAt: null } });
    if (!room) throw GameError.notFound('ROOM_NOT_FOUND', 'המשחק לא נמצא');
    if (room.teacherId !== teacherId) throw GameError.forbidden('NOT_OWNER', 'אין לך הרשאה למשחק זה');
    return room;
  }

  async requireSession(sessionId: string): Promise<GameSession> {
    const session = await this.prisma.gameSession.findUnique({ where: { id: sessionId } });
    if (!session) throw GameError.notFound('SESSION_NOT_FOUND', 'הסבב לא נמצא');
    return session;
  }

  async currentSessionOf(room: GameRoom): Promise<GameSession> {
    if (!room.currentSessionId) throw GameError.conflict('NO_SESSION', 'אין סבב פעיל בחדר');
    return this.requireSession(room.currentSessionId);
  }

  async buildLive(room: GameRoom): Promise<TeacherRoomLive> {
    const fresh = (await this.prisma.gameRoom.findUnique({ where: { id: room.id } })) ?? room;
    const snap = await this.rooms.snapshot(fresh.id);
    const session = await this.rooms.currentSession(fresh);
    const board = session ? await this.leaderboard.compute(session.id) : null;
    return {
      room: snap.room,
      participants: snap.participants,
      finishedCount: snap.participants.filter((p) => p.finished).length,
      leaderboard: board?.entries ?? [],
      gameSessionId: session?.id ?? null,
      currentQuestionIndex: session?.currentQuestionIndex ?? null,
      joinUrl: `${this.config.appUrl.replace(/\/+$/, '')}/join/${fresh.code}`,
    };
  }

  private async createSession(room: GameRoom, roundNumber: number, settings: GameSettings): Promise<GameSession> {
    const session = await this.prisma.gameSession.create({
      data: {
        roomId: room.id,
        roundNumber,
        state: GameState.WAITING_FOR_PLAYERS,
        mode: settings.mode === GameMode.TEACHER_PACED ? GameMode.TEACHER_PACED : GameMode.SELF_PACED,
        settings: settingsToJson(settings),
      },
    });
    await this.questions.generateSessionQuestions(session.id, settings, session.id);
    return session;
  }

  private async questionTotal(sessionId: string): Promise<number> {
    return this.prisma.sessionQuestion.count({ where: { sessionId } });
  }

  private async pausedPhase(session: GameSession): Promise<PausedPhase> {
    if (session.mode === GameMode.TEACHER_PACED) {
      if (session.currentQuestionIndex === null) return 'countdown';
      const sq = await this.prisma.sessionQuestion.findUnique({ where: { sessionId_index: { sessionId: session.id, index: session.currentQuestionIndex } }, select: { closedAt: true } });
      return sq?.closedAt ? 'results' : 'question';
    }
    const started = await this.prisma.participantProgress.count({ where: { sessionId: session.id, questionStartedAt: { not: null } } });
    return started > 0 || session.questionStartedAt ? 'question' : 'countdown';
  }

  private emitCountdown(roomId: string, startsAt: number): void {
    this.events.toRoom(roomId, 'game:countdown', { seconds: COUNTDOWN_SECONDS, startsAt, serverNow: Date.now() });
  }

  private armCountdown(sessionId: string, delayMs: number): void {
    this.timers.set(sessionId, 'countdown', delayMs, () => {
      this.activate(sessionId).catch((err: unknown) => this.logger.error(`activate failed (${sessionId}): ${String(err)}`));
    });
  }

  private armQuestionClose(sessionId: string, delayMs: number): void {
    this.timers.set(sessionId, 'question', delayMs, () => {
      this.closeQuestion(sessionId).catch((err: unknown) => this.logger.error(`closeQuestion failed (${sessionId}): ${String(err)}`));
    });
  }
}
