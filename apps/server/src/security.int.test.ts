import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io, type Socket } from 'socket.io-client';
import {
  Category, GameMode, GameState, QuestionType, SESSION_TOKEN_HEADER,
  type ClientToServerEvents, type GameSettings, type JoinRoomResponse, type PlayerSession, type QuestionView, type RoomPublicView,
  type ServerToClientEvents, type SocketAck,
} from '@oc/shared';
import { AppConfigModule } from './config/app-config.module';
import { PrismaModule } from './prisma/prisma.module';
import { PrismaService } from './prisma/prisma.service';
import { setupApp } from './app.setup';
import { HttpThrottlerGuard } from './common/http-throttler.guard';
import { TEACHER_COOKIE } from './auth/teacher-auth.guard';
import { GameFeatureModule } from './games/game-feature.module';
import { GamesService } from './games/games.service';
import { RoomsService } from './rooms/rooms.service';
import { ScoringService } from './scoring/scoring.service';
import { SESSION_QUESTION_INCLUDE } from './questions/questions.service';
import { generateSessionToken } from './players/player-token';
import { JOIN_RATE_LIMIT_PER_MINUTE, ROOM_LOOKUP_RATE_LIMIT_PER_MINUTE } from './rooms/rooms.controller';
import { AUTH_FAILURE_LIMIT, SOCKET_EVENT_LIMIT } from './websocket/game.gateway';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const CSRF = { 'X-Requested-With': 'XMLHttpRequest' };
const SETTINGS: GameSettings = {
  className: 'אבטחה', questionCount: 10, difficulty: 'MIXED', categories: Object.values(Category), timePerQuestionSec: 20,
  questionTypes: [QuestionType.CHOOSE_OPPOSITE], mode: GameMode.SELF_PACED,
  competitionEnabled: true, showLeaderboard: true, showCorrectAnswers: true, soundsEnabled: true, treasureChallenge: false,
};
const EMAILS = ['sec-a@example.com', 'sec-b@example.com'];

