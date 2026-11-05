import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { Prisma, type GameRoom, type GameSession } from '@prisma/client';
import {
  GameMode, GameState, MAX_PLAYERS_PER_ROOM, ROOM_CODE_LENGTH, isJoinable, nameKey, validateDisplayName,
  type AvatarId, type GameSettings, type JoinRoomResponse, type ParticipantView, type RoomPublicView,
} from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { generateSessionToken, hashSessionToken } from '../players/player-token';
import { GameEventsService } from '../websocket/game-events.service';
import { GameError } from '../games/game-error';
import { settingsToJson } from '../games/settings';
import { toParticipantView, toRoomPublicView } from './room-views';

export interface RoomSnapshot {
  room: RoomPublicView;
  participants: ParticipantView[];
}

const CODE_MAX_ATTEMPTS = 12;

/** האם קוד "רציף" או "משעמם" מדי (123456, 654321, 111111, 000000) */
export function isWeakCode(code: string): boolean {
  if (/^(\d)\1+$/.test(code)) return true;
  let asc = true;
  let desc = true;
  for (let i = 1; i < code.length; i += 1) {
    const prev = Number(code[i - 1]);
    const cur = Number(code[i]);
    if (cur !== (prev + 1) % 10) asc = false;
    if (cur !== (prev + 9) % 10) desc = false;
  }
  return asc || desc;
}

export function generateRoomCode(): string {
  let code = '';
  do {
    code = String(randomInt(0, 10 ** ROOM_CODE_LENGTH)).padStart(ROOM_CODE_LENGTH, '0');
  } while (isWeakCode(code));
  return code;
}

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(private readonly prisma: PrismaService, private readonly events: GameEventsService) {}

  /** יוצר חדר חדש עם קוד ייחודי בן 6 ספרות (ניסיון חוזר בהתנגשות) */
  async createRoom(teacherId: string, settings: GameSettings): Promise<GameRoom> {
    for (let attempt = 0; attempt < CODE_MAX_ATTEMPTS; attempt += 1) {
      const code = generateRoomCode();
      try {
        return await this.prisma.gameRoom.create({
          data: {
            code,
            teacherId,
            className: settings.className,
            state: GameState.WAITING_FOR_PLAYERS,
            joinOpen: true,
            settings: settingsToJson(settings),
            mode: settings.mode === GameMode.TEACHER_PACED ? GameMode.TEACHER_PACED : GameMode.SELF_PACED,
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          this.logger.warn(`room code collision (${code}), retrying`);
          continue;
        }
        throw err;
      }
    }
    throw GameError.conflict('CODE_GENERATION_FAILED', 'לא הצלחנו ליצור קוד חדר, נסו שוב');
  }

  async findByCode(code: string): Promise<GameRoom | null> {
    return this.prisma.gameRoom.findFirst({ where: { code, deletedAt: null } });
  }

  async getPublicView(code: string): Promise<RoomPublicView> {
    const room = await this.findByCode(code);
    if (!room) throw GameError.notFound('ROOM_NOT_FOUND', 'החדר לא נמצא, בדקו את הקוד');
    const [session, participantCount] = await Promise.all([
      this.currentSession(room),
      this.prisma.gameParticipant.count({ where: { roomId: room.id, removedAt: null } }),
    ]);
    return toRoomPublicView(room, session, participantCount);
  }

  async currentSession(room: GameRoom): Promise<GameSession | null> {
    if (!room.currentSessionId) return null;
    return this.prisma.gameSession.findUnique({ where: { id: room.currentSessionId } });
  }

  /** צילום מצב מלא של החדר (לתצוגת המורה ולאירוע room:updated) */
  async snapshot(roomId: string): Promise<RoomSnapshot> {
    const room = await this.prisma.gameRoom.findFirst({ where: { id: roomId, deletedAt: null } });
    if (!room) throw GameError.notFound('ROOM_NOT_FOUND', 'החדר לא נמצא');
    const session = await this.currentSession(room);
    const participants = await this.prisma.gameParticipant.findMany({
      where: { roomId, removedAt: null },
      include: { student: true, progress: session ? { where: { sessionId: session.id } } : false },
      orderBy: { joinedAt: 'asc' },
    });
    return {
      room: toRoomPublicView(room, session, participants.length),
      participants: participants.map((p) => toParticipantView(p, Array.isArray(p.progress) ? p.progress[0] : null)),
    };
  }

  async emitRoomUpdated(roomId: string): Promise<RoomSnapshot | null> {
    try {
      const snap = await this.snapshot(roomId);
      this.events.toRoom(roomId, 'room:updated', snap);
      return snap;
    } catch (err) {
      this.logger.warn(`room:updated failed for ${roomId}: ${String(err)}`);
      return null;
    }
  }

  /** הצטרפות תלמיד לחדר */
  async join(code: string, rawName: string, avatar: AvatarId): Promise<JoinRoomResponse> {
    const room = await this.findByCode(code);
    if (!room) throw GameError.notFound('ROOM_NOT_FOUND', 'החדר לא נמצא, בדקו את הקוד');
    if (!isJoinable(room.state, room.joinOpen)) throw GameError.forbidden('JOIN_CLOSED', 'ההצטרפות לחדר סגורה כרגע');

    const validation = validateDisplayName(rawName);
    if (!validation.ok) throw GameError.badRequest('INVALID_NAME', validation.reason ?? 'השם אינו תקין');
    const displayName = validation.normalized;
    const key = nameKey(displayName);

    const activeCount = await this.prisma.gameParticipant.count({ where: { roomId: room.id, removedAt: null } });
    if (activeCount >= MAX_PLAYERS_PER_ROOM) throw GameError.forbidden('ROOM_FULL', 'החדר מלא, לא ניתן להצטרף');

    const taken = await this.prisma.gameParticipant.findFirst({
      where: { roomId: room.id, removedAt: null, student: { nameKey: key } },
      select: { id: true },
    });
    if (taken) throw GameError.badRequest('NAME_TAKEN', 'השם כבר תפוס בחדר, בחרו שם אחר');

    const sessionToken = generateSessionToken();
    const session = await this.currentSession(room);

    const participant = await this.prisma.$transaction(async (tx) => {
      const student = await tx.student.create({ data: { displayName, nameKey: key, avatar } });
      const created = await tx.gameParticipant.create({
        data: { roomId: room.id, studentId: student.id, sessionTokenHash: hashSessionToken(sessionToken), connected: false },
      });
      if (session) {
        await tx.participantProgress.create({ data: { sessionId: session.id, participantId: created.id } });
      }
      await tx.auditLog.create({
        data: { roomId: room.id, teacherId: room.teacherId, action: 'PLAYER_JOINED', details: { participantId: created.id, displayName } },
      });
      return created;
    });

    const snap = await this.emitRoomUpdated(room.id);
    return {
      participantId: participant.id,
      sessionToken,
      displayName,
      avatar,
      room: snap?.room ?? toRoomPublicView(room, session, activeCount + 1),
    };
  }
}
