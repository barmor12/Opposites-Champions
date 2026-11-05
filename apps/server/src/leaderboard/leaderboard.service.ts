import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { AchievementType as PrismaAchievementType } from '@prisma/client';
import {
  ACHIEVEMENT_LABELS, AchievementType, rankEntries,
  type AchievementAward, type AvatarId, type Leaderboard, type LeaderboardEntry,
} from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { GameEventsService } from '../websocket/game-events.service';
import { parseSettings } from '../games/settings';
import { GameError } from '../games/game-error';

export const LEADERBOARD_THROTTLE_MS = 500;

interface ThrottleState {
  timer: NodeJS.Timeout;
  pending: boolean;
}

@Injectable()
export class LeaderboardService implements OnModuleDestroy {
  private readonly logger = new Logger(LeaderboardService.name);
  private readonly throttles = new Map<string, ThrottleState>();

  constructor(private readonly prisma: PrismaService, private readonly events: GameEventsService) {}

  onModuleDestroy(): void {
    for (const state of this.throttles.values()) clearTimeout(state.timer);
    this.throttles.clear();
  }

  /** מחשב את טבלת הדירוג של סבב (ללא משתתפים שהוסרו) */
  async compute(sessionId: string): Promise<Leaderboard> {
    const rows = await this.prisma.participantProgress.findMany({
      where: { sessionId, participant: { removedAt: null } },
      include: { participant: { include: { student: true } } },
    });
    const ranked = rankEntries(rows.map((r) => ({
      participantId: r.participantId,
      score: r.score,
      correctAnswers: r.correctAnswers,
      totalResponseMs: r.totalResponseMs,
      row: r,
    })));
    const entries: LeaderboardEntry[] = ranked.map(({ entry, rank }) => ({
      participantId: entry.participantId,
      displayName: entry.row.participant.student.displayName,
      avatar: entry.row.participant.student.avatar as AvatarId,
      score: entry.score,
      correctAnswers: entry.correctAnswers,
      answeredCount: entry.row.answeredCount,
      accuracy: entry.row.answeredCount > 0 ? Math.round((entry.correctAnswers / entry.row.answeredCount) * 100) : 0,
      totalResponseMs: entry.totalResponseMs,
      rank,
      connected: entry.row.participant.connected,
      finished: entry.row.finished,
    }));
    return { gameSessionId: sessionId, entries, updatedAt: Date.now() };
  }

  /** שידור מדורג: לכל היותר פעם ב־500ms לסבב, עם שידור "נגרר" בסוף החלון */
  broadcast(sessionId: string): void {
    const state = this.throttles.get(sessionId);
    if (state) {
      state.pending = true;
      return;
    }
    void this.emitNow(sessionId);
    const timer = setTimeout(() => {
      const current = this.throttles.get(sessionId);
      this.throttles.delete(sessionId);
      if (current?.pending) this.broadcast(sessionId);
    }, LEADERBOARD_THROTTLE_MS);
    timer.unref?.();
    this.throttles.set(sessionId, { timer, pending: false });
  }

  /** שידור מיידי (למשל בסיום משחק) */
  async emitNow(sessionId: string): Promise<Leaderboard | null> {
    try {
      const session = await this.prisma.gameSession.findUnique({ where: { id: sessionId }, select: { roomId: true, settings: true } });
      if (!session) return null;
      const board = await this.compute(sessionId);
      const settings = parseSettings(session.settings);
      if (settings.showLeaderboard) this.events.toRoom(session.roomId, 'leaderboard:updated', board);
      else this.events.toTeacher(session.roomId, 'leaderboard:updated', board);
      return board;
    } catch (err) {
      this.logger.warn(`leaderboard broadcast failed (${sessionId}): ${String(err)}`);
      return null;
    }
  }

  /** הענקת הישגים בסיום סבב (upsert – בטוח לקריאה חוזרת) */
  async awardAchievements(sessionId: string): Promise<AchievementAward[]> {
    const session = await this.prisma.gameSession.findUnique({ where: { id: sessionId }, select: { id: true, roomId: true, settings: true } });
    if (!session) throw GameError.notFound('SESSION_NOT_FOUND', 'הסבב לא נמצא');
    const questionCount = await this.prisma.sessionQuestion.count({ where: { sessionId } });
    const rows = await this.prisma.participantProgress.findMany({
      where: { sessionId, participant: { removedAt: null } },
      include: { participant: { select: { id: true, studentId: true } } },
    });
    const board = await this.compute(sessionId);
    const rankOf = new Map(board.entries.map((e) => [e.participantId, e.rank]));

    const awards: AchievementAward[] = [];
    for (const row of rows) {
      const types: AchievementType[] = [];
      const rank = rankOf.get(row.participantId);
      if (rank === 1 && row.correctAnswers >= 1) types.push(AchievementType.OPPOSITES_CHAMPION);
      if (questionCount > 0 && row.finished && row.answeredCount >= questionCount) types.push(AchievementType.PERSISTENCE_CHAMPION);
      if (row.correctAnswers >= 10) types.push(AchievementType.TEN_CORRECT);
      if (row.bestStreak >= 5) types.push(AchievementType.FIVE_STREAK);
      if (row.answeredCount >= 5 && row.correctAnswers / row.answeredCount >= 0.9) types.push(AchievementType.ACCURACY_CHAMPION);
      if (await this.isPersonalBest(session.roomId, sessionId, row.participant.studentId, row.score)) types.push(AchievementType.PERSONAL_BEST);
      for (const type of types) awards.push({ type, participantId: row.participantId });
    }

    if (awards.length > 0) {
      const achievementIds = await this.ensureAchievementRows([...new Set(awards.map((a) => a.type))]);
      await this.prisma.$transaction(
        awards.map((a) => this.prisma.studentAchievement.upsert({
          where: { sessionId_participantId_achievementId: { sessionId, participantId: a.participantId, achievementId: achievementIds.get(a.type) as string } },
          update: {},
          create: { sessionId, participantId: a.participantId, achievementId: achievementIds.get(a.type) as string },
        })),
      );
    }
    return awards;
  }

  private async isPersonalBest(roomId: string, sessionId: string, studentId: string, score: number): Promise<boolean> {
    if (score <= 0) return false;
    const previous = await this.prisma.participantProgress.aggregate({
      where: { sessionId: { not: sessionId }, session: { roomId }, participant: { studentId } },
      _max: { score: true },
      _count: { _all: true },
    });
    if (previous._count._all === 0) return false;
    return score > (previous._max.score ?? 0);
  }

  private async ensureAchievementRows(types: AchievementType[]): Promise<Map<AchievementType, string>> {
    const map = new Map<AchievementType, string>();
    for (const type of types) {
      const label = ACHIEVEMENT_LABELS[type];
      const row = await this.prisma.achievement.upsert({
        where: { type: type as PrismaAchievementType },
        update: {},
        create: { type: type as PrismaAchievementType, title: label.title, description: label.description, emoji: label.emoji },
        select: { id: true },
      });
      map.set(type, row.id);
    }
    return map;
  }
}
