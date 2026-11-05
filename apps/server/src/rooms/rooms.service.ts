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
import { isRoomStale, nextRoomExpiry, TERMINAL_ROOM_STATES } from './room-expiry';

export interface RoomSnapshot {
  room: RoomPublicView;
  participants: ParticipantView[];
}

export interface ExpiredRooms {
  roomIds: string[];
  sessionIds: string[];
}

const CODE_MAX_ATTEMPTS = 12;
/** מצבי סבב שאינם סופיים – הופכים ל־EXPIRED יחד עם החדר */
const NON_FINAL_SESSION_STATES: GameState[] = [
  GameState.CREATED, GameState.WAITING_FOR_PLAYERS, GameState.COUNTDOWN, GameState.QUESTION_ACTIVE,
  GameState.QUESTION_RESULTS, GameState.NEXT_QUESTION, GameState.FINAL_RESULTS, GameState.PAUSED,
];

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

  /** יוצר חדר חדש עם קוד ייחודי בן 6 ספרות (ניסיון חוזר בהתנגשות) ותוקף של 24 שעות */
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
            expiresAt: nextRoomExpiry(),
          },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          // The code itself is not logged – it is a (short-lived) access credential.
          this.logger.warn(`room code collision, retrying (attempt ${attempt + 1}/${CODE_MAX_ATTEMPTS})`);
          continue;
        }
        throw err;
      }
    }
    throw GameError.conflict('CODE_GENERATION_FAILED', 'לֹא הִצְלַחְנוּ לִיצוֹר קוֹד חֶדֶר, נַסּוּ שׁוּב');
  }

  /** חיפוש לפי קוד – חדר שפג תוקפו מסומן EXPIRED בדרך (ולא ניתן להצטרף אליו) */
  async findByCode(code: string): Promise<GameRoom | null> {
    const room = await this.prisma.gameRoom.findFirst({ where: { code, deletedAt: null } });
    return room ? this.expireIfStale(room) : null;
  }

  // ===== תפוגת חדרים =====

  /**
   * מסמן חדר (והסבב הפעיל שלו) כ־EXPIRED אם עברו 24 שעות. מוחזר החדר המעודכן.
   * אידמפוטנטי ובטוח למקביליות (updateMany עם תנאי מצב).
   */
  async expireIfStale(room: GameRoom, now: number = Date.now()): Promise<GameRoom> {
    if (!isRoomStale(room, now)) return room;
    const expired = await this.markExpired(room.id, new Date(now));
    if (expired.roomIds.length > 0) {
      this.events.toRoom(room.id, 'error:message', { code: 'ROOM_EXPIRED', message: 'תּוֹקֶף הַחֶדֶר פָּג, יֵשׁ לִפְתּוֹחַ מִשְׂחָק חָדָשׁ' });
      await this.emitRoomUpdated(room.id);
    }
    return { ...room, state: GameState.EXPIRED, joinOpen: false };
  }

  /** סריקה תקופתית: כל החדרים שפג תוקפם ועדיין אינם במצב סופי */
  async expireStaleRooms(now: number = Date.now()): Promise<ExpiredRooms> {
    const stale = await this.prisma.gameRoom.findMany({
      where: {
        deletedAt: null,
        state: { notIn: [...TERMINAL_ROOM_STATES] },
        expiresAt: { lte: new Date(now) },
      },
      select: { id: true },
    });
    const result: ExpiredRooms = { roomIds: [], sessionIds: [] };
    for (const { id } of stale) {
      const expired = await this.markExpired(id, new Date(now));
      result.roomIds.push(...expired.roomIds);
      result.sessionIds.push(...expired.sessionIds);
      if (expired.roomIds.length > 0) {
        this.events.toRoom(id, 'error:message', { code: 'ROOM_EXPIRED', message: 'תּוֹקֶף הַחֶדֶר פָּג, יֵשׁ לִפְתּוֹחַ מִשְׂחָק חָדָשׁ' });
      }
    }
    if (result.roomIds.length > 0) this.logger.log(`expired ${result.roomIds.length} stale room(s)`);
    return result;
  }

  private async markExpired(roomId: string, at: Date): Promise<ExpiredRooms> {
    return this.prisma.$transaction(async (tx) => {
      const room = await tx.gameRoom.updateMany({
        where: { id: roomId, deletedAt: null, state: { notIn: [...TERMINAL_ROOM_STATES] } },
        data: { state: GameState.EXPIRED, joinOpen: false },
      });
      if (room.count === 0) return { roomIds: [], sessionIds: [] };
      const sessions = await tx.gameSession.findMany({ where: { roomId, state: { in: NON_FINAL_SESSION_STATES } }, select: { id: true } });
      const sessionIds = sessions.map((s) => s.id);
      if (sessionIds.length > 0) {
        await tx.gameSession.updateMany({
          where: { id: { in: sessionIds } },
          data: { state: GameState.EXPIRED, finishedAt: at, pausedAt: null, pausedRemainingMs: null, questionEndsAt: null },
        });
      }
      await tx.auditLog.create({ data: { roomId, action: 'ROOM_EXPIRED', details: { sessionIds } } });
      return { roomIds: [roomId], sessionIds };
    });
  }

  async getPublicView(code: string): Promise<RoomPublicView> {
    const room = await this.findByCode(code);
    if (!room) throw GameError.notFound('ROOM_NOT_FOUND', 'הַחֶדֶר לֹא נִמְצָא, בִּדְקוּ אֶת הַקּוֹד');
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
    if (!room) throw GameError.notFound('ROOM_NOT_FOUND', 'הַחֶדֶר לֹא נִמְצָא, בִּדְקוּ אֶת הַקּוֹד');
    if (room.state === GameState.EXPIRED) throw GameError.forbidden('ROOM_EXPIRED', 'תּוֹקֶף הַחֶדֶר פָּג, בַּקְּשׁוּ מֵהַמּוֹרָה קוֹד חָדָשׁ');
    if (!isJoinable(room.state, room.joinOpen)) throw GameError.forbidden('JOIN_CLOSED', 'הַהִצְטָרְפוּת לַחֶדֶר סְגוּרָה כָּרֶגַע');

    const validation = validateDisplayName(rawName);
    if (!validation.ok) throw GameError.badRequest('INVALID_NAME', validation.reason ?? 'הַשֵּׁם אֵינוֹ תַּקִּין');
    const displayName = validation.normalized;
    const key = nameKey(displayName);

    const activeCount = await this.prisma.gameParticipant.count({ where: { roomId: room.id, removedAt: null } });
    if (activeCount >= MAX_PLAYERS_PER_ROOM) throw GameError.forbidden('ROOM_FULL', 'הַחֶדֶר מָלֵא, לֹא נִיתָּן לְהִצְטָרֵף');

    const taken = await this.prisma.gameParticipant.findFirst({
      where: { roomId: room.id, removedAt: null, student: { nameKey: key } },
      select: { id: true },
    });
    if (taken) throw GameError.badRequest('NAME_TAKEN', 'הַשֵּׁם כְּבָר תָּפוּס בַּחֶדֶר, בָּחֲרוּ שֵׁם אַחֵר');

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
