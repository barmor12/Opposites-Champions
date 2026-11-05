import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameMode, GameState, QuestionType } from '@prisma/client';
import { TREASURE_BONUS } from '@oc/shared';
import { ScoringService } from './scoring.service';
import { mockPrisma, p2002 } from '../games/testing/prisma-mock';
import type { QuestionsService, SessionQuestionFull } from '../questions/questions.service';
import type { LeaderboardService } from '../leaderboard/leaderboard.service';
import type { GameEventsService } from '../websocket/game-events.service';
import type { GamesService } from '../games/games.service';
import { QuestionsService as RealQuestionsService } from '../questions/questions.service';
import type { ContentService } from '../content/content.service';
import type { PrismaService } from '../prisma/prisma.service';

const LIMIT = 20_000;

function sessionQuestion(over: Partial<SessionQuestionFull> = {}): SessionQuestionFull {
  const base = {
    id: 'sq1', sessionId: 's1', questionId: 'q1', index: 0, isTreasure: false, treasureStep: null, timeLimitMs: LIMIT,
    startedAt: null, endsAt: null, closedAt: null,
    question: {
      id: 'q1', type: QuestionType.CHOOSE_OPPOSITE, wordPairId: 'p1', prompt: 'גדול', promptImage: null, explanation: 'ההפך של גדול הוא קטן',
      payload: { kind: 'choice', pairId: 'p1', word: 'גדול', opposite: 'קטן' }, createdAt: new Date(),
      options: [
        { id: 'o-correct', questionId: 'q1', text: 'קטן', image: null, isCorrect: true, order: 0 },
        { id: 'o-wrong', questionId: 'q1', text: 'ריק', image: null, isCorrect: false, order: 1 },
      ],
    },
  };
  return { ...base, ...over } as SessionQuestionFull;
}

interface Fixture {
  service: ScoringService;
  prisma: ReturnType<typeof mockPrisma>;
  progress: Record<string, unknown>;
  leaderboard: { broadcast: ReturnType<typeof vi.fn>; };
  games: { closeQuestionIfAllAnswered: ReturnType<typeof vi.fn>; maybeFinishIfAllDone: ReturnType<typeof vi.fn> };
}

function build(opts: { sq?: SessionQuestionFull; startedAgoMs?: number; progress?: Record<string, unknown>; settings?: Record<string, unknown> } = {}): Fixture {
  const sq = opts.sq ?? sessionQuestion();
  const startedAt = new Date(Date.now() - (opts.startedAgoMs ?? 5_000));
  const progress = {
    id: 'pp1', sessionId: 's1', participantId: 'pa1', currentIndex: sq.index, questionStartedAt: startedAt,
    score: 0, correctAnswers: 0, answeredCount: 0, totalResponseMs: 0, streak: 0, bestStreak: 0, treasureCorrect: 0, finished: false, finishedAt: null,
    ...opts.progress,
  };
  const session = { id: 's1', roomId: 'r1', state: GameState.QUESTION_ACTIVE, mode: GameMode.SELF_PACED, settings: { showCorrectAnswers: true, ...opts.settings }, currentQuestionIndex: null };
  const prisma = mockPrisma({
    gameParticipant: { findFirst: vi.fn(async () => ({ id: 'pa1', roomId: 'r1', removedAt: null, room: { id: 'r1', currentSessionId: 's1', deletedAt: null } })) },
    gameSession: { findUnique: vi.fn(async () => session) },
    participantProgress: {
      upsert: vi.fn(async () => progress),
      update: vi.fn(async ({ data }: { data: Record<string, { increment?: number } | number> }) => {
        const inc = (k: string): number => (typeof data[k] === 'object' && data[k] !== null ? (data[k] as { increment?: number }).increment ?? 0 : 0);
        progress.score = (progress.score as number) + inc('score');
        progress.correctAnswers = (progress.correctAnswers as number) + inc('correctAnswers');
        progress.answeredCount = (progress.answeredCount as number) + inc('answeredCount');
        progress.totalResponseMs = (progress.totalResponseMs as number) + inc('totalResponseMs');
        progress.treasureCorrect = (progress.treasureCorrect as number) + inc('treasureCorrect');
        if (typeof data.streak === 'number') progress.streak = data.streak;
        if (typeof data.bestStreak === 'number') progress.bestStreak = data.bestStreak;
        return { ...progress };
      }),
    },
    studentAnswer: { create: vi.fn(async ({ data }: { data: unknown }) => ({ id: 'a1', ...(data as object) })) },
    scoreEvent: { create: vi.fn(async () => ({})) },
    sessionQuestion: { findUnique: vi.fn(async () => sq) },
  });
  const questions = new RealQuestionsService({} as PrismaService, {} as ContentService);
  vi.spyOn(questions, 'getSessionQuestion').mockResolvedValue(sq);
  const leaderboard = { broadcast: vi.fn(), emitNow: vi.fn() };
  const games = { closeQuestionIfAllAnswered: vi.fn(async () => undefined), maybeFinishIfAllDone: vi.fn(async () => false) };
  const events = { toRoom: vi.fn(), toParticipant: vi.fn(), toTeacher: vi.fn() };
  const service = new ScoringService(prisma, questions as unknown as QuestionsService, leaderboard as unknown as LeaderboardService, events as unknown as GameEventsService, games as unknown as GamesService);
  return { service, prisma, progress, leaderboard, games };
}

