import { Injectable, Logger } from '@nestjs/common';
import { GameMode, GameState, Prisma, QuestionType, type GameParticipant, type GameRoom, type GameSession, type ParticipantProgress } from '@prisma/client';
import { calculateMatchScore, calculateScore, TREASURE_BONUS, TREASURE_QUESTIONS, type AnswerPayload, type AnswerResult, type QuestionView } from '@oc/shared';
import { PrismaService } from '../prisma/prisma.service';
import { QuestionsService, type SessionQuestionFull } from '../questions/questions.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { GameEventsService } from '../websocket/game-events.service';
import { GamesService } from '../games/games.service';
import { GameError } from '../games/game-error';
import { parseSettings } from '../games/settings';
import { ANSWER_GRACE_MS } from '../games/game-constants';
import { isRoomStale } from '../rooms/room-expiry';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PlayContext {
  participant: GameParticipant & { room: GameRoom };
  session: GameSession;
  progress: ParticipantProgress;
}

export interface AdvanceResult {
  question: QuestionView | null;
  finished: boolean;
}

export const SCORE_REASON_ANSWER = 'ANSWER';
export const SCORE_REASON_TREASURE = 'TREASURE_BONUS';

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly questions: QuestionsService,
    private readonly leaderboard: LeaderboardService,
    private readonly events: GameEventsService,
    private readonly games: GamesService,
  ) {}

  /** הגשת תשובה – כל החישוב בשרת */
  async submitAnswer(participantId: string, payload: AnswerPayload): Promise<AnswerResult> {
    if (!payload || typeof payload.sessionQuestionId !== 'string') throw GameError.badRequest('INVALID_ANSWER', 'תשובה לא תקינה');
    const ctx = await this.loadContext(participantId);
    const { session, progress } = ctx;
    this.assertActive(session);
    if (progress.finished) throw GameError.conflict('ALREADY_FINISHED', 'סיימת את כל השאלות');

    const selfPaced = session.mode === GameMode.SELF_PACED;
    const index = selfPaced ? progress.currentIndex : session.currentQuestionIndex;
    const sq = index === null ? null : await this.questions.getSessionQuestion(session.id, index);
    if (!sq || sq.id !== payload.sessionQuestionId) await this.rejectForeignOrStaleQuestion(session.id, payload.sessionQuestionId);
    if (!sq) throw GameError.badRequest('WRONG_QUESTION', 'זו אינה השאלה הנוכחית');

    const startedAt = selfPaced ? progress.questionStartedAt : sq.startedAt;
    if (!startedAt) throw GameError.conflict('NOT_STARTED', 'השאלה עדיין לא התחילה');

    const now = Date.now();
    const limit = sq.timeLimitMs;
    const raw = now - startedAt.getTime();
    const elapsed = limit > 0 ? Math.min(Math.max(0, raw), limit) : Math.max(0, raw);
    const timedOut = limit > 0 && raw > limit + ANSWER_GRACE_MS;

    const check = this.questions.checkAnswer(sq, payload);
    const isMatch = sq.question.type === QuestionType.MATCH_PAIRS;
    const correct = !timedOut && check.correct;
    let score = 0;
    if (!timedOut) {
      score = isMatch
        ? calculateMatchScore(check.matchedCount, check.totalPairs, check.mistakes, elapsed, limit)
        : calculateScore(correct, elapsed, limit);
    }

    const recorded = await this.record(ctx, sq, {
      selectedOptionId: check.selectedOptionId ?? null,
      answerPayload: check.answerPayload,
      isCorrect: correct,
      elapsedMs: elapsed,
      scoreAwarded: score,
    });

    const settings = parseSettings(session.settings);
    const reveal = selfPaced && settings.showCorrectAnswers;
    const result: AnswerResult = {
      sessionQuestionId: sq.id,
      correct,
      scoreAwarded: score + recorded.bonus,
      totalScore: recorded.progress.score,
      elapsedMs: elapsed,
      streak: recorded.progress.streak,
      ...(reveal && check.correctOptionId ? { correctOptionId: check.correctOptionId } : {}),
      ...(reveal && check.correctMatches ? { correctMatches: check.correctMatches } : {}),
      ...(reveal && check.explanation ? { explanation: check.explanation } : {}),
      ...(recorded.treasureCompleted ? { treasureCompleted: true, treasureBonus: recorded.bonus } : {}),
    };

    this.leaderboard.broadcast(session.id);
    if (!selfPaced) {
      this.games.closeQuestionIfAllAnswered(session.id).catch((err: unknown) => this.logger.warn(`auto-close failed: ${String(err)}`));
    }
    return result;
  }

  /** רישום דילוג (תם הזמן ללא תשובה) – רק אם לא קיימת תשובה */
  async skipQuestion(participantId: string, sessionQuestionId: string): Promise<boolean> {
    const ctx = await this.loadContext(participantId);
    const sq = await this.prisma.sessionQuestion.findFirst({ where: { id: sessionQuestionId, sessionId: ctx.session.id }, include: { question: { include: { options: true } } } });
    if (!sq) throw GameError.notFound('QUESTION_NOT_FOUND', 'השאלה לא נמצאה');
    const existing = await this.prisma.studentAnswer.findUnique({ where: { sessionQuestionId_participantId: { sessionQuestionId: sq.id, participantId } }, select: { id: true } });
    if (existing) return false;
    const startedAt = ctx.session.mode === GameMode.SELF_PACED ? ctx.progress.questionStartedAt : sq.startedAt;
    const elapsed = sq.timeLimitMs > 0 ? sq.timeLimitMs : Math.max(0, Date.now() - (startedAt?.getTime() ?? Date.now()));
    try {
      await this.record(ctx, sq, { selectedOptionId: null, answerPayload: null, isCorrect: false, elapsedMs: elapsed, scoreAwarded: 0 });
    } catch (err) {
      if (err instanceof GameError && err.code === 'ALREADY_ANSWERED') return false;
      throw err;
    }
    this.leaderboard.broadcast(ctx.session.id);
    return true;
  }

  /** self-paced: מעבר לשאלה הבאה או סיום */
  async advance(participantId: string, sessionQuestionId?: string): Promise<AdvanceResult> {
    const ctx = await this.loadContext(participantId);
    const { session, progress } = ctx;
    this.assertActive(session);
    const all = await this.questions.listSessionQuestions(session.id);
    const total = all.length;

    if (session.mode === GameMode.TEACHER_PACED) {
      const idx = session.currentQuestionIndex;
      const sq = idx === null ? undefined : all[idx];
      return { question: sq?.startedAt ? this.questions.toQuestionView(sq, sq.startedAt, total) : null, finished: false };
    }
    if (progress.finished) return { question: null, finished: true };

    const current = all[progress.currentIndex];
    if (!current) {
      await this.markFinished(ctx);
      return { question: null, finished: true };
    }
    if (sessionQuestionId && sessionQuestionId !== current.id) {
      // בקשה כפולה/ישנה – מחזירים את השאלה הנוכחית עם זמן ההתחלה המקורי (ללא התקדמות)
      return { question: this.questions.toQuestionView(current, progress.questionStartedAt ?? new Date(), total), finished: false };
    }
    const answered = await this.prisma.studentAnswer.findUnique({ where: { sessionQuestionId_participantId: { sessionQuestionId: current.id, participantId } }, select: { id: true } });
    if (!answered) await this.skipQuestion(participantId, current.id);

    const nextIndex = progress.currentIndex + 1;
    if (nextIndex >= total) {
      await this.markFinished(ctx);
      return { question: null, finished: true };
    }
    const now = new Date();
    await this.prisma.participantProgress.update({ where: { id: progress.id }, data: { currentIndex: nextIndex, questionStartedAt: now } });
    const next = all[nextIndex] as SessionQuestionFull;
    return { question: this.questions.toQuestionView(next, now, total, now.getTime()), finished: false };
  }

  /**
   * sessionQuestionId שאינו השאלה הנוכחית: אם הוא שייך לסבב אחר (חדר אחר) או לא קיים → 404
   * (לא חושפים קיום שאלות של חדרים אחרים); אם הוא מהסבב הזה אך אינו הנוכחי → 400 WRONG_QUESTION.
   */
  private async rejectForeignOrStaleQuestion(sessionId: string, sessionQuestionId: string): Promise<never> {
    if (UUID_RE.test(sessionQuestionId)) {
      const owner = await this.prisma.sessionQuestion.findUnique({ where: { id: sessionQuestionId }, select: { sessionId: true } });
      if (!owner || owner.sessionId !== sessionId) throw GameError.notFound('QUESTION_NOT_FOUND', 'השאלה לא נמצאה בחדר שלך');
    }
    throw GameError.badRequest('WRONG_QUESTION', 'זו אינה השאלה הנוכחית');
  }

  async loadContext(participantId: string): Promise<PlayContext> {
    const participant = await this.prisma.gameParticipant.findFirst({ where: { id: participantId, removedAt: null }, include: { room: true } });
    if (!participant || participant.room.deletedAt) throw GameError.forbidden('NOT_IN_ROOM', 'אינך משתתף/ת בחדר זה');
    // חדר שפג תוקפו (24 שעות) – גם אם הסריקה התקופתית עוד לא סימנה אותו EXPIRED במסד
    if (isRoomStale(participant.room)) throw GameError.conflict('ROOM_EXPIRED', 'תוקף החדר פג, יש לפתוח משחק חדש');
    if (!participant.room.currentSessionId) throw GameError.conflict('NO_SESSION', 'אין סבב פעיל בחדר');
    const session = await this.prisma.gameSession.findUnique({ where: { id: participant.room.currentSessionId } });
    if (!session) throw GameError.notFound('SESSION_NOT_FOUND', 'הסבב לא נמצא');
    const progress = await this.prisma.participantProgress.upsert({
      where: { sessionId_participantId: { sessionId: session.id, participantId } },
      update: {},
      create: { sessionId: session.id, participantId },
    });
    return { participant, session, progress };
  }

  private assertActive(session: GameSession): void {
    if (session.state === GameState.PAUSED) throw GameError.conflict('GAME_PAUSED', 'המשחק מושהה, המתינו למורה');
    if (session.state !== GameState.QUESTION_ACTIVE) throw GameError.conflict('NOT_ACTIVE', 'אין שאלה פעילה כרגע');
  }

  private async markFinished(ctx: PlayContext): Promise<void> {
    const now = new Date();
    await this.prisma.participantProgress.updateMany({ where: { id: ctx.progress.id, finished: false }, data: { finished: true, finishedAt: now } });
    const roomId = ctx.participant.roomId;
    const [participantCount, finishedCount] = await Promise.all([
      this.prisma.gameParticipant.count({ where: { roomId, removedAt: null } }),
      this.prisma.participantProgress.count({ where: { sessionId: ctx.session.id, finished: true, participant: { removedAt: null } } }),
    ]);
    this.events.toRoom(roomId, 'player:finished', { participantId: ctx.participant.id, finishedCount, participantCount });
    this.leaderboard.broadcast(ctx.session.id);
    await this.games.maybeFinishIfAllDone(ctx.session.id);
  }

  private async record(
    ctx: PlayContext,
    sq: SessionQuestionFull,
    answer: { selectedOptionId: string | null; answerPayload: Prisma.InputJsonValue | null; isCorrect: boolean; elapsedMs: number; scoreAwarded: number },
  ): Promise<{ progress: ParticipantProgress; bonus: number; treasureCompleted: boolean }> {
    const { session, progress, participant } = ctx;
    const newStreak = answer.isCorrect ? progress.streak + 1 : 0;
    const treasureHit = sq.isTreasure && answer.isCorrect;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.studentAnswer.create({
          data: {
            sessionId: session.id,
            sessionQuestionId: sq.id,
            participantId: participant.id,
            selectedOptionId: answer.selectedOptionId,
            answerPayload: answer.answerPayload ?? Prisma.JsonNull,
            isCorrect: answer.isCorrect,
            elapsedMs: answer.elapsedMs,
            scoreAwarded: answer.scoreAwarded,
          },
        });
        let updated = await tx.participantProgress.update({
          where: { id: progress.id },
          data: {
            score: { increment: answer.scoreAwarded },
            correctAnswers: { increment: answer.isCorrect ? 1 : 0 },
            answeredCount: { increment: 1 },
            totalResponseMs: { increment: answer.elapsedMs },
            streak: newStreak,
            bestStreak: Math.max(progress.bestStreak, newStreak),
            treasureCorrect: { increment: treasureHit ? 1 : 0 },
          },
        });
        if (answer.scoreAwarded > 0) {
          await tx.scoreEvent.create({ data: { sessionId: session.id, participantId: participant.id, reason: SCORE_REASON_ANSWER, points: answer.scoreAwarded } });
        }
        let bonus = 0;
        let treasureCompleted = false;
        if (treasureHit && sq.treasureStep === TREASURE_QUESTIONS && updated.treasureCorrect >= TREASURE_QUESTIONS) {
          bonus = TREASURE_BONUS;
          treasureCompleted = true;
          await tx.scoreEvent.create({ data: { sessionId: session.id, participantId: participant.id, reason: SCORE_REASON_TREASURE, points: bonus } });
          updated = await tx.participantProgress.update({ where: { id: progress.id }, data: { score: { increment: bonus } } });
        }
        return { progress: updated, bonus, treasureCompleted };
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw GameError.conflict('ALREADY_ANSWERED', 'כבר ענית על השאלה הזו');
      }
      throw err;
    }
  }
}
