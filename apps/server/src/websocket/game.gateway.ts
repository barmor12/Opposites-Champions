import { Logger } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, type OnGatewayConnection, type OnGatewayDisconnect, type OnGatewayInit,
  SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { AnswerResult, ClientToServerEvents, QuestionView, ServerToClientEvents, SocketAck, SocketData } from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { hashSessionToken, isSessionTokenFormat } from '../players/player-token';
import { extractTeacherFromCookieHeader } from '../auth/teacher-cookie';
import { ScoringService } from '../scoring/scoring.service';
import { RoomsService } from '../rooms/rooms.service';
import { toSocketError } from '../games/game-error';
import { GameEventsService, participantChannel, roomChannel, teacherChannel, type GameServer, type InterServerEvents } from './game-events.service';
import { corsOriginsFromEnv } from './cors';
import { parseAnswerPayload, parseQuestionNextPayload, parseRoomIdPayload, parseSessionTokenPayload } from './socket-payloads';
import { FixedWindowRateLimiter, socketClientIp } from './socket-rate-limiter';

export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

interface LiveParticipant {
  id: string;
  roomId: string;
  displayName: string;
}

const ok = <T>(data: T): SocketAck<T> => ({ ok: true, data });
const fail = <T>(err: unknown): SocketAck<T> => ({ ok: false, error: toSocketError(err) });
const UNAUTHORIZED_ACK = { ok: false as const, error: { code: 'UNAUTHORIZED', message: 'נדרשת הצטרפות לחדר' } };
const RATE_LIMITED_ACK = { ok: false as const, error: { code: 'RATE_LIMITED', message: 'יותר מדי פעולות, נסו שוב בעוד רגע' } };
const PLAYER_NOT_FOUND = 'ההתחברות לא נמצאה, הצטרפו מחדש';

/** Largest legitimate socket message is an answer with a few matches (<1KB); 16KB leaves generous slack. */
export const SOCKET_MAX_PAYLOAD_BYTES = 16 * 1024;
/** Handshakes per client IP per window – a whole class behind one NAT reconnecting at once still fits. */
export const HANDSHAKE_LIMIT = { limit: 100, windowMs: 10_000 } as const;
/** Failed socket authentications per IP per window before further handshakes are refused outright. */
export const AUTH_FAILURE_LIMIT = { limit: 20, windowMs: 60_000 } as const;
/** Game events per socket per window (answer/next/join); time:ping is exempt (no DB work). */
export const SOCKET_EVENT_LIMIT = { limit: 60, windowMs: 10_000 } as const;

@WebSocketGateway({
  path: '/socket.io',
  cors: { origin: corsOriginsFromEnv(), credentials: true },
  maxHttpBufferSize: SOCKET_MAX_PAYLOAD_BYTES,
})
export class GameGateway implements OnGatewayInit<GameServer>, OnGatewayConnection<GameSocket>, OnGatewayDisconnect<GameSocket> {
  private readonly logger = new Logger(GameGateway.name);
  private readonly handshakes = new FixedWindowRateLimiter(HANDSHAKE_LIMIT);
  private readonly authFailures = new FixedWindowRateLimiter(AUTH_FAILURE_LIMIT);
  private readonly eventBudget = new FixedWindowRateLimiter({ ...SOCKET_EVENT_LIMIT, maxKeys: 50_000 });
  /** Set by the handshake middleware; consumed once in handleConnection. WeakMap → nothing to clean up. */
  private readonly rejected = new WeakMap<Socket, string>();
  private readonly pendingAnnounce = new WeakMap<Socket, LiveParticipant>();

