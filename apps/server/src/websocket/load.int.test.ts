import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import {
  Category, GameMode, QuestionType, type AnswerResult, type ClientToServerEvents, type GameSettings, type JoinRoomResponse,
  type Leaderboard, type QuestionView, type ServerToClientEvents, type SocketAck,
} from '@oc/shared';
import { AppConfigModule } from '../config/app-config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { setupApp } from '../app.setup';
import { TEACHER_COOKIE } from '../auth/teacher-auth.guard';
import { GameFeatureModule } from '../games/game-feature.module';
import { GamesService } from '../games/games.service';
import { RoomsService } from '../rooms/rooms.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { COUNTDOWN_MS } from '../games/game-constants';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const PLAYERS = 40;
const SETTINGS: GameSettings = {
  className: 'עומס', questionCount: 10, difficulty: 'MIXED', categories: Object.values(Category), timePerQuestionSec: 20,
  questionTypes: [QuestionType.CHOOSE_OPPOSITE, QuestionType.COMPLETE_SENTENCE], mode: GameMode.SELF_PACED,
  competitionEnabled: true, showLeaderboard: true, showCorrectAnswers: true, soundsEnabled: true, treasureChallenge: false,
};

function once<T>(socket: ClientSocket, event: keyof ServerToClientEvents, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${String(event)}`)), timeoutMs);
    socket.once(event as 'question:started', ((payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    }) as never);
  });
}

function emitAck<T>(socket: ClientSocket, event: 'answer:submit' | 'question:next', payload: unknown): Promise<SocketAck<T>> {
  return new Promise((resolve) => {
    (socket as Socket).emit(event, payload, (ack: SocketAck<T>) => resolve(ack));
  });
}

describe('socket load (integration): 40 players join and answer concurrently', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let games: GamesService;
  let teacherId: string;
  let roomId: string;
  let sessionId: string;
  let url: string;
  let teacherCookie: string;
  const sockets: ClientSocket[] = [];
  let teacherSocket: ClientSocket | null = null;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppConfigModule, PrismaModule, GameFeatureModule] }).compile();
    app = moduleRef.createNestApplication();
    setupApp(app, { corsOrigins: ['http://localhost:5173'], cookieSecret: 'int-test-cookie-secret-32-chars-long!!', isProd: false, http: false });
    await app.init();
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    url = `http://127.0.0.1:${address.port}`;
    prisma = app.get(PrismaService);
    games = app.get(GamesService);
    await prisma.teacher.deleteMany({ where: { email: 'load-int@example.com' } });
    const teacher = await prisma.teacher.create({ data: { email: 'load-int@example.com', name: 'מורה עומס', passwordHash: 'x' } });
    teacherId = teacher.id;
    teacherCookie = `${TEACHER_COOKIE}=${await app.get(JwtService).signAsync({ sub: teacher.id, email: teacher.email, name: teacher.name })}`;
    const summary = await games.createGame(teacherId, SETTINGS);
    roomId = summary.roomId;
    sessionId = summary.currentSessionId as string;
  });

  afterAll(async () => {
    for (const s of sockets) s.disconnect();
    teacherSocket?.disconnect();
    if (roomId) await games.deleteGame(roomId, teacherId).catch(() => undefined);
    await prisma.teacher.deleteMany({ where: { id: teacherId } });
    await app.close();
  });

  it('runs the whole flow for 40 concurrent players', async () => {
    const rooms = app.get(RoomsService);
    const room = await prisma.gameRoom.findUniqueOrThrow({ where: { id: roomId } });
    const joined: JoinRoomResponse[] = await Promise.all(
      Array.from({ length: PLAYERS }, (_, i) => rooms.join(room.code, `תלמיד ${i + 1}`, 'fox')),
    );
    expect(new Set(joined.map((j) => j.participantId)).size).toBe(PLAYERS);

    // חיבור 40 sockets במקביל
    await Promise.all(joined.map((j) => new Promise<void>((resolve, reject) => {
      const socket: ClientSocket = io(url, { path: '/socket.io', transports: ['websocket'], auth: { token: j.sessionToken }, forceNew: true });
      sockets.push(socket);
      socket.once('connect', () => resolve());
      socket.once('connect_error', (err) => reject(err));
    })));
    expect(sockets.every((s) => s.connected)).toBe(true);

    // socket ללא token נדחה
    const rejected = io(url, { path: '/socket.io', transports: ['websocket'], auth: { token: 'invalid' }, forceNew: true });
    await new Promise<void>((resolve) => rejected.once('disconnect', () => resolve()));
    expect(rejected.connected).toBe(false);

    // המורה מתחברת דרך cookie ומצטרפת לחדר
    teacherSocket = io(url, { path: '/socket.io', transports: ['websocket'], extraHeaders: { Cookie: teacherCookie }, forceNew: true });
    await new Promise<void>((resolve, reject) => {
      teacherSocket?.once('connect', () => resolve());
      teacherSocket?.once('connect_error', (err) => reject(err));
    });
    const teacherAck = await new Promise<SocketAck<{ ok: true }>>((resolve) => {
      (teacherSocket as Socket).emit('teacher:join', { roomId }, (ack: SocketAck<{ ok: true }>) => resolve(ack));
    });
    expect(teacherAck.ok).toBe(true);

    const connected = await prisma.gameParticipant.count({ where: { roomId, connected: true } });
    expect(connected).toBe(PLAYERS);

    // התחלה: כל socket מקבל question:started משלו אחרי הספירה לאחור
    const firstQuestions = sockets.map((s) => once<QuestionView>(s, 'question:started', COUNTDOWN_MS + 10_000));
    const teacherBoard = once<Leaderboard>(teacherSocket, 'leaderboard:updated', COUNTDOWN_MS + 20_000);
    await games.start(roomId, teacherId);
    const views = await Promise.all(firstQuestions);
    expect(views.every((v) => v.index === 0 && v.options.length === 4)).toBe(true);
    expect(JSON.stringify(views[0])).not.toContain('isCorrect');

    // כולם עונים במקביל על השאלה הראשונה
    const acks = await Promise.all(views.map((v, i) => emitAck<AnswerResult>(sockets[i] as ClientSocket, 'answer:submit', { sessionQuestionId: v.sessionQuestionId, optionId: v.options[i % 4]?.id })));
    expect(acks.every((a) => a.ok)).toBe(true);
    const results = acks.map((a) => (a.ok ? a.data : null));
    expect(results.every((r) => r !== null && r.sessionQuestionId === views[0]?.sessionQuestionId && typeof r.totalScore === 'number')).toBe(true);

    // תשובה כפולה נדחית ב־ack
    const dup = await emitAck<AnswerResult>(sockets[0] as ClientSocket, 'answer:submit', { sessionQuestionId: views[0]?.sessionQuestionId, optionId: views[0]?.options[0]?.id });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error.code).toBe('ALREADY_ANSWERED');

    // מעבר לשאלה הבאה
    const nexts = await Promise.all(views.map((v, i) => emitAck<{ question: QuestionView | null; finished: boolean }>(sockets[i] as ClientSocket, 'question:next', { sessionQuestionId: v.sessionQuestionId })));
    expect(nexts.every((n) => n.ok && n.data.question?.index === 1 && !n.data.finished)).toBe(true);

    // לוח התוצאות: 40 רשומות
    const board = await app.get(LeaderboardService).compute(sessionId);
    expect(board.entries).toHaveLength(PLAYERS);
    expect(board.entries.every((e) => e.answeredCount === 1)).toBe(true);
    const broadcasted = await teacherBoard;
    expect(broadcasted.gameSessionId).toBe(sessionId);
    expect(broadcasted.entries.length).toBeGreaterThan(0);

    // ניתוק משתתף מעדכן connected
    const victim = sockets[5] as ClientSocket;
    const victimId = joined[5]?.participantId ?? '';
    const disconnected = once<{ participantId: string }>(sockets[0] as ClientSocket, 'player:disconnected');
    victim.disconnect();
    expect((await disconnected).participantId).toBe(victimId);
    const after = await prisma.gameParticipant.findUniqueOrThrow({ where: { id: victimId } });
    expect(after.connected).toBe(false);
  }, 60_000);
});
