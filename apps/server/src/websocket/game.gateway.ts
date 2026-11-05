import { Logger } from '@nestjs/common';
import {
  ConnectedSocket, MessageBody, type OnGatewayConnection, type OnGatewayDisconnect, type OnGatewayInit,
  SubscribeMessage, WebSocketGateway, WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';
import type { AnswerPayload, AnswerResult, ClientToServerEvents, QuestionView, ServerToClientEvents, SocketAck, SocketData } from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hashSessionToken } from '../players/player-token';
import { extractTeacherFromCookieHeader } from '../auth/teacher-cookie';
import { ScoringService } from '../scoring/scoring.service';
import { RoomsService } from '../rooms/rooms.service';
import { toSocketError } from '../games/game-error';
import { GameEventsService, participantChannel, roomChannel, teacherChannel, type GameServer, type InterServerEvents } from './game-events.service';
import { corsOriginsFromEnv } from './cors';

export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const ok = <T>(data: T): SocketAck<T> => ({ ok: true, data });
const fail = <T>(err: unknown): SocketAck<T> => ({ ok: false, error: toSocketError(err) });

@WebSocketGateway({
  path: '/socket.io',
  cors: { origin: corsOriginsFromEnv(), credentials: true },
})
export class GameGateway implements OnGatewayInit<GameServer>, OnGatewayConnection<GameSocket>, OnGatewayDisconnect<GameSocket> {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: GameServer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: GameEventsService,
    private readonly jwt: JwtService,
    private readonly scoring: ScoringService,
    private readonly rooms: RoomsService,
  ) {}

  afterInit(server: GameServer): void {
    this.events.setServer(server);
  }

  async handleConnection(socket: GameSocket): Promise<void> {
    try {
      const auth = socket.handshake.auth as { token?: unknown };
      if (typeof auth.token === 'string' && auth.token.length > 0 && auth.token.length <= 128) {
        const attached = await this.attachPlayer(socket, auth.token);
        if (!attached) {
          socket.emit('error:message', { code: 'UNAUTHORIZED', message: 'ההתחברות לא נמצאה, הצטרפו מחדש' });
          socket.disconnect(true);
        }
        return;
      }
      const teacher = await extractTeacherFromCookieHeader(socket.handshake.headers.cookie, this.jwt);
      if (teacher) {
        socket.data.role = 'teacher';
        socket.data.teacherId = teacher.sub;
        return;
      }
      socket.emit('error:message', { code: 'UNAUTHORIZED', message: 'נדרשת התחברות' });
      socket.disconnect(true);
    } catch (err) {
      this.logger.warn(`connection rejected: ${String(err)}`);
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: GameSocket): Promise<void> {
    const { participantId, roomId } = socket.data;
    if (socket.data.role !== 'player' || !participantId || !roomId) return;
    try {
      const remaining = await this.server.in(participantChannel(participantId)).fetchSockets();
      if (remaining.length > 0) return; // חיבור נוסף של אותו תלמיד עדיין פתוח
      await this.prisma.gameParticipant.updateMany({ where: { id: participantId }, data: { connected: false, lastSeenAt: new Date() } });
      const snap = await this.rooms.emitRoomUpdated(roomId);
      this.events.toRoom(roomId, 'player:disconnected', { participantId, participantCount: snap?.participants.length ?? 0 });
    } catch (err) {
      this.logger.warn(`disconnect handling failed: ${String(err)}`);
    }
  }

  @SubscribeMessage('player:join')
  async playerJoin(@ConnectedSocket() socket: GameSocket, @MessageBody() body: { sessionToken?: unknown }): Promise<SocketAck<{ ok: true }>> {
    try {
      if (socket.data.role === 'player' && socket.data.participantId) return ok({ ok: true });
      const token = body?.sessionToken;
      if (typeof token !== 'string' || token.length === 0 || token.length > 128) throw new Error('bad token');
      const attached = await this.attachPlayer(socket, token);
      if (!attached) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'ההתחברות לא נמצאה, הצטרפו מחדש' } };
      return ok({ ok: true });
    } catch (err) {
      return fail(err);
    }
  }

  @SubscribeMessage('answer:submit')
  async answerSubmit(@ConnectedSocket() socket: GameSocket, @MessageBody() payload: AnswerPayload): Promise<SocketAck<AnswerResult>> {
    const participantId = this.requirePlayer(socket);
    if (!participantId) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'נדרשת הצטרפות לחדר' } };
    try {
      return ok(await this.scoring.submitAnswer(participantId, payload));
    } catch (err) {
      return fail(err);
    }
  }

  @SubscribeMessage('question:next')
  async questionNext(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() body: { sessionQuestionId?: unknown },
  ): Promise<SocketAck<{ question: QuestionView | null; finished: boolean }>> {
    const participantId = this.requirePlayer(socket);
    if (!participantId) return { ok: false, error: { code: 'UNAUTHORIZED', message: 'נדרשת הצטרפות לחדר' } };
    try {
      const sqId = typeof body?.sessionQuestionId === 'string' ? body.sessionQuestionId : undefined;
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
  async teacherJoin(@ConnectedSocket() socket: GameSocket, @MessageBody() body: { roomId?: unknown }): Promise<SocketAck<{ ok: true }>> {
    if (socket.data.role !== 'teacher' || !socket.data.teacherId) {
      return { ok: false, error: { code: 'UNAUTHORIZED', message: 'נדרשת התחברות מורה' } };
    }
    const roomId = typeof body?.roomId === 'string' ? body.roomId : '';
    const room = await this.prisma.gameRoom.findFirst({ where: { id: roomId, deletedAt: null }, select: { id: true, teacherId: true } });
    if (!room) return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: 'החדר לא נמצא' } };
    if (room.teacherId !== socket.data.teacherId) return { ok: false, error: { code: 'NOT_OWNER', message: 'אין לך הרשאה לחדר זה' } };
    socket.data.roomId = room.id;
    await socket.join([roomChannel(room.id), teacherChannel(room.id)]);
    return ok({ ok: true });
  }

  private requirePlayer(socket: GameSocket): string | null {
    return socket.data.role === 'player' && socket.data.participantId ? socket.data.participantId : null;
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