  @WebSocketServer()
  server!: GameServer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: GameEventsService,
    private readonly jwt: JwtService,
    private readonly scoring: ScoringService,
    private readonly rooms: RoomsService,
    private readonly config: AppConfigService,
  ) {}

  afterInit(server: GameServer): void {
    this.events.setServer(server);
    /**
     * Authentication runs as a Socket.IO middleware: it completes BEFORE the CONNECT packet is sent,
     * so `socket.data.role` is always settled when the first event arrives (no race with handleConnection).
     * Invalid credentials are not refused here (the client would only see connect_error); the socket is
     * accepted, told why, and disconnected in handleConnection. Rate limits are enforced here, before any DB work.
     */
    server.use((socket, next) => {
      this.authenticate(socket)
        .then(() => next())
        .catch((err: unknown) => next(err instanceof Error ? err : new Error('UNAUTHORIZED')));
    });
  }

  async handleConnection(socket: GameSocket): Promise<void> {
    const reason = this.rejected.get(socket);
    if (reason) {
      this.rejected.delete(socket);
      this.rejectConnection(socket, reason);
      return;
    }
    const participant = this.pendingAnnounce.get(socket);
    if (!participant) return; // teacher – joins rooms explicitly via teacher:join
    this.pendingAnnounce.delete(socket);
    try {
      await this.announcePlayer(participant);
    } catch (err) {
      this.logger.warn(`player connect bookkeeping failed: ${errorSummary(err)}`);
    }
  }

  async handleDisconnect(socket: GameSocket): Promise<void> {
    this.eventBudget.forget(socket.id);
    const { participantId, roomId } = socket.data;
    if (socket.data.role !== 'player' || !participantId || !roomId) return;
    try {
      const remaining = await this.server.in(participantChannel(participantId)).fetchSockets();
      if (remaining.length > 0) return; // חיבור נוסף של אותו תלמיד עדיין פתוח
      await this.prisma.gameParticipant.updateMany({ where: { id: participantId }, data: { connected: false, lastSeenAt: new Date() } });
      const snap = await this.rooms.emitRoomUpdated(roomId);
      this.events.toRoom(roomId, 'player:disconnected', { participantId, participantCount: snap?.participants.length ?? 0 });
    } catch (err) {
      this.logger.warn(`disconnect handling failed: ${errorSummary(err)}`);
    }
  }

  @SubscribeMessage('player:join')
  async playerJoin(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Promise<SocketAck<{ ok: true }>> {
    if (!this.allowEvent(socket)) return RATE_LIMITED_ACK;
    try {
      if (socket.data.role === 'player' && socket.data.participantId) return ok({ ok: true });
      if (socket.data.role === 'teacher') return { ok: false, error: { code: 'FORBIDDEN', message: 'חיבור מורה אינו יכול להצטרף כתלמיד' } };
      const token = parseSessionTokenPayload(body);
      const participant = await this.findParticipant(token);
      if (!participant) {
        this.authFailures.hit(this.clientIp(socket));
        return { ok: false, error: { code: 'UNAUTHORIZED', message: PLAYER_NOT_FOUND } };
      }
      await this.bindPlayer(socket, participant);
      await this.announcePlayer(participant);
      return ok({ ok: true });
    } catch (err) {
      return fail(err);
    }
  }

  @SubscribeMessage('answer:submit')
  async answerSubmit(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Promise<SocketAck<AnswerResult>> {
    const participantId = this.requirePlayer(socket);
    if (!participantId) return UNAUTHORIZED_ACK;
    if (!this.allowEvent(socket)) return RATE_LIMITED_ACK;
    try {
      const payload = parseAnswerPayload(body);
      return ok(await this.scoring.submitAnswer(participantId, payload));
    } catch (err) {
      return fail(err);
    }
  }

  @SubscribeMessage('question:next')
  async questionNext(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() body: unknown,
  ): Promise<SocketAck<{ question: QuestionView | null; finished: boolean }>> {
    const participantId = this.requirePlayer(socket);
    if (!participantId) return UNAUTHORIZED_ACK;
    if (!this.allowEvent(socket)) return RATE_LIMITED_ACK;
    try {
      const sqId = parseQuestionNextPayload(body);
      return ok(await this.scoring.advance(participantId, sqId));
    } catch (err) {
      return fail(err);
    }
  }

  @SubscribeMessage('time:ping')
  timePing(): number {
    return Date.now();
  }

  @SubscribeMessage('teacher:join')
  async teacherJoin(@ConnectedSocket() socket: GameSocket, @MessageBody() body: unknown): Promise<SocketAck<{ ok: true }>> {
    if (socket.data.role !== 'teacher' || !socket.data.teacherId) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'נדרשת התחברות מורה' } };
    }
    if (!this.allowEvent(socket)) return RATE_LIMITED_ACK;
    try {
      const roomId = parseRoomIdPayload(body);
      // The JWT alone is not enough: the teacher must still exist (not soft-deleted) and own the room.
      const [teacher, room] = await Promise.all([
        this.prisma.teacher.findFirst({ where: { id: socket.data.teacherId, deletedAt: null }, select: { id: true } }),
        this.prisma.gameRoom.findFirst({ where: { id: roomId, deletedAt: null }, select: { id: true, teacherId: true } }),
      ]);
      if (!teacher) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'נדרשת התחברות מורה' } };
      if (!room) return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'החדר לא נמצא' } };
      if (room.teacherId !== teacher.id) return { ok: false, error: { code: 'NOT_OWNER', message: 'אין לך הרשאה לחדר זה' } };
      socket.data.roomId = room.id;
      await socket.join([roomChannel(room.id), teacherChannel(room.id)]);
      return ok({ ok: true });
    } catch (err) {
      return fail(err);
    }
  }

  // ===== אימות בזמן handshake =====

  private async authenticate(socket: GameSocket): Promise<void> {
    const ip = this.clientIp(socket);
    if (!this.handshakes.hit(ip)) throw new Error('RATE_LIMITED');
    if (this.authFailures.count(ip) >= AUTH_FAILURE_LIMIT.limit) throw new Error('TOO_MANY_AUTH_FAILURES');

    const auth = socket.handshake.auth as { token?: unknown };
    if (auth.token !== undefined) {
      // A token was presented: it must be well-formed and resolve to a live participant of a live room.
      const participant = isSessionTokenFormat(auth.token) ? await this.findParticipant(auth.token) : null;
      if (!participant) {
        this.rejected.set(socket, PLAYER_NOT_FOUND);
        return;
      }
      await this.bindPlayer(socket, participant);
      this.pendingAnnounce.set(socket, participant);
      return;
    }
    const teacher = await extractTeacherFromCookieHeader(socket.handshake.headers.cookie, this.jwt);
    if (teacher) {
      socket.data.role = 'teacher';
      socket.data.teacherId = teacher.sub;
      return;
    }
    this.rejected.set(socket, 'נדרשת התחברות');
  }

  // ===== עזר =====

  private requirePlayer(socket: GameSocket): string | null {
    return socket.data.role === 'player' && socket.data.participantId ? socket.data.participantId : null;
  }

  private allowEvent(socket: GameSocket): boolean {
    return this.eventBudget.hit(socket.id);
  }

  private clientIp(socket: Socket): string {
    return socketClientIp(socket.handshake, this.config.trustProxyHops);
  }

  private rejectConnection(socket: GameSocket, message: string): void {
    this.authFailures.hit(this.clientIp(socket));
    socket.emit('error:message', { code: 'UNAUTHORIZED', message });
    socket.disconnect(true);
  }

  /** משתתף חי לפי session token (hash בלבד) – לא הוסר, והחדר לא נמחק */
  private async findParticipant(token: string): Promise<LiveParticipant | null> {
    const participant = await this.prisma.gameParticipant.findFirst({
      where: { sessionTokenHash: hashSessionToken(token), removedAt: null, room: { deletedAt: null } },
      select: { id: true, roomId: true, student: { select: { displayName: true } } },
    });
    return participant ? { id: participant.id, roomId: participant.roomId, displayName: participant.student.displayName } : null;
  }

  /** מצמיד socket למשתתף ומצרף לערוצי החדר/המשתתף (סינכרוני מבחינת socket.data) */
  private async bindPlayer(socket: GameSocket, participant: LiveParticipant): Promise<void> {
    socket.data.role = 'player';
    socket.data.participantId = participant.id;
    socket.data.roomId = participant.roomId;
    await socket.join([roomChannel(participant.roomId), participantChannel(participant.id)]);
  }

  /** מסמן מחובר ומשדר לחדר (player:connected + room:updated) */
  private async announcePlayer(participant: LiveParticipant): Promise<void> {
    await this.prisma.gameParticipant.update({ where: { id: participant.id }, data: { connected: true, lastSeenAt: new Date() } });
    const snap = await this.rooms.emitRoomUpdated(participant.roomId);
    this.events.toRoom(participant.roomId, 'player:connected', {
      participantId: participant.id,
      displayName: participant.displayName,
      participantCount: snap?.participants.length ?? 0,
    });
  }
}

/** Error text for logs – class name + message only, never a stack that could carry handshake headers. */
function errorSummary(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return typeof err === 'string' ? err : 'unknown error';
}
