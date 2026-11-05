import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import {
  AchievementType, Category, GameMode, GameState, QuestionType, SESSION_TOKEN_HEADER, TREASURE_BONUS,
  type AnswerPayload, type AnswerResult, type GameResults, type GameSettings, type GameSummary, type JoinRoomResponse,
  type PlayerSession, type RoomPublicView, type TeacherRoomLive,
} from '@oc/shared';
import { AppConfigModule } from '../config/app-config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { setupApp } from '../app.setup';
import { TEACHER_COOKIE } from '../auth/teacher-auth.guard';
import { GameFeatureModule } from './game-feature.module';
import { ScoringService } from '../scoring/scoring.service';
import { QuestionsService, SESSION_QUESTION_INCLUDE } from '../questions/questions.service';
import { COUNTDOWN_MS } from './game-constants';

const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
const SETTINGS: GameSettings = {
  className: 'כיתה ג׳ – בדיקת אינטגרציה',
  questionCount: 10,
  difficulty: 'MIXED',
  categories: Object.values(Category),
  timePerQuestionSec: 20,
  questionTypes: [QuestionType.CHOOSE_OPPOSITE, QuestionType.COMPLETE_SENTENCE, QuestionType.CHOOSE_IMAGE, QuestionType.MATCH_PAIRS],
  mode: GameMode.SELF_PACED,
  competitionEnabled: true,
  showLeaderboard: true,
  showCorrectAnswers: true,
  soundsEnabled: true,
  treasureChallenge: true,
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('game flow (integration, self-paced)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scoring: ScoringService;
  let questions: QuestionsService;
  let cookie: string;
  let otherCookie: string;
  let teacherId: string;
  let otherTeacherId: string;
  let game: GameSummary;
  const players: JoinRoomResponse[] = [];

  const api = () => request(app.getHttpServer());

  /** עונה נכון/לא נכון על השאלה הנוכחית של המשתתף דרך השירות (כמו ה־gateway) */
  async function answer(participantId: string, correctly: boolean): Promise<AnswerResult> {
    const participant = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: participantId }, include: { room: true } });
    const sessionId = participant.room.currentSessionId as string;
    const progress = await prisma.participantProgress.findUniqueOrThrow({ where: { sessionId_participantId: { sessionId, participantId } } });
    const sq = await prisma.sessionQuestion.findUniqueOrThrow({ where: { sessionId_index: { sessionId, index: progress.currentIndex } }, include: SESSION_QUESTION_INCLUDE });
    let payload: AnswerPayload;
    if (sq.question.type === QuestionType.MATCH_PAIRS) {
      const info = questions.correctInfo(sq);
      const matches = info.correctMatches ?? [];
      payload = { sessionQuestionId: sq.id, matches: correctly ? matches : [{ cardA: matches[0]?.cardA ?? '', cardB: matches[1]?.cardB ?? '' }], mistakes: 0 };
    } else {
      const option = sq.question.options.find((o) => o.isCorrect === correctly);
      if (!option) throw new Error('option not found');
      payload = { sessionQuestionId: sq.id, optionId: option.id };
    }
    return scoring.submitAnswer(participantId, payload);
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppConfigModule, PrismaModule, GameFeatureModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app, { corsOrigins: ['http://localhost:5173'], cookieSecret: 'int-test-cookie-secret-32-chars-long!!', isProd: false, http: false });
    await app.init();
    prisma = app.get(PrismaService);
    scoring = app.get(ScoringService);
    questions = app.get(QuestionsService);
    const jwt = app.get(JwtService);
    await prisma.teacher.deleteMany({ where: { email: { in: ['game-int@example.com', 'game-int-other@example.com'] } } });
    const teacher = await prisma.teacher.create({ data: { email: 'game-int@example.com', name: 'מורה אינטגרציה', passwordHash: 'x' } });
    const other = await prisma.teacher.create({ data: { email: 'game-int-other@example.com', name: 'מורה אחרת', passwordHash: 'x' } });
    teacherId = teacher.id;
    otherTeacherId = other.id;
    cookie = `${TEACHER_COOKIE}=${await jwt.signAsync({ sub: teacher.id, email: teacher.email, name: teacher.name })}`;
    otherCookie = `${TEACHER_COOKIE}=${await jwt.signAsync({ sub: other.id, email: other.email, name: other.name })}`;
  });

  afterAll(async () => {
    const rooms = await prisma.gameRoom.findMany({ where: { teacherId: { in: [teacherId, otherTeacherId] } }, select: { id: true } });
    for (const r of rooms) await api().delete(`/api/games/${r.id}`).set('Cookie', cookie).set(CSRF);
    await prisma.teacher.deleteMany({ where: { id: { in: [teacherId, otherTeacherId] } } });
    await app.close();
  });

  it('creates a game with a 6-digit code, 10 questions and treasure marking', async () => {
    const res = await api().post('/api/games').set('Cookie', cookie).set(CSRF).send(SETTINGS).expect(201);
    game = res.body as GameSummary;
    expect(game.code).toMatch(/^\d{6}$/);
    expect(game.state).toBe(GameState.WAITING_FOR_PLAYERS);
    expect(game.joinOpen).toBe(true);
    expect(game.sessionCount).toBe(1);
    const sqs = await prisma.sessionQuestion.findMany({ where: { sessionId: game.currentSessionId as string }, orderBy: { index: 'asc' } });
    expect(sqs).toHaveLength(10);
    expect(sqs.slice(5).map((q) => q.treasureStep)).toEqual([1, 2, 3, 4, 5]);
    const list = await api().get('/api/games').set('Cookie', cookie).expect(200);
    expect((list.body as GameSummary[]).some((g) => g.roomId === game.roomId)).toBe(true);
  });

  it('rejects settings that are not in the allowed options', async () => {
    await api().post('/api/games').set('Cookie', cookie).set(CSRF).send({ ...SETTINGS, questionCount: 11 }).expect(400);
    await api().post('/api/games').set('Cookie', cookie).set(CSRF).send({ ...SETTINGS, timePerQuestionSec: 7 }).expect(400);
  });

  it('refuses access to another teacher', async () => {
    await api().get(`/api/games/${game.roomId}`).set('Cookie', otherCookie).expect(403);
    await api().get(`/api/games/${game.roomId}`).expect(401);
  });

  it('lets 3 players join, rejects duplicate / invalid names and unknown codes', async () => {
    for (const [name, avatar] of [['דנה', 'lion'], ['יואב', 'fox'], ['נועה', 'owl']] as const) {
      const res = await api().post('/api/rooms/join').send({ code: game.code, displayName: name, avatar }).expect(200);
      const joined = res.body as JoinRoomResponse;
      expect(joined.sessionToken.length).toBeGreaterThan(30);
      expect(joined.room.code).toBe(game.code);
      players.push(joined);
    }
    const dup = await api().post('/api/rooms/join').send({ code: game.code, displayName: 'דנה ', avatar: 'cat' }).expect(400);
    expect(dup.body.message).toBe('השם כבר תפוס בחדר, בחרו שם אחר');
    await api().post('/api/rooms/join').send({ code: game.code, displayName: 'א', avatar: 'cat' }).expect(400);
    await api().post('/api/rooms/join').send({ code: game.code, displayName: 'טיפש', avatar: 'cat' }).expect(400);
    await api().post('/api/rooms/join').send({ code: game.code, displayName: 'אורי', avatar: 'dragon' }).expect(400);
    await api().post('/api/rooms/join').send({ code: '000000', displayName: 'אורי', avatar: 'cat' }).expect(404);

    const pub = await api().get(`/api/rooms/${game.code}`).expect(200);
    const view = pub.body as RoomPublicView;
    expect(view.participantCount).toBe(3);
    expect(JSON.stringify(view)).not.toContain('דנה');

    const session = await api().get('/api/player/session').set(SESSION_TOKEN_HEADER, players[0]?.sessionToken ?? '').expect(200);
    expect((session.body as PlayerSession).currentQuestion).toBeNull();
    await api().get('/api/player/session').set(SESSION_TOKEN_HEADER, 'bogus').expect(401);
  });

  it('starts the game: COUNTDOWN then QUESTION_ACTIVE with per-player questions that survive refresh', async () => {
    await api().post(`/api/games/${game.roomId}/join-open`).set('Cookie', cookie).set(CSRF).send({ open: false }).expect(200);
    await api().post('/api/rooms/join').send({ code: game.code, displayName: 'מאחר', avatar: 'cat' }).expect(403);

    const started = await api().post(`/api/games/${game.roomId}/start`).set('Cookie', cookie).set(CSRF).expect(200);
    expect((started.body as TeacherRoomLive).room.state).toBe(GameState.COUNTDOWN);
    await api().post(`/api/games/${game.roomId}/start`).set('Cookie', cookie).set(CSRF).expect(409);
    await sleep(COUNTDOWN_MS + 700);
    const live = await api().get(`/api/games/${game.roomId}`).set('Cookie', cookie).expect(200);
    expect((live.body as TeacherRoomLive).room.state).toBe(GameState.QUESTION_ACTIVE);

    const token = players[0]?.sessionToken ?? '';
    const first = (await api().get('/api/player/session').set(SESSION_TOKEN_HEADER, token).expect(200)).body as PlayerSession;
    expect(first.currentQuestion?.index).toBe(0);
    expect(first.currentQuestion?.total).toBe(10);
    expect(JSON.stringify(first.currentQuestion)).not.toContain('isCorrect');
    await sleep(50);
    const again = (await api().get('/api/player/session').set(SESSION_TOKEN_HEADER, token).expect(200)).body as PlayerSession;
    expect(again.currentQuestion?.startedAt).toBe(first.currentQuestion?.startedAt);
  });

  it('scores answers, rejects duplicates, grants the treasure bonus and ranks correctly', async () => {
    const [a, b, c] = players as [JoinRoomResponse, JoinRoomResponse, JoinRoomResponse];

    // A: הכל נכון
    let last: AnswerResult | null = null;
    for (let i = 0; i < 10; i += 1) {
      last = await answer(a.participantId, true);
      expect(last.correct).toBe(true);
      expect(last.scoreAwarded).toBeGreaterThanOrEqual(100);
      if (i === 0) await expect(answer(a.participantId, true)).rejects.toMatchObject({ code: 'ALREADY_ANSWERED' });
      const adv = await scoring.advance(a.participantId, last.sessionQuestionId);
      expect(adv.finished).toBe(i === 9);
      if (adv.question) expect(adv.question.index).toBe(i + 1);
    }
    expect(last?.treasureCompleted).toBe(true);
    expect(last?.treasureBonus).toBe(TREASURE_BONUS);
    expect(last?.streak).toBe(10);
    await expect(answer(a.participantId, true)).rejects.toMatchObject({ code: 'ALREADY_FINISHED' });

    // B: 5 נכונות ואז 5 שגויות
    for (let i = 0; i < 10; i += 1) {
      const r = await answer(b.participantId, i < 5);
      expect(r.correct).toBe(i < 5);
      await scoring.advance(b.participantId, r.sessionQuestionId);
    }
    // C: שתי שאלות ודילוג על השלישית ללא תשובה
    for (let i = 0; i < 2; i += 1) {
      const r = await answer(c.participantId, true);
      await scoring.advance(c.participantId, r.sessionQuestionId);
    }
    const skipped = await scoring.advance(c.participantId);
    expect(skipped.question?.index).toBe(3);
    const cAnswers = await prisma.studentAnswer.findMany({ where: { participantId: c.participantId }, orderBy: { answeredAt: 'asc' } });
    expect(cAnswers).toHaveLength(3);
    expect(cAnswers[2]).toMatchObject({ isCorrect: false, scoreAwarded: 0, elapsedMs: 20_000 });

    const live = (await api().get(`/api/games/${game.roomId}`).set('Cookie', cookie).expect(200)).body as TeacherRoomLive;
    expect(live.room.state).toBe(GameState.QUESTION_ACTIVE);
    expect(live.finishedCount).toBe(2);
    expect(live.leaderboard.map((e) => e.participantId)).toEqual([a.participantId, b.participantId, c.participantId]);
    expect(live.leaderboard[0]?.rank).toBe(1);
    expect(live.leaderboard[0]?.correctAnswers).toBe(10);
    expect(live.leaderboard[1]?.accuracy).toBe(50);

    const bSession = (await api().get('/api/player/progress').set(SESSION_TOKEN_HEADER, b.sessionToken).expect(200)).body as { finished: boolean; answeredCount: number; total: number };
    expect(bSession).toMatchObject({ finished: true, answeredCount: 10, total: 10 });
  });

  it('finishes the game, awards achievements and exports results', async () => {
    const [a, b] = players as [JoinRoomResponse, JoinRoomResponse];
    const finished = (await api().post(`/api/games/${game.roomId}/finish`).set('Cookie', cookie).set(CSRF).expect(200)).body as TeacherRoomLive;
    expect(finished.room.state).toBe(GameState.COMPLETED);

    const results = (await api().get(`/api/games/${game.roomId}/results`).set('Cookie', cookie).expect(200)).body as GameResults;
    expect(results.questionCount).toBe(10);
    expect(results.questionStats).toHaveLength(10);
    expect(results.hardestQuestions.length).toBeGreaterThan(0);
    expect(results.hardestQuestions.length).toBeLessThanOrEqual(5);
    expect(results.leaderboard[0]?.participantId).toBe(a.participantId);
    const typesOf = (id: string): AchievementType[] => results.achievements.filter((x) => x.participantId === id).map((x) => x.type).sort();
    expect(typesOf(a.participantId)).toEqual([
      AchievementType.ACCURACY_CHAMPION, AchievementType.FIVE_STREAK, AchievementType.OPPOSITES_CHAMPION,
      AchievementType.PERSISTENCE_CHAMPION, AchievementType.TEN_CORRECT,
    ].sort());
    expect(typesOf(b.participantId)).toEqual([AchievementType.FIVE_STREAK, AchievementType.PERSISTENCE_CHAMPION].sort());
    const stat0 = results.questionStats[0];
    expect(stat0?.answered).toBe(3);
    expect(stat0?.correctAnswerText.length).toBeGreaterThan(0);
    expect(stat0?.distribution.some((d) => d.isCorrect)).toBe(true);

    const playerAch = (await api().get('/api/player/progress').set(SESSION_TOKEN_HEADER, a.sessionToken).expect(200)).body as { achievements: AchievementType[] };
    expect(playerAch.achievements).toContain(AchievementType.OPPOSITES_CHAMPION);

    const csv = await api().get(`/api/games/${game.roomId}/export?format=csv`).set('Cookie', cookie).expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.headers['content-disposition']).toMatch(/\.csv"/);
    const text = Buffer.isBuffer(csv.body) ? csv.body.toString('utf8') : String(csv.text);
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('דירוג');
    expect(text).toContain('דנה');

    const xlsx = await api().get(`/api/games/${game.roomId}/export?format=xlsx`).set('Cookie', cookie).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    }).expect(200);
    expect(xlsx.headers['content-type']).toMatch(/spreadsheetml/);
    expect((xlsx.body as Buffer).subarray(0, 2).toString('latin1')).toBe('PK');
    await api().get(`/api/games/${game.roomId}/export?format=pdf`).set('Cookie', cookie).expect(400);

    const stats = (await api().get('/api/games/stats/overview').set('Cookie', cookie).expect(200)).body as { totalSessions: number; totalParticipants: number; averageAccuracy: number };
    expect(stats.totalSessions).toBeGreaterThanOrEqual(1);
    expect(stats.totalParticipants).toBe(3);
  });

  it('opens a new round with the same participants and reset scores', async () => {
    const round = (await api().post(`/api/games/${game.roomId}/new-round`).set('Cookie', cookie).set(CSRF).expect(201)).body as GameSummary;
    expect(round.sessionCount).toBe(2);
    expect(round.state).toBe(GameState.WAITING_FOR_PLAYERS);
    expect(round.currentSessionId).not.toBe(game.currentSessionId);
    const live = (await api().get(`/api/games/${game.roomId}`).set('Cookie', cookie).expect(200)).body as TeacherRoomLive;
    expect(live.participants).toHaveLength(3);
    expect(live.participants.every((p) => p.score === 0 && !p.finished && p.answeredCount === 0)).toBe(true);
    const previous = (await api().get(`/api/games/${game.roomId}/results?sessionId=${game.currentSessionId}`).set('Cookie', cookie).expect(200)).body as GameResults;
    expect(previous.leaderboard[0]?.correctAnswers).toBe(10);

    // המשתתף שהוסר לא משתתף יותר
    const removedId = players[2]?.participantId ?? '';
    const afterRemove = (await api().delete(`/api/games/${game.roomId}/participants/${removedId}`).set('Cookie', cookie).set(CSRF).expect(200)).body as TeacherRoomLive;
    expect(afterRemove.participants).toHaveLength(2);
    await api().get('/api/player/session').set(SESSION_TOKEN_HEADER, players[2]?.sessionToken ?? '').expect(401);
  });

  it('hard-deletes the room with all student data', async () => {
    const studentIds = (await prisma.gameParticipant.findMany({ where: { roomId: game.roomId }, select: { studentId: true } })).map((p) => p.studentId);
    await api().delete(`/api/games/${game.roomId}`).set('Cookie', cookie).set(CSRF).expect(200);
    expect(await prisma.gameRoom.findUnique({ where: { id: game.roomId } })).toBeNull();
    expect(await prisma.student.count({ where: { id: { in: studentIds } } })).toBe(0);
    expect(await prisma.gameSession.count({ where: { roomId: game.roomId } })).toBe(0);
    await api().get(`/api/games/${game.roomId}`).set('Cookie', cookie).expect(404);
  });
});