function once<T>(socket: ClientSocket, event: keyof ServerToClientEvents | 'disconnect' | 'connect' | 'connect_error', timeoutMs = 8_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${String(event)}`)), timeoutMs);
    (socket as Socket).once(event as string, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function emitAck<T>(socket: ClientSocket, event: keyof ClientToServerEvents, payload: unknown): Promise<SocketAck<T>> {
  return new Promise((resolve) => {
    (socket as Socket).emit(event, payload, (ack: SocketAck<T>) => resolve(ack));
  });
}

describe('security hardening (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let games: GamesService;
  let rooms: RoomsService;
  let scoring: ScoringService;
  let url: string;
  let teacherA: { id: string; cookie: string };
  let teacherB: { id: string; cookie: string };
  let roomA: { id: string; code: string; sessionId: string };
  let roomB: { id: string; code: string; sessionId: string };
  let playerA: JoinRoomResponse;
  let playerA2: JoinRoomResponse;
  let playerB: JoinRoomResponse;
  const sockets: ClientSocket[] = [];
  const api = () => request(app.getHttpServer());

  function connect(auth: Record<string, unknown>, extraHeaders?: Record<string, string>): ClientSocket {
    const socket: ClientSocket = io(url, { path: '/socket.io', transports: ['websocket'], auth, extraHeaders, forceNew: true, reconnection: false });
    sockets.push(socket);
    return socket;
  }

  async function currentQuestion(participantId: string, sessionId: string) {
    const progress = await prisma.participantProgress.findUniqueOrThrow({ where: { sessionId_participantId: { sessionId, participantId } } });
    return prisma.sessionQuestion.findUniqueOrThrow({ where: { sessionId_index: { sessionId, index: progress.currentIndex } }, include: SESSION_QUESTION_INCLUDE });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppConfigModule, PrismaModule, ThrottlerModule.forRoot({ throttlers: [{ name: 'default', ttl: 60_000, limit: 1000 }] }), GameFeatureModule],
      providers: [{ provide: APP_GUARD, useClass: HttpThrottlerGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app, { corsOrigins: ['http://localhost:5173'], cookieSecret: 'int-test-cookie-secret-32-chars-long!!', isProd: false, http: false });
    await app.init();
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    prisma = app.get(PrismaService);
    games = app.get(GamesService);
    rooms = app.get(RoomsService);
    scoring = app.get(ScoringService);
    const jwt = app.get(JwtService);

    await prisma.teacher.deleteMany({ where: { email: { in: EMAILS } } });
    const mk = async (email: string, name: string) => {
      const t = await prisma.teacher.create({ data: { email, name, passwordHash: 'x' } });
      return { id: t.id, cookie: `${TEACHER_COOKIE}=${await jwt.signAsync({ sub: t.id, email, name })}` };
    };
    teacherA = await mk(EMAILS[0] as string, 'מורה א');
    teacherB = await mk(EMAILS[1] as string, 'מורה ב');

    const a = await games.createGame(teacherA.id, SETTINGS);
    const b = await games.createGame(teacherB.id, SETTINGS);
    roomA = { id: a.roomId, code: a.code, sessionId: a.currentSessionId as string };
    roomB = { id: b.roomId, code: b.code, sessionId: b.currentSessionId as string };
    playerA = await rooms.join(roomA.code, 'אלון', 'lion');
    playerA2 = await rooms.join(roomA.code, 'בר', 'fox');
    playerB = await rooms.join(roomB.code, 'גל', 'owl');
    // start both rounds and skip the countdown wait by activating directly (the countdown timer then no-ops)
    await games.start(roomA.id, teacherA.id);
    await games.start(roomB.id, teacherB.id);
    await games.activate(roomA.sessionId);
    await games.activate(roomB.sessionId);
  });

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    const owned = await prisma.gameRoom.findMany({ where: { teacherId: { in: [teacherA.id, teacherB.id] } }, select: { id: true, teacherId: true } });
    for (const r of owned) await games.deleteGame(r.id, r.teacherId).catch(() => undefined);
    await prisma.teacher.deleteMany({ where: { id: { in: [teacherA.id, teacherB.id] } } });
    await app.close();
  });

  // ===== 1. AuthZ =====

  it('a participant of room A cannot answer a question of room B (404, nothing recorded)', async () => {
    const sqB = await currentQuestion(playerB.participantId, roomB.sessionId);
    const option = sqB.question.options.find((o) => o.isCorrect);
    const err = await scoring.submitAnswer(playerA.participantId, { sessionQuestionId: sqB.id, optionId: option?.id ?? '' }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'QUESTION_NOT_FOUND' });
    expect((err as { getStatus: () => number }).getStatus()).toBe(404);
    expect(await prisma.studentAnswer.count({ where: { participantId: playerA.participantId } })).toBe(0);
    expect(await prisma.studentAnswer.count({ where: { sessionQuestionId: sqB.id } })).toBe(0);

    // same over the socket – the ack carries the same code and no score
    const socket = connect({ token: playerA.sessionToken });
    await once(socket, 'connect');
    const ack = await emitAck(socket, 'answer:submit', { sessionQuestionId: sqB.id, optionId: option?.id });
    expect(ack).toEqual({ ok: false, error: { code: 'QUESTION_NOT_FOUND', message: expect.any(String) } });

    // a question from the player's own round that is not the current one → 400 WRONG_QUESTION
    const later = await prisma.sessionQuestion.findUniqueOrThrow({ where: { sessionId_index: { sessionId: roomA.sessionId, index: 3 } }, include: SESSION_QUESTION_INCLUDE });
    const own = await emitAck(socket, 'answer:submit', { sessionQuestionId: later.id, optionId: later.question.options[0]?.id });
    expect(own).toMatchObject({ ok: false, error: { code: 'WRONG_QUESTION' } });
    expect(await prisma.studentAnswer.count({ where: { participantId: playerA.participantId } })).toBe(0);
    socket.disconnect();
  });

  it('teacher B cannot read or act on teacher A’s room (403) – HTTP and socket', async () => {
    const b = teacherB.cookie;
    await api().get(`/api/games/${roomA.id}`).set('Cookie', b).expect(403);
    await api().post(`/api/games/${roomA.id}/pause`).set('Cookie', b).set(CSRF).expect(403);
    await api().post(`/api/games/${roomA.id}/finish`).set('Cookie', b).set(CSRF).expect(403);
    await api().delete(`/api/games/${roomA.id}/participants/${playerA.participantId}`).set('Cookie', b).set(CSRF).expect(403);
    await api().get(`/api/games/${roomA.id}/results`).set('Cookie', b).expect(403);
    await api().get(`/api/games/${roomA.id}/export?format=csv`).set('Cookie', b).expect(403);
    await api().delete(`/api/games/${roomA.id}`).set('Cookie', b).set(CSRF).expect(403);
    expect(await prisma.gameParticipant.findUnique({ where: { id: playerA.participantId } })).toMatchObject({ removedAt: null });

    const socket = connect({}, { Cookie: teacherB.cookie });
    await once(socket, 'connect');
    expect(await emitAck(socket, 'teacher:join', { roomId: roomA.id })).toMatchObject({ ok: false, error: { code: 'NOT_OWNER' } });
    expect(await emitAck(socket, 'teacher:join', { roomId: roomB.id })).toEqual({ ok: true, data: { ok: true } });
    // a teacher socket can never act as a player
    expect(await emitAck(socket, 'answer:submit', { sessionQuestionId: roomA.sessionId, optionId: roomA.sessionId })).toMatchObject({ ok: false, error: { code: 'UNAUTHORIZED' } });
    expect(await emitAck(socket, 'player:join', { sessionToken: playerA.sessionToken })).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
    socket.disconnect();
  });

  it('state-changing teacher routes require the CSRF header even with a valid cookie', async () => {
    await api().delete(`/api/games/${roomA.id}/participants/${playerA2.participantId}`).set('Cookie', teacherA.cookie).expect(403);
    await api().post(`/api/games/${roomA.id}/cancel`).set('Cookie', teacherA.cookie).expect(403);
    await api().delete(`/api/games/${roomA.id}`).set('Cookie', teacherA.cookie).expect(403);
    expect(await prisma.gameParticipant.findUnique({ where: { id: playerA2.participantId } })).toMatchObject({ removedAt: null });
    expect(await prisma.gameRoom.findUnique({ where: { id: roomA.id } })).not.toBeNull();
  });

  it('a removed participant loses every access path: open socket, HTTP token, socket reconnect, scoring', async () => {
    const socket = connect({ token: playerA2.sessionToken });
    await once(socket, 'connect');
    const disconnected = once(socket, 'disconnect');
    await api().delete(`/api/games/${roomA.id}/participants/${playerA2.participantId}`).set('Cookie', teacherA.cookie).set(CSRF).expect(200);
    await disconnected;

    await api().get('/api/player/session').set(SESSION_TOKEN_HEADER, playerA2.sessionToken).expect(401);
    await api().get('/api/player/progress').set(SESSION_TOKEN_HEADER, playerA2.sessionToken).expect(401);
    await expect(scoring.advance(playerA2.participantId)).rejects.toMatchObject({ code: 'NOT_IN_ROOM' });

    const again = connect({ token: playerA2.sessionToken });
    await once(again, 'disconnect');
    expect(again.connected).toBe(false);
  });

  // ===== 3. Information leakage =====

  it('never sends correctness to players before the question is closed; public room view has no names', async () => {
    const socket = connect({ token: playerA.sessionToken });
    await once(socket, 'connect');
    const session = (await api().get('/api/player/session').set(SESSION_TOKEN_HEADER, playerA.sessionToken).expect(200)).body as PlayerSession;
    expect(session.currentQuestion?.index).toBe(0);
    expect(JSON.stringify(session.currentQuestion)).not.toMatch(/isCorrect|correctOptionId|correctMatches/);
    const next = await emitAck<{ question: QuestionView | null }>(socket, 'question:next', { sessionQuestionId: 'not-current' }).catch(() => null);
    expect(next).toMatchObject({ ok: false, error: { code: 'INVALID_PAYLOAD' } });
    const current = await emitAck<{ question: QuestionView | null }>(socket, 'question:next', {});
    expect(current.ok).toBe(true);
    if (current.ok) expect(JSON.stringify(current.data.question)).not.toMatch(/isCorrect|correctOptionId|correctMatches/);

    const pub = (await api().get(`/api/rooms/${roomA.code}`).expect(200)).body as RoomPublicView;
    expect(JSON.stringify(pub)).not.toMatch(/אלון|בר|displayName|sessionToken/);
    socket.disconnect();
  });

  // ===== 2 + 5. Scoring payload whitelist / socket validation =====

  it('rejects socket payloads with unknown fields, non-uuid ids, oversized arrays or malformed tokens', async () => {
    const socket = connect({ token: playerA.sessionToken });
    await once(socket, 'connect');
    const sq = await currentQuestion(playerA.participantId, roomA.sessionId);
    const optionId = sq.question.options.find((o) => o.isCorrect)?.id ?? '';
    const invalid = { ok: false, error: { code: 'INVALID_PAYLOAD', message: expect.any(String) } };
    expect(await emitAck(socket, 'answer:submit', { sessionQuestionId: sq.id, optionId, score: 9999 })).toEqual(invalid);
    expect(await emitAck(socket, 'answer:submit', { sessionQuestionId: sq.id, optionId, elapsedMs: 0, isCorrect: true })).toEqual(invalid);
    expect(await emitAck(socket, 'answer:submit', { sessionQuestionId: sq.id, optionId: 'not-a-uuid' })).toEqual(invalid);
    expect(await emitAck(socket, 'answer:submit', { sessionQuestionId: sq.id, matches: Array.from({ length: 40 }, (_, i) => ({ cardA: `a${i}`, cardB: `b${i}` })) })).toEqual(invalid);
    expect(await emitAck(socket, 'answer:submit', 'garbage')).toEqual(invalid);
    expect(await emitAck(socket, 'question:next', { sessionQuestionId: sq.id, skip: true })).toEqual(invalid);
    expect(await emitAck(socket, 'player:join', { sessionToken: 'abc' })).toMatchObject({ ok: false, error: { code: 'INVALID_TOKEN' } });
    expect(await prisma.studentAnswer.count({ where: { participantId: playerA.participantId } })).toBe(0);

    // the legitimate shape still scores exactly once; a replay is a conflict
    const ack = await emitAck<{ scoreAwarded: number }>(socket, 'answer:submit', { sessionQuestionId: sq.id, optionId });
    expect(ack.ok).toBe(true);
    if (ack.ok) expect(ack.data.scoreAwarded).toBeGreaterThanOrEqual(100);
    expect(await emitAck(socket, 'answer:submit', { sessionQuestionId: sq.id, optionId })).toMatchObject({ ok: false, error: { code: 'ALREADY_ANSWERED' } });
    const progress = await prisma.participantProgress.findUniqueOrThrow({ where: { sessionId_participantId: { sessionId: roomA.sessionId, participantId: playerA.participantId } } });
    expect(progress.answeredCount).toBe(1);
    socket.disconnect();
  });

  // ===== 5. Request limits =====

  it('rejects oversized bodies (413) and malformed JSON (400) with Hebrew JSON errors – never 500', async () => {
    const big = { code: '123456', displayName: 'x'.repeat(70 * 1024), avatar: 'lion' };
    const res = await api().post('/api/rooms/join').send(big).expect(413);
    expect(res.body).toEqual({ statusCode: 413, message: 'הבקשה גדולה מדי', error: 'Payload Too Large' });
    const bad = await api().post('/api/rooms/join').set('Content-Type', 'application/json').send('{"code": ').expect(400);
    expect(bad.body.statusCode).toBe(400);
    expect(typeof bad.body.message).toBe('string');
    expect(bad.body.message).not.toMatch(/Unexpected|JSON/);
  });

  it('HTTP DTOs reject unknown (score-like) fields', async () => {
    const res = await api().post('/api/rooms/join').send({ code: roomA.code, displayName: 'דור', avatar: 'cat', score: 100 }).expect(400);
    expect(res.body.message).toContain('score');
  });

  // ===== 5. Room expiry =====

  it('rooms expire after 24h: lookup shows EXPIRED, joining/starting/new-round are refused, players see no question', async () => {
    const c = await games.createGame(teacherA.id, SETTINGS);
    const player = await rooms.join(c.code, 'דנה', 'panda');
    await prisma.gameRoom.update({ where: { id: c.roomId }, data: { expiresAt: new Date(Date.now() - 60_000) } });

    const session = (await api().get('/api/player/session').set(SESSION_TOKEN_HEADER, player.sessionToken).expect(200)).body as PlayerSession;
    expect(session.room.state).toBe(GameState.EXPIRED);
    expect(session.currentQuestion).toBeNull();

    const pub = (await api().get(`/api/rooms/${c.code}`).expect(200)).body as RoomPublicView;
    expect(pub.state).toBe(GameState.EXPIRED);
    expect(pub.joinOpen).toBe(false);
    expect(await prisma.gameRoom.findUniqueOrThrow({ where: { id: c.roomId } })).toMatchObject({ state: GameState.EXPIRED, joinOpen: false });
    expect(await prisma.gameSession.findUniqueOrThrow({ where: { id: c.currentSessionId as string } })).toMatchObject({ state: GameState.EXPIRED });

    const join = await api().post('/api/rooms/join').send({ code: c.code, displayName: 'מאחר', avatar: 'cat' }).expect(403);
    expect(join.body.error).toBe('ROOM_EXPIRED');
    await api().post(`/api/games/${c.roomId}/start`).set('Cookie', teacherA.cookie).set(CSRF).expect(409);
    const round = await api().post(`/api/games/${c.roomId}/new-round`).set('Cookie', teacherA.cookie).set(CSRF).expect(409);
    expect(round.body.error).toBe('ROOM_CLOSED');
    await expect(scoring.advance(player.participantId)).rejects.toMatchObject({ code: 'NOT_ACTIVE' });
    // results stay readable for the teacher
    await api().get(`/api/games/${c.roomId}/results`).set('Cookie', teacherA.cookie).expect(200);
  });

  it('the periodic sweep expires stale rooms that nobody accessed', async () => {
    const d = await games.createGame(teacherA.id, SETTINGS);
    await prisma.gameRoom.update({ where: { id: d.roomId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await games.sweepExpiredRooms()).toBeGreaterThanOrEqual(1);
    expect(await prisma.gameRoom.findUniqueOrThrow({ where: { id: d.roomId } })).toMatchObject({ state: GameState.EXPIRED, joinOpen: false });
    expect(await prisma.gameSession.findUniqueOrThrow({ where: { id: d.currentSessionId as string } })).toMatchObject({ state: GameState.EXPIRED });
    expect(await games.sweepExpiredRooms()).toBe(0);
    // live rooms are untouched
    expect(await prisma.gameRoom.findUniqueOrThrow({ where: { id: roomA.id } })).toMatchObject({ state: GameState.QUESTION_ACTIVE });
  });

  // ===== 4 + 6. Socket rate limits (last: they poison the limiter for this IP) =====

  it('throttles game events per socket', async () => {
    const socket = connect({ token: playerA.sessionToken });
    await once(socket, 'connect');
    const acks = await Promise.all(Array.from({ length: SOCKET_EVENT_LIMIT.limit + 5 }, () => emitAck(socket, 'question:next', {})));
    expect(acks.filter((a) => !a.ok && a.error.code === 'RATE_LIMITED').length).toBeGreaterThanOrEqual(5);
    expect(acks.filter((a) => a.ok).length).toBeLessThanOrEqual(SOCKET_EVENT_LIMIT.limit);
    socket.disconnect();
  });

  it('refuses handshakes from an IP after repeated authentication failures', async () => {
    for (let i = 0; i < AUTH_FAILURE_LIMIT.limit; i += 1) {
      const s = connect({ token: generateSessionToken() }); // well-formed, unknown
      await once(s, 'disconnect');
    }
    const blocked = connect({ token: playerA.sessionToken }); // even a valid token is refused now
    const err = await once<Error>(blocked, 'connect_error');
    expect(err.message).toBe('TOO_MANY_AUTH_FAILURES');
    expect(blocked.connected).toBe(false);
  });

  // ===== 5. HTTP throttling (last: consumes the per-IP budget) =====

  it('throttles room lookups and joins per IP', async () => {
    const lookups = await Promise.all(Array.from({ length: ROOM_LOOKUP_RATE_LIMIT_PER_MINUTE + 5 }, () => api().get('/api/rooms/999999')));
    expect(lookups.filter((r) => r.status === 429).length).toBeGreaterThanOrEqual(5);
    expect(lookups.filter((r) => r.status === 404).length).toBeLessThanOrEqual(ROOM_LOOKUP_RATE_LIMIT_PER_MINUTE);
    const throttled = lookups.find((r) => r.status === 429);
    expect(throttled?.body).toEqual({ statusCode: 429, message: 'יותר מדי בקשות, נסו שוב בעוד רגע', error: 'Too Many Requests' });

    const joins = await Promise.all(Array.from({ length: JOIN_RATE_LIMIT_PER_MINUTE + 5 }, () => api().post('/api/rooms/join').send({ code: '999999', displayName: 'נועם', avatar: 'cat' })));
    expect(joins.filter((r) => r.status === 429).length).toBeGreaterThanOrEqual(5);
  });
});
