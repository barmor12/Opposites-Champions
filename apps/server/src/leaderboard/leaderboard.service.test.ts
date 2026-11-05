import { describe, expect, it, vi } from 'vitest';
import { AchievementType } from '@oc/shared';
import { LeaderboardService, LEADERBOARD_THROTTLE_MS } from './leaderboard.service';
import { mockPrisma } from '../games/testing/prisma-mock';
import type { GameEventsService } from '../websocket/game-events.service';

interface Row {
  participantId: string; studentId: string; score: number; correctAnswers: number; answeredCount: number; totalResponseMs: number;
  bestStreak: number; finished: boolean; prevBest?: number | null;
}

function build(rows: Row[], questionCount = 10) {
  const progressRows = rows.map((r) => ({
    id: `pp-${r.participantId}`, sessionId: 's1', participantId: r.participantId, currentIndex: 0, questionStartedAt: null,
    score: r.score, correctAnswers: r.correctAnswers, answeredCount: r.answeredCount, totalResponseMs: r.totalResponseMs,
    streak: 0, bestStreak: r.bestStreak, treasureCorrect: 0, finished: r.finished, finishedAt: null, updatedAt: new Date(),
    participant: { id: r.participantId, studentId: r.studentId, connected: true, removedAt: null, student: { displayName: r.participantId, avatar: 'lion' } },
  }));
  const prisma = mockPrisma({
    gameSession: { findUnique: vi.fn(async () => ({ id: 's1', roomId: 'r1', settings: { showLeaderboard: true } })) },
    sessionQuestion: { count: vi.fn(async () => questionCount) },
    participantProgress: {
      findMany: vi.fn(async () => progressRows),
      aggregate: vi.fn(async ({ where }: { where: { participant: { studentId: string } } }) => {
        const row = rows.find((r) => r.studentId === where.participant.studentId);
        const prev = row?.prevBest;
        return prev === undefined ? { _max: { score: null }, _count: { _all: 0 } } : { _max: { score: prev }, _count: { _all: 1 } };
      }),
    },
    achievement: { upsert: vi.fn(async ({ where }: { where: { type: string } }) => ({ id: `ach-${where.type}` })) },
    studentAchievement: { upsert: vi.fn(async (args: unknown) => args) },
  });
  const events = { toRoom: vi.fn(), toTeacher: vi.fn(), toParticipant: vi.fn() };
  return { service: new LeaderboardService(prisma, events as unknown as GameEventsService), prisma, events };
}

describe('LeaderboardService.compute', () => {
  it('ranks by score, then correct answers, then response time, with accuracy per entry', async () => {
    const { service } = build([
      { participantId: 'a', studentId: 'sa', score: 300, correctAnswers: 3, answeredCount: 4, totalResponseMs: 9000, bestStreak: 2, finished: false },
      { participantId: 'b', studentId: 'sb', score: 300, correctAnswers: 3, answeredCount: 3, totalResponseMs: 4000, bestStreak: 3, finished: true },
      { participantId: 'c', studentId: 'sc', score: 100, correctAnswers: 1, answeredCount: 2, totalResponseMs: 1000, bestStreak: 1, finished: false },
    ]);
    const board = await service.compute('s1');
    expect(board.entries.map((e) => [e.participantId, e.rank])).toEqual([['b', 1], ['a', 2], ['c', 3]]);
    expect(board.entries[0]?.accuracy).toBe(100);
    expect(board.entries[1]?.accuracy).toBe(75);
    expect(board.entries[0]?.displayName).toBe('b');
  });
});

describe('LeaderboardService.broadcast throttle', () => {
  it('emits at most once per window and sends a trailing update', async () => {
    vi.useFakeTimers();
    const { service, events } = build([]);
    service.broadcast('s1');
    service.broadcast('s1');
    service.broadcast('s1');
    await vi.advanceTimersByTimeAsync(10);
    expect(events.toRoom).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(LEADERBOARD_THROTTLE_MS + 10);
    expect(events.toRoom).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(LEADERBOARD_THROTTLE_MS + 10);
    expect(events.toRoom).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
    vi.useRealTimers();
  });
});

describe('LeaderboardService.awardAchievements', () => {
  it('applies every rule', async () => {
    const { service, prisma } = build([
      // מקום ראשון, סיים הכל, 10 נכונות, רצף 5, דיוק 100%, שיא אישי
      { participantId: 'champ', studentId: 's-champ', score: 1400, correctAnswers: 10, answeredCount: 10, totalResponseMs: 50_000, bestStreak: 10, finished: true, prevBest: 900 },
      // סיים, 9/10, רצף 4, שיא קודם גבוה יותר
      { participantId: 'acc', studentId: 's-acc', score: 1000, correctAnswers: 9, answeredCount: 10, totalResponseMs: 60_000, bestStreak: 4, finished: true, prevBest: 1200 },
      // לא סיים, 4/5 (80%), ללא סבב קודם
      { participantId: 'mid', studentId: 's-mid', score: 400, correctAnswers: 4, answeredCount: 5, totalResponseMs: 10_000, bestStreak: 5, finished: false },
      // אפס נכונות אבל ענה על הכל – רק התמדה
      { participantId: 'zero', studentId: 's-zero', score: 0, correctAnswers: 0, answeredCount: 10, totalResponseMs: 100_000, bestStreak: 0, finished: true },
    ]);
    const awards = await service.awardAchievements('s1');
    const byP = (id: string): AchievementType[] => awards.filter((a) => a.participantId === id).map((a) => a.type).sort();
    expect(byP('champ')).toEqual([
      AchievementType.ACCURACY_CHAMPION, AchievementType.FIVE_STREAK, AchievementType.OPPOSITES_CHAMPION,
      AchievementType.PERSISTENCE_CHAMPION, AchievementType.PERSONAL_BEST, AchievementType.TEN_CORRECT,
    ].sort());
    expect(byP('acc')).toEqual([AchievementType.ACCURACY_CHAMPION, AchievementType.PERSISTENCE_CHAMPION].sort());
    expect(byP('mid')).toEqual([AchievementType.FIVE_STREAK]);
    expect(byP('zero')).toEqual([AchievementType.PERSISTENCE_CHAMPION]);
    expect(prisma.studentAchievement.upsert).toHaveBeenCalledTimes(awards.length);
  });

  it('does not crown a rank-1 player with zero correct answers', async () => {
    const { service } = build([
      { participantId: 'only', studentId: 's1', score: 0, correctAnswers: 0, answeredCount: 3, totalResponseMs: 1000, bestStreak: 0, finished: false },
    ]);
    const awards = await service.awardAchievements('s1');
    expect(awards).toEqual([]);
  });
});