describe('game flow (integration, teacher-paced)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let scoring: ScoringService;
  let cookie: string;
  let teacherId: string;
  let game: GameSummary;
  const players: JoinRoomResponse[] = [];
  const api = () => request(app.getHttpServer());

  async function answerCurrent(participantId: string): Promise<AnswerResult> {
    const session = await prisma.gameSession.findUniqueOrThrow({ where: { id: game.currentSessionId as string } });
    const sq = await prisma.sessionQuestion.findUniqueOrThrow({ where: { sessionId_index: { sessionId: session.id, index: session.currentQuestionIndex ?? 0 } }, include: SESSION_QUESTION_INCLUDE });
    const option = sq.question.options.find((o) => o.isCorrect);
    return scoring.submitAnswer(participantId, { sessionQuestionId: sq.id, optionId: option?.id ?? '' });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppConfigModule, PrismaModule, GameFeatureModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app, { corsOrigins: ['http://localhost:5173'], cookieSecret: 'int-test-cookie-secret-32-chars-long!!', isProd: false, http: false });
    await app.init();
    prisma = app.get(PrismaService);
    scoring = app.get(ScoringService);
    await prisma.teacher.deleteMany({ where: { email: 'game-int-tp@example.com' } });
    const teacher = await prisma.teacher.create({ data: { email: 'game-int-tp@example.com', name: 'מורה קצב מורה', passwordHash: 'x' } });
    teacherId = teacher.id;
    cookie = `${TEACHER_COOKIE}=${await app.get(JwtService).signAsync({ sub: teacher.id, email: teacher.email, name: teacher.name })}`;
    game = (await api().post('/api/games').set('Cookie', cookie).set(CSRF)
      .send({ ...SETTINGS, mode: GameMode.TEACHER_PACED, treasureChallenge: false, questionTypes: [QuestionType.CHOOSE_OPPOSITE], timePerQuestionSec: 15 })
      .expect(201)).body as GameSummary;
    for (const name of ['רון', 'מאיה']) {
      players.push((await api().post('/api/rooms/join').send({ code: game.code, displayName: name, avatar: 'panda' }).expect(200)).body as JoinRoomResponse);
    }
    // teacher-paced auto-close counts connected players; mark them connected as the gateway would
    await prisma.gameParticipant.updateMany({ where: { roomId: game.roomId }, data: { connected: true } });
  });

  afterAll(async () => {
    if (game) await api().delete(`/api/games/${game.roomId}`).set('Cookie', cookie).set(CSRF);
    await prisma.teacher.deleteMany({ where: { id: teacherId } });
    await app.close();
  });

  it('activates question 0 for the whole room, closes when everyone answered, and advances with next', async () => {
    await api().post(`/api/games/${game.roomId}/start`).set('Cookie', cookie).set(CSRF).expect(200);
    await sleep(COUNTDOWN_MS + 700);
    let live = (await api().get(`/api/games/${game.roomId}`).set('Cookie', cookie).expect(200)).body as TeacherRoomLive;
    expect(live.room.state).toBe(GameState.QUESTION_ACTIVE);
    expect(live.currentQuestionIndex).toBe(0);
    const session = (await api().get('/api/player/session').set(SESSION_TOKEN_HEADER, players[0]?.sessionToken ?? '').expect(200)).body as PlayerSession;
    expect(session.currentQuestion?.index).toBe(0);
    expect(session.currentQuestion?.endsAt).toBeGreaterThan(session.currentQuestion?.startedAt ?? 0);

    const r1 = await answerCurrent(players[0]?.participantId ?? '');
    expect(r1.correct).toBe(true);
    expect(r1.correctOptionId).toBeUndefined(); // נחשף רק ב־question:ended
    await answerCurrent(players[1]?.participantId ?? '');
    await sleep(300);
    live = (await api().get(`/api/games/${game.roomId}`).set('Cookie', cookie).expect(200)).body as TeacherRoomLive;
    expect(live.room.state).toBe(GameState.QUESTION_RESULTS);
    await expect(answerCurrent(players[0]?.participantId ?? '')).rejects.toMatchObject({ code: 'NOT_ACTIVE' });

    live = (await api().post(`/api/games/${game.roomId}/next`).set('Cookie', cookie).set(CSRF).expect(200)).body as TeacherRoomLive;
    expect(live.room.state).toBe(GameState.QUESTION_ACTIVE);
    expect(live.currentQuestionIndex).toBe(1);
  });

  it('pauses and resumes keeping the remaining time, then finishes', async () => {
    const paused = (await api().post(`/api/games/${game.roomId}/pause`).set('Cookie', cookie).set(CSRF).expect(200)).body as TeacherRoomLive;
    expect(paused.room.state).toBe(GameState.PAUSED);
    const stored = await prisma.gameSession.findUniqueOrThrow({ where: { id: game.currentSessionId as string } });
    expect(stored.pausedRemainingMs).toBeGreaterThan(10_000);
    expect(stored.pausedRemainingMs).toBeLessThanOrEqual(15_000);
    await expect(answerCurrent(players[0]?.participantId ?? '')).rejects.toMatchObject({ code: 'GAME_PAUSED' });
    await sleep(400);
    const resumed = (await api().post(`/api/games/${game.roomId}/resume`).set('Cookie', cookie).set(CSRF).expect(200)).body as TeacherRoomLive;
    expect(resumed.room.state).toBe(GameState.QUESTION_ACTIVE);
    const after = await prisma.gameSession.findUniqueOrThrow({ where: { id: game.currentSessionId as string } });
    expect(after.questionEndsAt?.getTime()).toBeGreaterThan(Date.now() + 9_000);
    const r = await answerCurrent(players[1]?.participantId ?? '');
    expect(r.correct).toBe(true);

    const finished = (await api().post(`/api/games/${game.roomId}/finish`).set('Cookie', cookie).set(CSRF).expect(200)).body as TeacherRoomLive;
    expect(finished.room.state).toBe(GameState.COMPLETED);
    expect(finished.finishedCount).toBe(2);
    const results = (await api().get(`/api/games/${game.roomId}/results`).set('Cookie', cookie).expect(200)).body as GameResults;
    expect(results.leaderboard[0]?.participantId).toBe(players[1]?.participantId);
    await api().post(`/api/games/${game.roomId}/next`).set('Cookie', cookie).set(CSRF).expect(409);
  });
});