describe('ScoringService.submitAnswer', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('scores a correct answer with speed bonus from the server-side start time', async () => {
    const { service, prisma } = build({ startedAgoMs: 10_000 });
    const result = await service.submitAnswer('pa1', { sessionQuestionId: 'sq1', optionId: 'o-correct' });
    expect(result.correct).toBe(true);
    expect(result.scoreAwarded).toBeGreaterThanOrEqual(124);
    expect(result.scoreAwarded).toBeLessThanOrEqual(126);
    expect(result.elapsedMs).toBeGreaterThanOrEqual(10_000);
    expect(result.elapsedMs).toBeLessThan(11_000);
    expect(result.streak).toBe(1);
    expect(result.correctOptionId).toBe('o-correct');
    expect(result.explanation).toMatch(/ההפך/);
    expect(prisma.scoreEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reason: 'ANSWER' }) }));
  });

  it('clamps elapsed time to the limit inside the grace window (100 points, no bonus)', async () => {
    const { service } = build({ startedAgoMs: LIMIT + 1_000 });
    const result = await service.submitAnswer('pa1', { sessionQuestionId: 'sq1', optionId: 'o-correct' });
    expect(result.elapsedMs).toBe(LIMIT);
    expect(result.correct).toBe(true);
    expect(result.scoreAwarded).toBe(100);
  });

  it('records a late answer (beyond the 1.5s grace) as incorrect with 0 points', async () => {
    const { service, prisma } = build({ startedAgoMs: LIMIT + 3_000 });
    const result = await service.submitAnswer('pa1', { sessionQuestionId: 'sq1', optionId: 'o-correct' });
    expect(result).toMatchObject({ correct: false, scoreAwarded: 0, elapsedMs: LIMIT, streak: 0 });
    expect(prisma.studentAnswer.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isCorrect: false, scoreAwarded: 0 }) }));
  });

  it('awards 100 points without time limit regardless of elapsed time', async () => {
    const { service } = build({ sq: sessionQuestion({ timeLimitMs: 0 }), startedAgoMs: 120_000 });
    const result = await service.submitAnswer('pa1', { sessionQuestionId: 'sq1', optionId: 'o-correct' });
    expect(result).toMatchObject({ correct: true, scoreAwarded: 100 });
  });

  it('rejects a double answer with 409 ALREADY_ANSWERED', async () => {
    const { service, prisma } = build();
    prisma.studentAnswer.create.mockRejectedValueOnce(p2002());
    await expect(service.submitAnswer('pa1', { sessionQuestionId: 'sq1', optionId: 'o-correct' })).rejects.toMatchObject({ code: 'ALREADY_ANSWERED' });
    expect(prisma.participantProgress.update).not.toHaveBeenCalled();
  });

  it('rejects answers for a question that is not the current one', async () => {
    const { service } = build();
    await expect(service.submitAnswer('pa1', { sessionQuestionId: 'sq-other', optionId: 'o-correct' })).rejects.toMatchObject({ code: 'WRONG_QUESTION' });
  });

  it('rejects answers while the game is paused or not active', async () => {
    const paused = build();
    paused.prisma.gameSession.findUnique.mockResolvedValueOnce({ id: 's1', roomId: 'r1', state: GameState.PAUSED, mode: GameMode.SELF_PACED, settings: {} });
    await expect(paused.service.submitAnswer('pa1', { sessionQuestionId: 'sq1', optionId: 'o-correct' })).rejects.toMatchObject({ code: 'GAME_PAUSED' });
    const waiting = build();
    waiting.prisma.gameSession.findUnique.mockResolvedValueOnce({ id: 's1', roomId: 'r1', state: GameState.WAITING_FOR_PLAYERS, mode: GameMode.SELF_PACED, settings: {} });
    await expect(waiting.service.submitAnswer('pa1', { sessionQuestionId: 'sq1', optionId: 'o-correct' })).rejects.toMatchObject({ code: 'NOT_ACTIVE' });
  });

  it('resets the streak on a wrong answer and keeps bestStreak', async () => {
    const { service } = build({ progress: { streak: 4, bestStreak: 4 } });
    const result = await service.submitAnswer('pa1', { sessionQuestionId: 'sq1', optionId: 'o-wrong' });
    expect(result).toMatchObject({ correct: false, scoreAwarded: 0, streak: 0 });
  });

  it('grants the treasure bonus when the 5th treasure question completes 5 correct', async () => {
    const sq = sessionQuestion({ id: 'sq-t5', index: 19, isTreasure: true, treasureStep: 5 });
    const { service, prisma } = build({ sq, progress: { currentIndex: 19, treasureCorrect: 4, score: 500 } });
    const result = await service.submitAnswer('pa1', { sessionQuestionId: 'sq-t5', optionId: 'o-correct' });
    expect(result.treasureCompleted).toBe(true);
    expect(result.treasureBonus).toBe(TREASURE_BONUS);
    expect(result.scoreAwarded).toBeGreaterThan(TREASURE_BONUS);
    expect(result.totalScore).toBe(500 + result.scoreAwarded);
    expect(prisma.scoreEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reason: 'TREASURE_BONUS', points: TREASURE_BONUS }) }));
  });

  it('does not grant the treasure bonus when an earlier treasure question was missed', async () => {
    const sq = sessionQuestion({ id: 'sq-t5', index: 19, isTreasure: true, treasureStep: 5 });
    const { service, prisma } = build({ sq, progress: { currentIndex: 19, treasureCorrect: 3 } });
    const result = await service.submitAnswer('pa1', { sessionQuestionId: 'sq-t5', optionId: 'o-correct' });
    expect(result.treasureCompleted).toBeUndefined();
    expect(prisma.scoreEvent.create).toHaveBeenCalledTimes(1);
  });

  it('hides the correct answer in teacher-paced mode until the question is closed', async () => {
    const sq = sessionQuestion({ startedAt: new Date(Date.now() - 2_000) });
    const fx = build({ sq });
    fx.prisma.gameSession.findUnique.mockResolvedValue({ id: 's1', roomId: 'r1', state: GameState.QUESTION_ACTIVE, mode: GameMode.TEACHER_PACED, settings: { showCorrectAnswers: true }, currentQuestionIndex: 0 });
    const result = await fx.service.submitAnswer('pa1', { sessionQuestionId: 'sq1', optionId: 'o-wrong' });
    expect(result.correct).toBe(false);
    expect(result.correctOptionId).toBeUndefined();
    expect(result.explanation).toBeUndefined();
    expect(fx.games.closeQuestionIfAllAnswered).toHaveBeenCalledWith('s1');
  });
});
