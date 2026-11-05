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

const ok = <T>(data: T): SocketAck<T> => ({ ok: true, data });
const fail = <T>(err: unknown): SocketAck<T> => ({ ok: false, error: toSocketError(err) });
const UNAUTHORIZED_ACK = { ok: false as const, error: { code: 'UNAUTHORIZED', message: 'נדרשת הצטרפות לחדר' } };
const RATE_LIMITED_ACK = { ok: false as const, error: { code: 'RATE_LIMITED', message: 'יותר מדי פעולות, נסו שוב בעוד רגע' } };

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
  private readonly events_ = new FixedWindowRateLimiter({ ...SOCKET_EVENT_LIMIT, maxKeys: 50_000 });

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
    // Handshake-level protection: runs before `connection`, so a reconnect storm never reaches the DB.
    server.use((socket, next) => {
      const ip = this.clientIp(socket);
      if (!this.handshakes.hit(ip)) return next(new Error('RATE_LIMITED'));
      if (this.authFailures.count(ip) >= AUTH_FAILURE_LIMIT.limit) return next(new Error('TOO_MANY_AUTH_FAILURES'));
      return next();
    });
  }

  async handleConnection(socket: GameSocket): Promise<void> {
    try {
      const auth = socket.handshake.auth as { token?: unknown };
      if (auth.token !== undefined) {
        // A token was presented: it must be well-formed and resolve to a live participant.
        const attached = isSessionTokenFormat(auth.token) && (await this.attachPlayer(socket, auth.token));
        if (!attached) this.rejectConnection(socket, 'ההתחברות לא נמצאה, הצטרפו מחדש');
        return;
      }
      const teacher = await extractTeacherFromCookieHeader(socket.handshake.headers.cookie, this.jwt);
      if (teacher) {
        socket.data.role = 'teacher';
        socket.data.teacherId = teacher.sub;
        return;
      }
      this.rejectConnection(socket, 'נדרשת התחברות');
    } catch (err) {
      // Never log the handshake itself (it carries the token/cookie); the error text is enough.
      this.logger.warn(`connection rejected: ${errorSummary(err)}`);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: GameSocket): Promise<void> {
    this.events_.forget(socket.id);
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
      const attached = await this.attachPlayer(socket, token);
      if (!attached) {
        this.authFailures.hit(this.clientIp(socket));
        return { ok: false, error: { code: 'UNAUTHORIZED', message: 'ההתחברות לא נמצאה, הצטרפו מחדש' } };
      }
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

  // ===== עזר =====

  private requirePlayer(socket: GameSocket): string | null {
    return socket.data.role === 'player' && socket.data.participantId ? socket.data.participantId : null;
  }

  private allowEvent(socket: GameSocket): boolean {
    return this.events_.hit(socket.id);
  }

  private clientIp(socket: Socket): string {
    return socketClientIp(socket.handshake, this.config.trustProxyHops);
  }

  private rejectConnection(socket: GameSocket, message: string): void {
    this.authFailures.hit(this.clientIp(socket));
    socket.emit('error:message', { code: 'UNAUTHORIZED', message });
    socket.disconnect(true);
  }

  /** מצמיד socket למשתתף לפי session token (hash), מסמן מחובר ומצרף לחדרים */
  private async attachPlayer(socket: GameSocket, token: string): Promise<boolean> {
    const participant = await this.prisma.gameParticipant.findFirst({
      where: { sessionTokenHash: hashSessionToken(token), removedAt: null, room: { deletedAt: null } },
      include: { student: { select: { displayName: true } } },
    });
    if (!participant) return false;
    socket.data.role = 'player';
    socket.data.participantId = participant.id;
    socket.data.roomId = participant.roomId;
    await socket.join([roomChannel(participant.roomId), participantChannel(participant.id)]);
    await this.prisma.gameParticipant.update({ where: { id: participant.id }, data: { connected: true, lastSeenAt: new Date() } });
    const snap = await this.rooms.emitRoomUpdated(participant.roomId);
    this.events.toRoom(participant.roomId, 'player:connected', {
      participantId: participant.id,
      displayName: participant.student.displayName,
      participantCount: snap?.participants.length ?? 0,
    });
    return true;
  }
}

/** Error text for logs – class name + message only, never the stack of a handshake error (could include headers). */
function errorSummary(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return typeof err === 'string' ? err : 'unknown error';
}
